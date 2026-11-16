import { sql } from '@/lib/db'
import {
  armarFilas,
  armarTemas,
  contarLugares,
  elegirSugerencia,
  resumir,
  type ActividadCruda,
  type FilaAlumno,
  type InvitacionCruda,
  type MiembroCrudo,
  type ResumenAlumnos,
  type Sugerencia,
  type TemaDeAlumno,
} from '@/lib/alumnos-docente'

/**
 * Las consultas de Mis alumnos.
 *
 * Regla de privacidad, la misma que ya tenía el seguimiento por grupo: TODO se
 * filtra por los grupos del docente (`quiz_attempts.classroom_id`). Lo que el
 * alumno practicó por su cuenta, o en el grupo de otro docente, no aparece. El
 * docente tiene acceso a su materia, no a la cuenta entera del alumno.
 *
 * Sólo cuentan los grupos abiertos: un grupo cerrado es un curso que terminó.
 */

type Fila = Record<string, unknown>

async function leerMiembros(teacherId: string): Promise<MiembroCrudo[]> {
  const filas = (await sql`
    SELECT m.user_id, m.display_name, m.contexto, m.joined_at,
           c.id AS grupo_id, c.name AS grupo_nombre,
           p.id AS materia_id, p.subject_name,
           u.is_guest
    FROM classroom_members m
    JOIN classrooms c ON c.id = m.classroom_id
    JOIN teacher_programs p ON p.id = c.teacher_program_id
    JOIN users u ON u.id = m.user_id
    WHERE c.teacher_id = ${teacherId}
      AND c.status = 'open'
      AND m.status = 'active'
      AND m.user_id <> ${teacherId}
    ORDER BY m.joined_at ASC, m.id ASC
  `) as Fila[]

  return filas.map((fila) => ({
    userId: String(fila.user_id),
    nombre: String(fila.display_name),
    contexto: fila.contexto === null ? null : String(fila.contexto),
    grupoId: Number(fila.grupo_id),
    grupoNombre: String(fila.grupo_nombre),
    materia: String(fila.subject_name),
    materiaId: Number(fila.materia_id),
    esInvitadoSinCuenta: Boolean(fila.is_guest),
    seSumoEl: new Date(fila.joined_at as string).toISOString(),
  }))
}

async function leerInvitaciones(teacherId: string): Promise<InvitacionCruda[]> {
  const filas = (await sql`
    SELECT i.id, i.nombre, i.contexto, i.created_at,
           c.id AS grupo_id, c.name AS grupo_nombre, c.join_code,
           p.id AS materia_id, p.subject_name
    FROM classroom_invitations i
    JOIN classrooms c ON c.id = i.classroom_id
    JOIN teacher_programs p ON p.id = c.teacher_program_id
    WHERE c.teacher_id = ${teacherId} AND c.status = 'open'
    ORDER BY i.created_at ASC, i.id ASC
  `) as Fila[]

  return filas.map((fila) => ({
    id: Number(fila.id),
    nombre: String(fila.nombre),
    contexto: fila.contexto === null ? null : String(fila.contexto),
    grupoId: Number(fila.grupo_id),
    grupoNombre: String(fila.grupo_nombre),
    materia: String(fila.subject_name),
    materiaId: Number(fila.materia_id),
    codigo: String(fila.join_code),
    creadaEl: new Date(fila.created_at as string).toISOString(),
  }))
}

/** Temas por alumno, de los intentos hechos dentro de los grupos del docente. `soloDe` acota a un alumno. */
async function leerTemas(teacherId: string, soloDe: string | null = null): Promise<Map<string, TemaDeAlumno[]>> {
  const filas = (await sql`
    SELECT att.user_id, t.tema,
           SUM(att.correct_answers)::int AS correctas,
           SUM(att.total_questions - COALESCE(att.ungraded_answers, 0))::int AS calificadas
    FROM quiz_attempts att
    JOIN classrooms c ON c.id = att.classroom_id
    CROSS JOIN LATERAL unnest(att.topics) AS t(tema)
    WHERE c.teacher_id = ${teacherId}
      AND c.status = 'open'
      AND (${soloDe}::text IS NULL OR att.user_id = ${soloDe})
    GROUP BY att.user_id, t.tema
  `) as Fila[]

  const porAlumno = new Map<string, { tema: string; correctas: number; calificadas: number }[]>()
  for (const fila of filas) {
    const userId = String(fila.user_id)
    porAlumno.set(userId, [
      ...(porAlumno.get(userId) ?? []),
      { tema: String(fila.tema), correctas: Number(fila.correctas), calificadas: Number(fila.calificadas) },
    ])
  }

  return new Map([...porAlumno].map(([userId, temas]) => [userId, armarTemas(temas)]))
}

/** Los alumnos distintos del docente, invitados incluidos: lo que mide el cupo. */
export async function contarAlumnosDelDocente(teacherId: string): Promise<number> {
  const [miembros, invitaciones] = await Promise.all([leerMiembros(teacherId), leerInvitaciones(teacherId)])
  return contarLugares(miembros, invitaciones)
}

export interface MisAlumnos {
  alumnos: FilaAlumno[]
  sugerencia: Sugerencia | null
  resumen: ResumenAlumnos
  /** Las materias del docente, para elegir a cuál sumar a un alumno nuevo. Nivel y año, para H6. */
  materias: { id: number; nombre: string; nivel: string | null; grado: string | null }[]
}

export async function leerMisAlumnos(teacherId: string, ahora: Date = new Date()): Promise<MisAlumnos> {
  const [miembros, invitaciones, temas, actividadFilas, semanaFilas, materiaFilas] = await Promise.all([
    leerMiembros(teacherId),
    leerInvitaciones(teacherId),
    leerTemas(teacherId),
    sql`
      SELECT att.user_id,
             MAX(att.completed_at) AS ultima_vez,
             COUNT(*)::int AS intentos,
             COUNT(*) FILTER (WHERE att.assignment_id IS NOT NULL)::int AS tareas_entregadas,
             COALESCE(SUM(att.correct_answers), 0)::int AS correctas,
             COALESCE(SUM(att.total_questions - COALESCE(att.ungraded_answers, 0)), 0)::int AS calificadas
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open'
      GROUP BY att.user_id
    ` as unknown as Promise<Fila[]>,
    sql`
      SELECT COUNT(*)::int AS total
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      WHERE c.teacher_id = ${teacherId}
        AND c.status = 'open'
        AND att.assignment_id IS NOT NULL
        AND att.user_id <> ${teacherId}
        AND att.completed_at >= NOW() - INTERVAL '7 days'
    ` as unknown as Promise<Fila[]>,
    sql`
      SELECT id, subject_name, nivel, grado
      FROM teacher_programs
      WHERE user_id = ${teacherId} AND status = 'active'
      ORDER BY created_at ASC, id ASC
    ` as unknown as Promise<Fila[]>,
  ])

  const actividad: ActividadCruda[] = actividadFilas.map((fila) => ({
    userId: String(fila.user_id),
    ultimaVez: fila.ultima_vez ? new Date(fila.ultima_vez as string).toISOString() : null,
    intentos: Number(fila.intentos),
    tareasEntregadas: Number(fila.tareas_entregadas),
    correctas: Number(fila.correctas),
    calificadas: Number(fila.calificadas),
  }))

  // El resumen se arma sólo con los alumnos que siguen en el listado: lo que
  // practicó el propio docente probando su grupo no cuenta.
  const enListado = new Set(miembros.map((miembro) => miembro.userId))
  const temasDeAlumnos = new Map([...temas].filter(([userId]) => enListado.has(userId)))

  const alumnos = armarFilas(miembros, invitaciones, actividad, temasDeAlumnos)

  return {
    alumnos,
    sugerencia: elegirSugerencia(alumnos, ahora),
    resumen: resumir(temasDeAlumnos, Number(semanaFilas[0]?.total ?? 0)),
    materias: materiaFilas.map((fila) => ({
      id: Number(fila.id),
      nombre: String(fila.subject_name),
      nivel: typeof fila.nivel === 'string' ? fila.nivel : null,
      grado: typeof fila.grado === 'string' ? fila.grado : null,
    })),
  }
}

export interface IntentoDeAlumno {
  id: number
  /** El título de la tarea, o null si fue práctica libre dentro del grupo. */
  tarea: string | null
  materia: string
  temas: string[]
  correctas: number
  calificadas: number
  sinCalificar: number
  completadoEl: string
}

export interface ErrorRecurrente {
  tema: string
  /** El diagnóstico que escribió la IA: habla del razonamiento, no de la nota. */
  diagnostico: string
  detectadoEl: string
}

export interface FichaAlumno {
  userId: string
  nombre: string
  /** Texto escrito por el docente, o vacío si todavía no escribió nada. */
  contexto: string
  sinCuenta: boolean
  materias: { id: number; nombre: string }[]
  ultimaVez: string | null
  temas: TemaDeAlumno[]
  intentos: IntentoDeAlumno[]
  errores: ErrorRecurrente[]
}

/** La ficha de un alumno, o null si no es alumno de ese docente. */
export async function leerFichaAlumno(teacherId: string, userId: string): Promise<FichaAlumno | null> {
  const membresias = (await leerMiembros(teacherId)).filter((miembro) => miembro.userId === userId)
  if (membresias.length === 0) return null

  const materias = [...new Map(membresias.map((m) => [m.materiaId, { id: m.materiaId, nombre: m.materia }])).values()]
  const nombresDeMaterias = materias.map((materia) => materia.nombre)

  const [temas, intentoFilas, errorFilas] = await Promise.all([
    leerTemas(teacherId, userId),
    sql`
      SELECT att.id, att.subject, att.topics, att.correct_answers, att.total_questions,
             COALESCE(att.ungraded_answers, 0) AS sin_calificar, att.completed_at,
             q.title AS tarea
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      LEFT JOIN classroom_assignments a ON a.id = att.assignment_id
      LEFT JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open' AND att.user_id = ${userId}
      ORDER BY att.completed_at DESC
      LIMIT 50
    ` as unknown as Promise<Fila[]>,
    // Sólo los de las materias de este docente, y sólo los que siguen abiertos.
    sql`
      SELECT topic_name, misconception_type, tip, created_at
      FROM student_misconceptions
      WHERE user_id = ${userId}
        AND subject = ANY(${nombresDeMaterias})
        AND resolved = FALSE
      ORDER BY created_at DESC
      LIMIT 8
    ` as unknown as Promise<Fila[]>,
  ])

  const intentos: IntentoDeAlumno[] = intentoFilas.map((fila) => {
    const sinCalificar = Number(fila.sin_calificar)
    return {
      id: Number(fila.id),
      tarea: fila.tarea ? String(fila.tarea) : null,
      materia: String(fila.subject),
      temas: Array.isArray(fila.topics) ? fila.topics.map(String) : [],
      correctas: Number(fila.correct_answers),
      calificadas: Number(fila.total_questions) - sinCalificar,
      sinCalificar,
      completadoEl: new Date(fila.completed_at as string).toISOString(),
    }
  })

  const invitaciones = await leerInvitaciones(teacherId)
  const fila = armarFilas(membresias, invitaciones, [], new Map())[0]
  const contextoEscrito = membresias.find((m) => m.contexto?.trim())?.contexto?.trim() ?? ''

  return {
    userId,
    nombre: membresias[0].nombre,
    // La fila ya resolvió si hereda el contexto de una invitación; si lo que
    // muestra es sólo la materia (nadie escribió nada), acá va vacío.
    contexto: contextoEscrito || (fila.contexto !== nombresDeMaterias.join(' · ') ? fila.contexto : ''),
    sinCuenta: membresias[0].esInvitadoSinCuenta,
    materias,
    ultimaVez: intentos[0]?.completadoEl ?? null,
    temas: temas.get(userId) ?? [],
    intentos,
    errores: errorFilas.map((error) => ({
      tema: String(error.topic_name),
      diagnostico: String(error.tip || error.misconception_type),
      detectadoEl: new Date(error.created_at as string).toISOString(),
    })),
  }
}

export const LARGO_MAXIMO_NOMBRE = 80
export const LARGO_MAXIMO_CONTEXTO = 120

/** Guarda qué prepara el alumno, en todos los grupos de ese docente donde está. Devuelve si tocó alguna fila. */
export async function guardarContexto(teacherId: string, userId: string, contexto: string): Promise<boolean> {
  const filas = (await sql`
    UPDATE classroom_members m
    SET contexto = ${contexto || null}, updated_at = NOW()
    FROM classrooms c
    WHERE c.id = m.classroom_id
      AND c.teacher_id = ${teacherId}
      AND m.user_id = ${userId}
      AND m.status = 'active'
    RETURNING m.id
  `) as Fila[]
  return filas.length > 0
}

export async function crearInvitacion(grupoId: number, nombre: string, contexto: string): Promise<number> {
  const filas = (await sql`
    INSERT INTO classroom_invitations (classroom_id, nombre, contexto)
    VALUES (${grupoId}, ${nombre}, ${contexto || null})
    RETURNING id
  `) as Fila[]
  return Number(filas[0].id)
}

/** Borra una invitación, sólo si es de un grupo de ese docente. */
export async function borrarInvitacion(teacherId: string, invitacionId: number): Promise<boolean> {
  const filas = (await sql`
    DELETE FROM classroom_invitations i
    USING classrooms c
    WHERE c.id = i.classroom_id AND c.teacher_id = ${teacherId} AND i.id = ${invitacionId}
    RETURNING i.id
  `) as Fila[]
  return filas.length > 0
}
