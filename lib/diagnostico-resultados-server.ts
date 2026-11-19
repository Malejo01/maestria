import { sql } from '@/lib/db'
import { invitacionDe } from '@/lib/alumnos-docente'
import { leerInvitaciones, leerMiembros } from '@/lib/alumnos-docente-server'
import {
  elegirFuente,
  marcasDeLaApp,
  marcasDelImpreso,
  preguntasDelCuestionario,
  resultadoPorTema,
  resumenPorUnidad,
  type MarcaDePregunta,
  type ResultadoDeTema,
  type ResultadoDeUnidad,
} from '@/lib/diagnostico-resultados'
import type { DiagnosticoListado, GrupoDelDiagnostico } from '@/lib/diagnostico-server'
import type { Destino } from '@/lib/fichas-server'
import type { ModoDiagnostico } from '@/lib/diagnostico'

/**
 * El resultado del diagnóstico de UN alumno (J6). Junta, por cuestionario, lo
 * que respondió en la app (su último intento de esa asignación) y lo cargado a
 * mano desde el impreso (J7), y se queda con lo más reciente.
 */

type Fila = Record<string, unknown>

export interface CuestionarioConResultado {
  id: number
  titulo: string
  unidadId: string | null
  preguntas: number
  /** De dónde sale lo que se muestra; null si todavía no lo rindió. */
  fuente: 'app' | 'impreso' | null
  fecha: string | null
}

export interface TemaConResultado extends ResultadoDeTema {
  /** El error que detectó MaestrIA en ese tema, si falló y hay uno. */
  error: string | null
}

export interface DiagnosticoConResultado extends Omit<DiagnosticoListado, 'cuestionarios'> {
  cuestionarios: CuestionarioConResultado[]
  unidades: ResultadoDeUnidad[]
  temas: TemaConResultado[]
}

/** El usuario y la invitación del destino (la invitación de un alumno es la que usó para entrar). */
async function identidades(teacherId: string, destino: Destino): Promise<{ userId: string | null; invitacionId: number | null }> {
  if ('invitacionId' in destino) return { userId: null, invitacionId: destino.invitacionId }
  const membresias = (await leerMiembros(teacherId)).filter((m) => m.userId === destino.userId)
  const suya = invitacionDe(membresias, await leerInvitaciones(teacherId))
  return { userId: destino.userId, invitacionId: suya?.id ?? null }
}

export async function leerResultados(
  teacherId: string,
  grupo: Pick<GrupoDelDiagnostico, 'classroomId' | 'materia' | 'unidades'>,
  destino: Destino,
): Promise<DiagnosticoConResultado[]> {
  const diagnosticos = (await sql`
    SELECT id, modo, created_at FROM diagnosticos
    WHERE teacher_id = ${teacherId} AND classroom_id = ${grupo.classroomId}
    ORDER BY created_at DESC, id DESC
  `) as Fila[]
  if (diagnosticos.length === 0) return []
  const ids = diagnosticos.map((d) => Number(d.id))

  const cuestionarios = (await sql`
    SELECT q.id, q.title, q.unidad_id, q.questions, q.selected_topics, q.diagnostico_id, a.id AS assignment_id
    FROM teacher_quizzes q
    LEFT JOIN classroom_assignments a ON a.teacher_quiz_id = q.id AND a.classroom_id = ${grupo.classroomId}
    WHERE q.diagnostico_id = ANY(${ids}) AND q.user_id = ${teacherId}
    ORDER BY q.id ASC
  `) as Fila[]
  const quizIds = cuestionarios.map((q) => Number(q.id))
  const asignaciones = cuestionarios.map((q) => q.assignment_id).filter((a) => a !== null).map(Number)

  const { userId, invitacionId } = await identidades(teacherId, destino)

  const [intentos, impresos, errores] = await Promise.all([
    userId && asignaciones.length > 0
      ? (sql`
          SELECT DISTINCT ON (assignment_id) id, assignment_id, completed_at
          FROM quiz_attempts
          WHERE user_id = ${userId} AND assignment_id = ANY(${asignaciones})
          ORDER BY assignment_id, completed_at DESC
        ` as unknown as Promise<Fila[]>)
      : Promise.resolve([] as Fila[]),
    quizIds.length > 0 && (userId || invitacionId)
      ? (sql`
          SELECT DISTINCT ON (teacher_quiz_id) teacher_quiz_id, respuestas, cargado_at
          FROM diagnostico_resultados_impresos
          WHERE teacher_quiz_id = ANY(${quizIds})
            AND (user_id = ${userId} OR invitation_id = ${invitacionId})
          ORDER BY teacher_quiz_id, cargado_at DESC
        ` as unknown as Promise<Fila[]>)
      : Promise.resolve([] as Fila[]),
    userId
      ? (sql`
          SELECT topic_name, tip, misconception_type FROM student_misconceptions
          WHERE user_id = ${userId} AND subject = ${grupo.materia} AND resolved = FALSE
          ORDER BY created_at DESC
        ` as unknown as Promise<Fila[]>)
      : Promise.resolve([] as Fila[]),
  ])

  const intentoIds = intentos.map((i) => Number(i.id))
  const respuestas = intentoIds.length
    ? ((await sql`
        SELECT quiz_attempt_id, question_index, question_id, is_correct
        FROM quiz_answers WHERE quiz_attempt_id = ANY(${intentoIds})
      `) as Fila[])
    : []

  const unidadDeTema = (temaId: string) => grupo.unidades.find((u) => u.topics.some((t) => t.id === temaId))?.id ?? null
  const errorDe = (nombre: string) => {
    const fila = errores.find((e) => String(e.topic_name).trim().toLowerCase() === nombre.trim().toLowerCase())
    return fila ? String(fila.tip || fila.misconception_type) : null
  }

  return diagnosticos.map((d) => {
    const propios = cuestionarios.filter((q) => Number(q.diagnostico_id) === Number(d.id))
    const temas: ResultadoDeTema[] = []
    const lista: CuestionarioConResultado[] = propios.map((q) => {
      const temasDelQuiz = (Array.isArray(q.selected_topics) ? q.selected_topics : []) as { id: string; name: string }[]
      const preguntas = preguntasDelCuestionario(Array.isArray(q.questions) ? q.questions : [], temasDelQuiz)

      const intento = intentos.find((i) => Number(i.assignment_id) === Number(q.assignment_id))
      const app = intento ? { fecha: new Date(intento.completed_at as string).toISOString(), id: Number(intento.id) } : null
      const impresoFila = impresos.find((i) => Number(i.teacher_quiz_id) === Number(q.id))
      const impreso = impresoFila ? { fecha: new Date(impresoFila.cargado_at as string).toISOString(), respuestas: impresoFila.respuestas } : null
      const elegida = elegirFuente(app, impreso)

      let marcas: MarcaDePregunta[] | null = null
      if (elegida?.fuente === 'app') {
        marcas = marcasDeLaApp(
          preguntas,
          respuestas
            .filter((r) => Number(r.quiz_attempt_id) === elegida.dato.id)
            .map((r) => ({
              questionId: String(r.question_id ?? ''),
              questionIndex: Number(r.question_index),
              isCorrect: r.is_correct === null ? null : Boolean(r.is_correct),
            })),
        )
      } else if (elegida?.fuente === 'impreso') {
        marcas = marcasDelImpreso(preguntas, elegida.dato.respuestas)
      }
      if (marcas) temas.push(...resultadoPorTema(preguntas, marcas, unidadDeTema))

      return {
        id: Number(q.id),
        titulo: String(q.title),
        unidadId: typeof q.unidad_id === 'string' ? q.unidad_id : null,
        preguntas: preguntas.length,
        fuente: elegida?.fuente ?? null,
        fecha: elegida?.dato.fecha ?? null,
      }
    })

    return {
      id: Number(d.id),
      modo: (d.modo === 'integral' ? 'integral' : 'por_unidad') as ModoDiagnostico,
      creadoEl: new Date(d.created_at as string).toISOString(),
      cuestionarios: lista,
      unidades: resumenPorUnidad(temas, grupo.unidades),
      temas: temas.map((t) => ({ ...t, error: t.estado === 'fallo' ? errorDe(t.nombre) : null })),
    }
  }).filter((d) => d.cuestionarios.length > 0)
}
