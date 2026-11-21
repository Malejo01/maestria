import { sql } from '@/lib/db'
import { getOwnedClassroom } from '@/lib/classrooms-server'
import {
  ESTADO_SIN_LA_029,
  estadoDeReporte,
  valoresDeEstado,
  type ContextoDeReporte,
  type EstadoDeReporte,
} from '@/lib/reportes'
import type { Question } from '@/lib/types'

/**
 * M6 · El buzón en el servidor: guardar un reporte con su contexto, listarlos
 * para el admin, cambiarles el estado, y los de UN grupo para su docente.
 *
 * Válvula de la 029: las columnas de contexto se leen con `to_jsonb(r) ->>`
 * (sin la migración dan NULL) y se escriben sólo si existen; un estado que el
 * CHECK viejo no admite se guarda con su nombre de la 019.
 */

/** Postgres: columna o tabla inexistente (la 029 no corrió). */
function faltaLaMigracion(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42703' || code === '42P01'
}

/** Postgres: violación de un CHECK (el de estados, sin la 029). */
function violaElCheck(error: unknown): boolean {
  return (error as { code?: string })?.code === '23514'
}

export interface NuevoReporte {
  userId: string
  isGuest: boolean
  role: string | null
  description: string
  pathname: string | null
  questionId: string | null
  questionType: string | null
  userAgent: string | null
  contexto: ContextoDeReporte
}

/** Guarda el reporte; con la 029, también de qué cuestionario y grupo es. */
export async function guardarReporte(r: NuevoReporte): Promise<number | null> {
  const { contexto: c } = r
  const conContexto = c.teacherQuizId !== null || c.assignmentId !== null || c.classroomId !== null || c.questionIndex !== null
  if (conContexto) {
    try {
      const filas = (await sql`
        INSERT INTO feedback_reports (
          user_id, is_guest, role, description, pathname, question_id, question_type, user_agent,
          teacher_quiz_id, assignment_id, classroom_id, question_index
        ) VALUES (
          ${r.userId}, ${r.isGuest}, ${r.role}, ${r.description}, ${r.pathname}, ${r.questionId}, ${r.questionType}, ${r.userAgent},
          ${c.teacherQuizId}, ${c.assignmentId}, ${c.classroomId}, ${c.questionIndex}
        )
        RETURNING id
      `) as { id: number }[]
      return filas[0]?.id ?? null
    } catch (error) {
      // Sin la 029 no hay dónde guardar el contexto; un id que no existe
      // (23503: un cuestionario borrado) tampoco frena el reporte.
      const code = (error as { code?: string })?.code
      if (!faltaLaMigracion(error) && code !== '23503') throw error
    }
  }
  const filas = (await sql`
    INSERT INTO feedback_reports (
      user_id, is_guest, role, description, pathname, question_id, question_type, user_agent
    ) VALUES (
      ${r.userId}, ${r.isGuest}, ${r.role}, ${r.description}, ${r.pathname}, ${r.questionId}, ${r.questionType}, ${r.userAgent}
    )
    RETURNING id
  `) as { id: number }[]
  return filas[0]?.id ?? null
}

/** Forma del SELECT del admin — DDL en scripts/019 y 029. */
interface FilaDeReporte {
  id: number
  created_at: string
  status: string
  description: string
  pathname: string | null
  question_id: string | null
  question_type: string | null
  is_guest: boolean
  role: string | null
  user_id: string | null
  nombre: string | null
  teacher_quiz_id: string | null
  assignment_id: string | null
  classroom_id: string | null
  question_index: string | null
  grupo: string | null
  cuestionario: string | null
  preguntas: Question[] | null
}

export interface ReporteParaLeer {
  id: number
  creadoEl: string
  estado: EstadoDeReporte
  texto: string
  ruta: string | null
  quien: { nombre: string | null; rol: string | null; invitado: boolean }
  dondeQuedo: {
    grupoId: number | null
    grupo: string | null
    cuestionarioId: number | null
    cuestionario: string | null
    asignacionId: number | null
    preguntaIndice: number | null
    preguntaId: string | null
    preguntaTipo: string | null
  }
  /** La pregunta tal como está guardada (si se sabe cuál es). */
  pregunta: Question | null
}

const entero = (valor: string | number | null) => (valor === null || valor === undefined ? null : Number(valor))

function aReporte(f: FilaDeReporte): ReporteParaLeer {
  const indice = entero(f.question_index)
  const preguntas = Array.isArray(f.preguntas) ? f.preguntas : []
  const porIndice = indice !== null ? preguntas[indice] : undefined
  const porId = f.question_id ? preguntas.find((p) => p?.id === f.question_id) : undefined
  // Si el índice y el id no coinciden (el docente editó el cuestionario), manda el id.
  const pregunta = porId && porIndice && porId !== porIndice ? porId : (porIndice ?? porId ?? null)
  return {
    id: Number(f.id),
    creadoEl: f.created_at,
    estado: estadoDeReporte(f.status),
    texto: f.description,
    ruta: f.pathname,
    quien: { nombre: f.nombre, rol: f.role, invitado: Boolean(f.is_guest) },
    dondeQuedo: {
      grupoId: entero(f.classroom_id),
      grupo: f.grupo,
      cuestionarioId: entero(f.teacher_quiz_id),
      cuestionario: f.cuestionario,
      asignacionId: entero(f.assignment_id),
      preguntaIndice: indice,
      preguntaId: f.question_id,
      preguntaTipo: f.question_type,
    },
    pregunta,
  }
}

/** Para /admin/reportes: todos, o los de un estado, lo más nuevo primero. */
export async function listarReportes(estado: EstadoDeReporte | null): Promise<ReporteParaLeer[]> {
  const valores = estado ? valoresDeEstado(estado) : null
  const filas = (await sql`
    WITH r AS (
      SELECT f.*,
             (to_jsonb(f) ->> 'teacher_quiz_id') AS tq,
             (to_jsonb(f) ->> 'assignment_id') AS asig,
             (to_jsonb(f) ->> 'classroom_id') AS cl,
             (to_jsonb(f) ->> 'question_index') AS qi
      FROM feedback_reports f
      WHERE ${valores}::text[] IS NULL OR f.status = ANY(${valores}::text[])
    )
    SELECT r.id, r.created_at, r.status, r.description, r.pathname, r.question_id, r.question_type,
           r.is_guest, r.role, r.user_id, u.name AS nombre,
           r.tq AS teacher_quiz_id, r.asig AS assignment_id, r.cl AS classroom_id, r.qi AS question_index,
           c.name AS grupo, q.title AS cuestionario, q.questions AS preguntas
    FROM r
    LEFT JOIN users u ON u.id = r.user_id
    LEFT JOIN classrooms c ON c.id = r.cl::int
    LEFT JOIN teacher_quizzes q ON q.id = r.tq::int
    ORDER BY r.created_at DESC
    LIMIT 300
  `) as FilaDeReporte[]
  return filas.map(aReporte)
}

/** Cuántos hay en 'nuevo' (la marca del menú del admin). */
export async function contarNuevos(): Promise<number> {
  const filas = (await sql`SELECT COUNT(*)::int AS n FROM feedback_reports WHERE status = 'nuevo'`) as { n: number }[]
  return Number(filas[0]?.n ?? 0)
}

/** Cambia el estado. Sin la 029, con el nombre que admite el CHECK de la 019. */
export async function cambiarEstadoDeReporte(id: number, estado: EstadoDeReporte): Promise<boolean> {
  try {
    const filas = (await sql`UPDATE feedback_reports SET status = ${estado} WHERE id = ${id} RETURNING id`) as { id: number }[]
    return filas.length > 0
  } catch (error) {
    if (!violaElCheck(error)) throw error
    const filas = (await sql`
      UPDATE feedback_reports SET status = ${ESTADO_SIN_LA_029[estado]} WHERE id = ${id} RETURNING id
    `) as { id: number }[]
    return filas.length > 0
  }
}

/**
 * Para la página del grupo: los reportes sin resolver de las tareas de ESE
 * docente en ESE grupo. `null` si el grupo no es del docente (la ruta responde
 * 404). Sin la 029 no hay forma de saber de qué grupo es un reporte: vacío.
 */
export async function reportesDelGrupo(docenteId: string, grupoId: number): Promise<ReporteParaLeer[] | null> {
  const grupo = await getOwnedClassroom(grupoId, docenteId)
  if (!grupo) return null
  try {
    const filas = (await sql`
      SELECT f.id, f.created_at, f.status, f.description, f.pathname, f.question_id, f.question_type,
             f.is_guest, f.role, NULL::text AS user_id, NULL::text AS nombre,
             f.teacher_quiz_id::text AS teacher_quiz_id, f.assignment_id::text AS assignment_id,
             f.classroom_id::text AS classroom_id, f.question_index::text AS question_index,
             c.name AS grupo, q.title AS cuestionario, q.questions AS preguntas
      FROM feedback_reports f
      JOIN classrooms c ON c.id = f.classroom_id AND c.teacher_id = ${docenteId}
      JOIN teacher_quizzes q ON q.id = f.teacher_quiz_id AND q.user_id = ${docenteId}
      WHERE f.classroom_id = ${grupoId}
        AND f.status NOT IN ('resuelto', 'descartado')
      ORDER BY f.created_at DESC
      LIMIT 50
    `) as FilaDeReporte[]
    // Al docente no se le dice quién reportó: el texto y la pregunta alcanzan.
    return filas.map((f) => ({ ...aReporte(f), quien: { nombre: null, rol: null, invitado: false } }))
  } catch (error) {
    if (faltaLaMigracion(error)) return []
    throw error
  }
}
