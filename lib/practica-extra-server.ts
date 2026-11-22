import { sql } from '@/lib/db'
import { destinatarioDeFila, visibleParaAlumno } from '@/lib/destinatario'
import { resumenDelPlan } from '@/lib/planes-server'
import {
  configDeLaTarea,
  consignasDe,
  estadoDePracticaExtra,
  resumenDePracticasExtra,
  type ConfigDePracticaExtra,
  type EstadoDePracticaExtra,
} from '@/lib/practica-extra'
import type { QuizRequestParams } from '@/lib/quiz-generation'

/**
 * P4 · Lo que toca la base de la práctica extra. TODO se resuelve con el id
 * del viewer: la tarea tiene que ser de un grupo donde es miembro activo y
 * visible para él (L0), y la práctica reservada, suya.
 *
 * Válvula: sin la 036 (42P01 / 42703) no hay práctica extra (el botón no
 * aparece) y el guardado de intentos no cambia.
 */
const faltaLaMigracion = (e: unknown) => ['42P01', '42703'].includes((e as { code?: string })?.code ?? '')

interface FilaDeTarea {
  id: number
  classroom_id: number
  teacher_id: string
  teacher_email: string | null
  subject_name: string
  mode: string
  question_count: number
  selected_topics: unknown
  questions: unknown
  pedagogy_context: string | null
  tipo: string | null
  programa_id: number
  nivel: string | null
  grado: string | null
  pedagogy_profile: { degree?: unknown } | null
  solo_user_id: string | null
  solo_invitacion_id: string | null
}

/** La tarea, si es del alumno (miembro activo de un grupo abierto y visible para él). */
async function tareaDelAlumno(userId: string, asignacionId: number): Promise<FilaDeTarea | null> {
  const filas = (await sql`
    SELECT a.id, a.classroom_id, c.teacher_id, d.email AS teacher_email,
      q.subject_name, q.mode, q.question_count, q.selected_topics, q.questions, q.pedagogy_context,
      to_jsonb(q) ->> 'tipo' AS tipo,
      p.id AS programa_id, to_jsonb(p) ->> 'nivel' AS nivel, to_jsonb(p) ->> 'grado' AS grado, p.pedagogy_profile,
      to_jsonb(a) ->> 'solo_user_id' AS solo_user_id,
      to_jsonb(a) ->> 'solo_invitacion_id' AS solo_invitacion_id
    FROM classroom_assignments a
    JOIN classrooms c ON c.id = a.classroom_id AND c.status = 'open'
    JOIN classroom_members m ON m.classroom_id = c.id AND m.user_id = ${userId} AND m.status = 'active'
    JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
    JOIN teacher_programs p ON p.id = c.teacher_program_id
    JOIN users d ON d.id = c.teacher_id
    WHERE a.id = ${asignacionId}
  `) as FilaDeTarea[]
  const fila = filas[0]
  if (!fila) return null
  return visibleParaAlumno(destinatarioDeFila(fila as unknown as Record<string, unknown>), userId) ? fila : null
}

/** Las de hoy: el tope es por día de Argentina, el de quien practica. */
async function hechasHoy(userId: string, asignacionId: number): Promise<number> {
  const filas = (await sql`
    SELECT COUNT(*)::int AS n FROM practicas_extra
    WHERE user_id = ${userId} AND assignment_id = ${asignacionId}
      AND creada_el >= date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires'
  `) as { n: number }[]
  return Number(filas[0]?.n ?? 0)
}

async function planVencido(teacherId: string, email: string | null): Promise<boolean> {
  try {
    return (await resumenDelPlan(teacherId, email)).estado === 'vencido'
  } catch {
    return false
  }
}

function configDe(t: FilaDeTarea): ConfigDePracticaExtra {
  const carrera = typeof t.pedagogy_profile?.degree === 'string' ? t.pedagogy_profile.degree : null
  return configDeLaTarea(
    {
      subjectName: t.subject_name,
      mode: t.mode,
      questionCount: Number(t.question_count),
      selectedTopics: t.selected_topics,
      questions: t.questions,
      pedagogyContext: t.pedagogy_context,
    },
    { id: Number(t.programa_id), nivel: t.nivel, grado: t.grado, carrera },
  )
}

/** Para el botón de la pantalla de resultados. */
export async function leerEstadoDePracticaExtra(userId: string, asignacionId: number): Promise<EstadoDePracticaExtra> {
  const tarea = await tareaDelAlumno(userId, asignacionId)
  let hechas = 0
  try {
    hechas = await hechasHoy(userId, asignacionId)
  } catch (error) {
    if (!faltaLaMigracion(error)) throw error
    return estadoDePracticaExtra({ hayMigracion: false, esDelAlumno: Boolean(tarea), esDiagnostico: false, planVencido: false, hechasHoy: 0 })
  }
  return estadoDePracticaExtra({
    hayMigracion: true,
    esDelAlumno: Boolean(tarea),
    esDiagnostico: tarea?.tipo === 'diagnostico',
    planVencido: tarea ? await planVencido(tarea.teacher_id, tarea.teacher_email) : false,
    hechasHoy: hechas,
  })
}

export type ReservaDePracticaExtra =
  | { ok: true; id: number; classroomId: number; config: ConfigDePracticaExtra; restantes: number }
  | { ok: false; estado: EstadoDePracticaExtra }

/**
 * "Practicar otra vez": reserva una práctica (cuenta para el tope) y devuelve
 * la configuración de la tarea. Las preguntas las genera después
 * /api/generate-quiz con `practicaExtraId`, que vuelve a leer todo de acá.
 */
export async function reservarPracticaExtra(userId: string, asignacionId: number): Promise<ReservaDePracticaExtra> {
  const estado = await leerEstadoDePracticaExtra(userId, asignacionId)
  if (!estado.disponible) return { ok: false, estado }
  const tarea = (await tareaDelAlumno(userId, asignacionId))!
  const [fila] = (await sql`
    INSERT INTO practicas_extra (assignment_id, user_id) VALUES (${asignacionId}, ${userId}) RETURNING id
  `) as { id: number }[]
  return { ok: true, id: Number(fila.id), classroomId: Number(tarea.classroom_id), config: configDe(tarea), restantes: estado.restantes - 1 }
}

/** Cuántas preguntas viejas del alumno se mandan para no repetir. */
const MAX_PREVIAS = 60

/**
 * Los parámetros de generación de una práctica reservada, leídos de la base
 * (nunca del cuerpo), más el docente al que se le cobra la IA. null si la
 * práctica no es de este alumno, ya se usó, o la tarea dejó de ser suya.
 *
 * Preguntas distintas: van como "anteriores" las de la tarea y las de sus
 * prácticas extra de esa misma tarea; el generador las pasa por
 * question-dedup (firma léxica y numérica) además de pedirle a la IA otras.
 */
export async function paramsDePracticaExtra(
  userId: string,
  practicaId: number,
): Promise<{ params: QuizRequestParams; docente: { id: string; email: string | null }; classroomId: number } | null> {
  let filas: { assignment_id: number }[]
  try {
    filas = (await sql`
      SELECT pe.assignment_id FROM practicas_extra pe
      WHERE pe.id = ${practicaId} AND pe.user_id = ${userId}
        AND NOT EXISTS (SELECT 1 FROM quiz_attempts t WHERE t.practica_extra_id = pe.id)
    `) as { assignment_id: number }[]
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
  if (!filas[0]) return null
  const tarea = await tareaDelAlumno(userId, Number(filas[0].assignment_id))
  if (!tarea || tarea.tipo === 'diagnostico') return null

  const previas = (await sql`
    SELECT ans.question_text
    FROM quiz_answers ans
    JOIN quiz_attempts t ON t.id = ans.quiz_attempt_id
    JOIN practicas_extra pe ON pe.id = t.practica_extra_id
    WHERE t.user_id = ${userId} AND pe.assignment_id = ${tarea.id}
    ORDER BY t.completed_at DESC
    LIMIT ${MAX_PREVIAS}
  `) as { question_text: string | null }[]

  const config = configDe(tarea)
  const params: QuizRequestParams = {
    subject: config.subject,
    subjectUnits: [],
    topics: config.topics,
    mode: config.mode,
    previousQuestions: [...consignasDe(tarea.questions), ...previas.filter((p) => p.question_text).map((p) => ({ question: String(p.question_text) }))],
    pedagogyContext: config.pedagogyContext,
    questionCount: config.questionCount,
    nivel: config.nivel,
    grado: config.grado,
    carrera: config.carrera ?? '',
    difficulty: 'intermedio',
    explicitQuestionTypes: config.questionTypes,
    teacherProgramId: config.teacherProgramId,
  }
  return { params, docente: { id: tarea.teacher_id, email: tarea.teacher_email }, classroomId: Number(tarea.classroom_id) }
}

/**
 * Al guardar el intento: si viene de una práctica extra de este alumno (y
 * todavía no tiene intento), el grupo de esa tarea. null en cualquier otro
 * caso (y sin la 036): el intento se guarda como siempre, sin vínculo.
 */
export async function grupoDeLaPracticaExtra(userId: string, practicaId: number): Promise<number | null> {
  try {
    const filas = (await sql`
      SELECT a.classroom_id
      FROM practicas_extra pe
      JOIN classroom_assignments a ON a.id = pe.assignment_id
      JOIN classroom_members m ON m.classroom_id = a.classroom_id AND m.user_id = ${userId} AND m.status = 'active'
      WHERE pe.id = ${practicaId} AND pe.user_id = ${userId}
        AND NOT EXISTS (SELECT 1 FROM quiz_attempts t WHERE t.practica_extra_id = pe.id)
    `) as { classroom_id: number }[]
    return filas[0] ? Number(filas[0].classroom_id) : null
  } catch (error) {
    if (faltaLaMigracion(error)) return null
    throw error
  }
}

export interface PracticasExtraDeAlumno {
  cantidad: number
  promedio: number | null
}

/**
 * "Prácticas extra" por alumno en un grupo (informe del grupo y ficha), sólo
 * de tareas de ese grupo. Vacío sin la 036.
 */
export async function practicasExtraDelGrupo(grupoId: number, userId?: string): Promise<Map<string, PracticasExtraDeAlumno>> {
  let filas: { user_id: string; score: number | string }[]
  try {
    filas = (await sql`
      SELECT t.user_id, t.score
      FROM quiz_attempts t
      JOIN practicas_extra pe ON pe.id = t.practica_extra_id
      JOIN classroom_assignments a ON a.id = pe.assignment_id
      WHERE a.classroom_id = ${grupoId}
        AND (${userId ?? null}::text IS NULL OR t.user_id = ${userId ?? null})
    `) as { user_id: string; score: number | string }[]
  } catch (error) {
    if (faltaLaMigracion(error)) return new Map()
    throw error
  }
  const porAlumno = new Map<string, number[]>()
  for (const f of filas) porAlumno.set(f.user_id, [...(porAlumno.get(f.user_id) ?? []), Number(f.score)])
  return new Map([...porAlumno].map(([id, notas]) => [id, resumenDePracticasExtra(notas)]))
}
