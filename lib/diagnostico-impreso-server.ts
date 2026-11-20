import { sql } from '@/lib/db'
import { etiquetaDeMateriaDe } from '@/lib/etiqueta-materia-server'
import { leerInvitaciones, leerMiembros } from '@/lib/alumnos-docente-server'
import { marcasDelImpreso, preguntasDelCuestionario, type MarcaDePregunta } from '@/lib/diagnostico-resultados'
import { preguntaImpresa, type PreguntaImpresa } from '@/lib/diagnostico-impreso'
import type { Destino } from '@/lib/fichas-server'

/**
 * J7: la versión en papel de un cuestionario del diagnóstico y la carga a
 * mano de lo que respondió. Sólo para un cuestionario tipo diagnóstico de ese
 * docente, y sólo para un alumno (o invitación) del grupo del diagnóstico.
 */

type Fila = Record<string, unknown>

export interface CuestionarioParaImprimir {
  quizId: number
  titulo: string
  materia: string
  /** El nombre del alumno para el encabezado de la hoja. */
  alumno: string
  preguntas: PreguntaImpresa[]
  /** La última carga a mano, si hay: para retomarla. */
  cargaPrevia: MarcaDePregunta[] | null
}

async function quien(
  teacherId: string,
  destino: Destino,
  classroomId: number,
): Promise<{ nombre: string; userId: string | null; invitacionId: number | null } | null> {
  if ('invitacionId' in destino) {
    const invitacion = (await leerInvitaciones(teacherId)).find((i) => i.id === destino.invitacionId && i.grupoId === classroomId)
    return invitacion ? { nombre: invitacion.nombre, userId: null, invitacionId: invitacion.id } : null
  }
  const miembro = (await leerMiembros(teacherId)).find((m) => m.userId === destino.userId && m.grupoId === classroomId)
  return miembro ? { nombre: miembro.nombre, userId: miembro.userId, invitacionId: null } : null
}

async function cuestionario(teacherId: string, quizId: number): Promise<Fila | null> {
  const filas = (await sql`
    SELECT q.id, q.title, q.subject_name, q.teacher_program_id, q.questions, q.selected_topics, d.classroom_id
    FROM teacher_quizzes q
    JOIN diagnosticos d ON d.id = q.diagnostico_id
    WHERE q.id = ${quizId} AND q.user_id = ${teacherId} AND q.tipo = 'diagnostico'
    LIMIT 1
  `) as Fila[]
  return filas[0] ?? null
}

export async function leerParaImprimir(teacherId: string, quizId: number, destino: Destino): Promise<CuestionarioParaImprimir | null> {
  const q = await cuestionario(teacherId, quizId)
  if (!q) return null
  const alumno = await quien(teacherId, destino, Number(q.classroom_id))
  if (!alumno) return null

  const crudas = Array.isArray(q.questions) ? (q.questions as unknown[]) : []
  const previas = (await sql`
    SELECT respuestas FROM diagnostico_resultados_impresos
    WHERE teacher_quiz_id = ${quizId} AND (user_id = ${alumno.userId} OR invitation_id = ${alumno.invitacionId})
    ORDER BY cargado_at DESC LIMIT 1
  `) as Fila[]
  const temas = (Array.isArray(q.selected_topics) ? q.selected_topics : []) as { id: string; name: string }[]

  return {
    quizId,
    titulo: String(q.title),
    // K6: con nivel y año si el docente tiene otra materia que se llama igual.
    materia: await etiquetaDeMateriaDe(teacherId, Number(q.teacher_program_id), String(q.subject_name)),
    alumno: alumno.nombre,
    preguntas: crudas.map(preguntaImpresa),
    cargaPrevia: previas[0] ? marcasDelImpreso(preguntasDelCuestionario(crudas, temas), previas[0].respuestas) : null,
  }
}

/**
 * L4: la hoja para todo un grupo (un diagnóstico o una práctica del grupo):
 * sin nombre, con la línea en blanco para que cada alumno escriba el suyo, y
 * sin carga previa (la carga a mano es por alumno).
 */
export async function leerParaImprimirGrupo(teacherId: string, quizId: number, classroomId: number): Promise<CuestionarioParaImprimir | null> {
  const q = await cuestionario(teacherId, quizId)
  if (!q || Number(q.classroom_id) !== classroomId) return null
  const crudas = Array.isArray(q.questions) ? (q.questions as unknown[]) : []
  return {
    quizId,
    titulo: String(q.title),
    materia: await etiquetaDeMateriaDe(teacherId, Number(q.teacher_program_id), String(q.subject_name)),
    alumno: '',
    preguntas: crudas.map(preguntaImpresa),
    cargaPrevia: null,
  }
}

/**
 * Guarda una carga a mano. Cada carga es una fila nueva (el resultado muestra
 * la más reciente): corregir es volver a cargar. No toca `topic_mastery` ni
 * `student_misconceptions`. Devuelve false si el cuestionario o el alumno no
 * son de este docente.
 */
export async function guardarCarga(
  teacherId: string,
  quizId: number,
  destino: Destino,
  respuestas: Record<string, MarcaDePregunta>,
): Promise<boolean> {
  const q = await cuestionario(teacherId, quizId)
  if (!q) return false
  const alumno = await quien(teacherId, destino, Number(q.classroom_id))
  if (!alumno) return false
  await sql`
    INSERT INTO diagnostico_resultados_impresos (teacher_quiz_id, user_id, invitation_id, respuestas)
    VALUES (${quizId}, ${alumno.userId}, ${alumno.invitacionId}, ${JSON.stringify(respuestas)}::jsonb)
  `
  return true
}

/** Cuántas preguntas tiene el cuestionario (para validar la carga), o null si no es suyo. */
export async function cantidadDePreguntas(teacherId: string, quizId: number): Promise<number | null> {
  const q = await cuestionario(teacherId, quizId)
  return q ? (Array.isArray(q.questions) ? q.questions.length : 0) : null
}
