import { sql } from '@/lib/db'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import type { AvisoPendiente } from '@/lib/avisos-de-reporte'
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
  email?: string | null
  resuelto_el?: string | null
  aviso_visto_el?: string | null
  respuesta?: string | null
}

/**
 * N1: qué pasa con el aviso a quien reportó. Sólo tiene sentido en un reporte
 * resuelto; en los demás es `null`.
 */
export type EstadoDelAviso = 'visto' | 'pendiente' | 'delAdmin' | 'sinQuien' | 'sinMigracion'

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
  /** N1: el aviso a quien reportó (sólo en resueltos). */
  aviso: { estado: EstadoDelAviso; vistoEl: string | null; respuesta: string | null } | null
}

function avisoDe(f: FilaDeReporte): ReporteParaLeer['aviso'] {
  if (estadoDeReporte(f.status) !== 'resuelto') return null
  const respuesta = f.respuesta ?? null
  if (!f.user_id) return { estado: 'sinQuien', vistoEl: null, respuesta }
  if (!f.is_guest && isAdminEmail(f.email)) return { estado: 'delAdmin', vistoEl: null, respuesta }
  if (f.aviso_visto_el) return { estado: 'visto', vistoEl: f.aviso_visto_el, respuesta }
  // Con la 030, todo resuelto tiene `resuelto_el` (el backfill y el PATCH lo ponen).
  if (!f.resuelto_el) return { estado: 'sinMigracion', vistoEl: null, respuesta }
  return { estado: 'pendiente', vistoEl: null, respuesta }
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
    aviso: avisoDe(f),
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
             (to_jsonb(f) ->> 'question_index') AS qi,
             -- N1 (030). Con otro nombre: con la 030 corrida, f.* ya trae estas columnas.
             (to_jsonb(f) ->> 'resuelto_el') AS n1_resuelto_el,
             (to_jsonb(f) ->> 'aviso_visto_el') AS n1_aviso_visto_el,
             (to_jsonb(f) ->> 'respuesta') AS n1_respuesta
      FROM feedback_reports f
      WHERE ${valores}::text[] IS NULL OR f.status = ANY(${valores}::text[])
    )
    SELECT r.id, r.created_at, r.status, r.description, r.pathname, r.question_id, r.question_type,
           r.is_guest, r.role, r.user_id, u.name AS nombre, u.email AS email,
           r.n1_resuelto_el AS resuelto_el, r.n1_aviso_visto_el AS aviso_visto_el, r.n1_respuesta AS respuesta,
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

export interface OpcionesDeResolucion {
  /** N1: lo que el admin le contesta a quien reportó (null = texto por defecto). */
  mensaje?: string | null
  /** N1: el nombre de pila del admin ("Mauro te dejó un mensaje"). */
  respondidoPor?: string | null
}

/**
 * Cambia el estado. Con la 030 (N1), pasar a 'resuelto' guarda cuándo y el
 * mensaje para quien reportó, y deja el aviso pendiente; volver a 'nuevo' o
 * 'visto' limpia `resuelto_el` y `aviso_visto_el` (si se vuelve a resolver,
 * el aviso sale otra vez). Sin la 030, como en M6; sin la 029, con el nombre
 * que admite el CHECK de la 019.
 */
export async function cambiarEstadoDeReporte(
  id: number,
  estado: EstadoDeReporte,
  opciones: OpcionesDeResolucion = {},
): Promise<boolean> {
  try {
    const filas = (
      estado === 'resuelto'
        ? await sql`
            UPDATE feedback_reports
            SET status = ${estado}, resuelto_el = NOW(), aviso_visto_el = NULL,
                respuesta = ${opciones.mensaje ?? null}, respondido_por = ${opciones.respondidoPor ?? null}
            WHERE id = ${id}
            RETURNING id
          `
        : await sql`
            UPDATE feedback_reports
            SET status = ${estado}, resuelto_el = NULL, aviso_visto_el = NULL
            WHERE id = ${id}
            RETURNING id
          `
    ) as { id: number }[]
    return filas.length > 0
  } catch (error) {
    // Sin la 030 no están las columnas del aviso: el cambio de estado de M6.
    if (!faltaLaMigracion(error) && !violaElCheck(error)) throw error
  }
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
 * N1: los reportes resueltos de ESTE usuario cuyo aviso todavía no vio. La
 * consulta filtra por `user_id` del viewer (nunca de algo que mande el
 * cliente). Sin la 030, vacío: no hay aviso y nada da 500.
 */
export async function avisosPendientes(userId: string): Promise<AvisoPendiente[]> {
  try {
    const filas = (await sql`
      SELECT f.id, f.created_at, f.respuesta, f.respondido_por, q.title AS cuestionario
      FROM feedback_reports f
      LEFT JOIN teacher_quizzes q ON q.id = (to_jsonb(f) ->> 'teacher_quiz_id')::int
      WHERE f.user_id = ${userId}
        AND f.status = 'resuelto'
        AND f.resuelto_el IS NOT NULL
        AND f.aviso_visto_el IS NULL
      ORDER BY f.created_at
      LIMIT 20
    `) as { id: number; created_at: string | Date; respuesta: string | null; respondido_por: string | null; cuestionario: string | null }[]
    return filas.map((f) => ({
      id: Number(f.id),
      reportadoEl: f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at),
      cuestionario: f.cuestionario ?? null,
      respuesta: f.respuesta ?? null,
      respondidoPor: f.respondido_por ?? null,
    }))
  } catch (error) {
    if (faltaLaMigracion(error)) return []
    throw error
  }
}

/**
 * N1: "Entendido". Sólo marca reportes del propio usuario, resueltos y con el
 * aviso pendiente: un id ajeno no se toca. Devuelve cuántos marcó.
 */
export async function marcarAvisosVistos(userId: string, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0
  try {
    const filas = (await sql`
      UPDATE feedback_reports
      SET aviso_visto_el = NOW()
      WHERE id = ANY(${ids}::int[])
        AND user_id = ${userId}
        AND status = 'resuelto'
        AND aviso_visto_el IS NULL
      RETURNING id
    `) as { id: number }[]
    return filas.length
  } catch (error) {
    if (faltaLaMigracion(error)) return 0
    throw error
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

export interface ReportePropio {
  id: number
  descripcion: string
  reportadoEl: string
  cuestionario: string | null
  resueltoEl: string | null
  respuesta: string | null
  respondidoPor: string | null
}

/**
 * P3: un reporte de ESTE usuario, para la página a la que lleva "Tu reporte se
 * resolvió". `null` si no existe o es de otro: la página responde 404 (no se
 * confirma que exista un reporte ajeno). Sin la 030, sin respuesta.
 */
export async function reportePropio(userId: string, id: number): Promise<ReportePropio | null> {
  const filas = (await sql`
    SELECT f.id, f.description, f.created_at, to_jsonb(f) AS crudo, q.title AS cuestionario
    FROM feedback_reports f
    LEFT JOIN teacher_quizzes q ON q.id = (to_jsonb(f) ->> 'teacher_quiz_id')::int
    WHERE f.id = ${id} AND f.user_id = ${userId}
  `) as { id: number; description: string; created_at: string | Date; crudo: Record<string, unknown>; cuestionario: string | null }[]
  const f = filas[0]
  if (!f) return null
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  return {
    id: Number(f.id),
    descripcion: f.description,
    reportadoEl: new Date(f.created_at).toISOString(),
    cuestionario: f.cuestionario ?? null,
    resueltoEl: texto(f.crudo.resuelto_el) ? new Date(String(f.crudo.resuelto_el)).toISOString() : null,
    respuesta: texto(f.crudo.respuesta),
    respondidoPor: texto(f.crudo.respondido_por),
  }
}
