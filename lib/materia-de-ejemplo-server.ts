import { randomBytes } from 'node:crypto'
import { sql } from '@/lib/db'
import { createUniqueJoinCode } from '@/lib/classrooms-server'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { aprueba } from '@/lib/answer-grading'
import {
  aciertaEjemplo,
  ALUMNOS_DE_EJEMPLO,
  MATERIAS_DE_EJEMPLO,
  preguntasDeEjemplo,
  respuestaDeEjemplo,
  unidadesDeEjemplo,
  type AreaDeEjemplo,
} from '@/lib/materias-de-ejemplo'

/**
 * Ronda V · V2 — Crea y borra la materia de ejemplo de un docente: materia,
 * grupo con 7 alumnos ficticios, una tarea y un diagnóstico, con los
 * intentos y respuestas de cada alumno (lib/materias-de-ejemplo.ts). No llama
 * a la IA. Todo va con `ejemplo = TRUE` (migración 045).
 */

const faltaLaMigracion = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

/** Si la 045 corrió (la válvula: sin ella, el botón no aparece). */
export async function ejemploDisponible(): Promise<boolean> {
  try {
    const filas = (await sql`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
      WHERE table_name IN ('teacher_programs', 'classrooms', 'users') AND column_name = 'ejemplo'
    `) as { n: number }[]
    return Number(filas[0]?.n ?? 0) === 3
  } catch {
    return false
  }
}

export interface EjemploDelDocente {
  materiaId: number
  materia: string
  grupoId: number | null
}

/** Las materias de ejemplo del docente (sin la 045, ninguna). */
export async function ejemplosDelDocente(teacherId: string): Promise<EjemploDelDocente[]> {
  try {
    const filas = (await sql`
      SELECT p.id, p.subject_name, (SELECT MIN(c.id) FROM classrooms c WHERE c.teacher_program_id = p.id) AS grupo_id
      FROM teacher_programs p
      WHERE p.user_id = ${teacherId} AND p.ejemplo = TRUE
      ORDER BY p.id
    `) as { id: number; subject_name: string; grupo_id: number | null }[]
    return filas.map((f) => ({ materiaId: Number(f.id), materia: String(f.subject_name), grupoId: f.grupo_id === null ? null : Number(f.grupo_id) }))
  } catch (error) {
    if (faltaLaMigracion(error)) return []
    throw error
  }
}

/** El intento de un alumno ficticio y sus respuestas, como los guarda la app. */
async function guardarIntento(params: {
  userId: string
  materia: string
  grupoId: number
  asignacionId: number
  preguntas: ReturnType<typeof preguntasDeEjemplo>
  aciertos: boolean[]
  haceDias: number
}) {
  const { userId, materia, grupoId, asignacionId, preguntas, aciertos, haceDias } = params
  const correctas = aciertos.filter(Boolean).length
  const total = preguntas.length
  const nota = Math.round((correctas / total) * 1000) / 100
  const temas = [...new Set(preguntas.map((p) => p.topicName))]
  const [{ id }] = (await sql`SELECT nextval(pg_get_serial_sequence('quiz_attempts', 'id'))::int AS id`) as { id: number }[]
  const cuando = new Date(Date.now() - haceDias * 86_400_000 - 3_600_000).toISOString()
  const consultas = [
    sql`
      INSERT INTO quiz_attempts (id, user_id, subject, mode, topics, total_questions, correct_answers, incorrect_answers,
                                 ungraded_answers, score, passed, classroom_id, assignment_id, attempt_number, started_at, completed_at)
      VALUES (${id}, ${userId}, ${materia}, 'practico', ${temas}, ${total}, ${correctas}, ${total - correctas},
              0, ${nota}, ${aprueba(nota)}, ${grupoId}, ${asignacionId}, 1, ${cuando}::timestamptz - INTERVAL '12 minutes', ${cuando}::timestamptz)
    `,
    ...preguntas.map((p, i) => {
      const original = { type: p.type, correctAnswer: p.correctAnswer } as Parameters<typeof respuestaDeEjemplo>[0]
      const elegida = respuestaDeEjemplo(original, aciertos[i])
      const esMc = p.type === 'multiple_choice'
      return sql`
        INSERT INTO quiz_answers (quiz_attempt_id, question_index, question_id, question_text, question_type, options,
                                  selected_answer, correct_answer, answer_payload, is_correct, explanation, topic_name, created_at)
        VALUES (${id}, ${i}, ${p.id}, ${p.question}, ${p.type}, ${esMc ? JSON.stringify(p.options) : null},
                ${esMc ? elegida : null}, ${esMc ? p.correctAnswer : null},
                ${esMc ? null : JSON.stringify({ selectedAnswer: elegida, correctAnswer: p.correctAnswer })},
                ${aciertos[i]}, ${p.explanation}, ${p.topicName}, ${cuando}::timestamptz)
      `
    }),
  ]
  await sql.transaction(consultas)
}

/**
 * Crea la materia de ejemplo del área. Si el docente ya tiene una, devuelve
 * ésa (no se acumulan). null sin la 045.
 */
export async function crearMateriaDeEjemplo(teacherId: string, area: AreaDeEjemplo): Promise<EjemploDelDocente | null> {
  if (!(await ejemploDisponible())) return null
  const existentes = await ejemplosDelDocente(teacherId)
  if (existentes.length > 0) return existentes[0]

  const m = MATERIAS_DE_EJEMPLO[area]
  const conArea = completarAreaDelPrograma({
    materia: m.nombre,
    carrera: m.carrera,
    perfil: {
      level: m.nivel,
      degree: m.carrera,
      academicYear: m.grado,
      complexity: 'Intermedio',
      assessmentStyle: 'mixto',
      methodology: 'Materia de ejemplo.',
      area: m.area,
      areaConfianza: 1,
      areaOrigen: 'manual',
    },
    unidades: unidadesDeEjemplo(m),
  })
  const [programa] = (await sql`
    INSERT INTO teacher_programs (user_id, subject_name, icon_name, color_name, pedagogy_profile, units, nivel, grado, created_from, status, ejemplo, created_at, updated_at)
    VALUES (${teacherId}, ${m.nombre}, 'book-open', 'teal', ${JSON.stringify(conArea.perfil)}, ${JSON.stringify(conArea.unidades)},
            ${m.nivel}, ${m.grado}, 'manual', 'active', TRUE, NOW(), NOW())
    RETURNING id
  `) as { id: number }[]
  const materiaId = Number(programa.id)

  const [grupo] = (await sql`
    INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status, ejemplo, created_at, updated_at)
    VALUES (${teacherId}, ${materiaId}, ${'Grupo de ejemplo'}, ${await createUniqueJoinCode()}, 'open', TRUE, NOW(), NOW())
    RETURNING id
  `) as { id: number }[]
  const grupoId = Number(grupo.id)

  // Los alumnos ficticios: invitados sin cuenta, marcados.
  const alumnos = ALUMNOS_DE_EJEMPLO.map((a) => ({ ...a, id: `ejemplo_${randomBytes(12).toString('hex')}` }))
  for (const a of alumnos) {
    await sql`
      INSERT INTO users (id, email, name, role, is_onboarded, is_guest, ejemplo, created_at, updated_at)
      VALUES (${a.id}, NULL, ${a.nombre}, 'ALUMNO', TRUE, TRUE, TRUE, NOW() - INTERVAL '10 days', NOW())
    `
    await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      VALUES (${grupoId}, ${a.id}, ${a.nombre}, FALSE, 'active', NOW() - INTERVAL '10 days', NOW())
    `
  }

  const preguntas = preguntasDeEjemplo(m)
  const temas = unidadesDeEjemplo(m).flatMap((u) => u.topics)

  // El diagnóstico (integral) y la tarea, cada uno con sus resultados.
  const [diag] = (await sql`
    INSERT INTO diagnosticos (teacher_id, classroom_id, teacher_program_id, modo)
    VALUES (${teacherId}, ${grupoId}, ${materiaId}, 'integral')
    RETURNING id
  `) as { id: number }[]
  const cuestionarios = [
    { titulo: `Diagnóstico integral · ${m.nombre}`, tipo: 'diagnostico' as const, haceDias: 7, semilla: 100 },
    { titulo: `Tarea 1 · ${m.nombre}`, tipo: 'tarea' as const, haceDias: 2, semilla: 0 },
  ]
  for (const c of cuestionarios) {
    const [quiz] = (await sql`
      INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics,
                                   question_count, questions, pedagogy_context, tipo, diagnostico_id, created_at, updated_at)
      VALUES (${teacherId}, ${materiaId}, ${c.titulo}, ${m.nombre}, 'practico', 'saved', ${JSON.stringify(temas)},
              ${preguntas.length}, ${JSON.stringify(preguntas)}, NULL, ${c.tipo}, ${c.tipo === 'diagnostico' ? Number(diag.id) : null},
              NOW() - make_interval(days => ${c.haceDias + 1}), NOW())
      RETURNING id
    `) as { id: number }[]
    const [asignacion] = (await sql`
      INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at, updated_at)
      VALUES (${grupoId}, ${Number(quiz.id)}, NULL, NULL, ${c.tipo === 'diagnostico' ? 1 : null}, NOW() - make_interval(days => ${c.haceDias + 1}), NOW())
      RETURNING id
    `) as { id: number }[]
    // En la tarea hay uno que todavía no la hizo: la planilla muestra el pendiente.
    for (const [i, a] of alumnos.entries()) {
      if (c.tipo === 'tarea' && i === alumnos.length - 2) continue
      await guardarIntento({
        userId: a.id,
        materia: m.nombre,
        grupoId,
        asignacionId: Number(asignacion.id),
        preguntas,
        aciertos: preguntas.map((_, q) => aciertaEjemplo(i, q, area, c.semilla)),
        haceDias: c.haceDias,
      })
    }
  }
  return { materiaId, materia: m.nombre, grupoId }
}

/**
 * Borra todo lo de ejemplo del docente: las respuestas, los intentos, las
 * tareas y diagnósticos, el grupo, los alumnos ficticios y la materia. Sólo
 * lo marcado `ejemplo` y de este docente. Devuelve cuántas materias borró.
 */
export async function borrarMateriasDeEjemplo(teacherId: string): Promise<number> {
  const ejemplos = await ejemplosDelDocente(teacherId)
  if (ejemplos.length === 0) return 0
  const materias = ejemplos.map((e) => e.materiaId)
  const grupos = (await sql`
    SELECT id FROM classrooms WHERE teacher_id = ${teacherId} AND ejemplo = TRUE AND teacher_program_id = ANY(${materias})
  `) as { id: number }[]
  const ids = grupos.map((g) => Number(g.id))
  const alumnos = (await sql`
    SELECT m.user_id FROM classroom_members m JOIN users u ON u.id = m.user_id
    WHERE m.classroom_id = ANY(${ids}) AND u.ejemplo = TRUE
  `) as { user_id: string }[]
  const usuarios = alumnos.map((a) => String(a.user_id))
  await sql.transaction([
    sql`DELETE FROM quiz_answers WHERE quiz_attempt_id IN (SELECT id FROM quiz_attempts WHERE classroom_id = ANY(${ids}))`,
    sql`DELETE FROM quiz_attempts WHERE classroom_id = ANY(${ids})`,
    sql`DELETE FROM classroom_assignments WHERE classroom_id = ANY(${ids})`,
    sql`DELETE FROM teacher_quizzes WHERE user_id = ${teacherId} AND teacher_program_id = ANY(${materias})`,
    sql`DELETE FROM diagnosticos WHERE teacher_id = ${teacherId} AND classroom_id = ANY(${ids})`,
    sql`DELETE FROM classroom_members WHERE classroom_id = ANY(${ids})`,
    sql`DELETE FROM classrooms WHERE id = ANY(${ids}) AND ejemplo = TRUE`,
    sql`DELETE FROM users WHERE id = ANY(${usuarios}) AND ejemplo = TRUE`,
    sql`DELETE FROM teacher_programs WHERE id = ANY(${materias}) AND user_id = ${teacherId} AND ejemplo = TRUE`,
  ])
  return materias.length
}
