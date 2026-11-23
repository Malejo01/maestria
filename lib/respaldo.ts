/**
 * Ronda Y · Y2 — El respaldo diario desde la app (puro).
 *
 * Una segunda capa, además del `pg_dump` cifrado de GitHub Actions
 * (docs/backups.md): un cron de Vercel llama a /api/cron/respaldo, que exporta
 * las tablas críticas como JSON comprimido (gzip) a Vercel Blob privado y deja
 * los últimos 14 días. Se restaura con scripts/restaurar-respaldo.ts, sólo en
 * staging (anonimizado) o en una base nueva.
 *
 * Válvula: sin `BLOB_READ_WRITE_TOKEN` o sin `RESPALDO_SECRETO` no hace nada,
 * y /admin/salud dice qué falta.
 */
export const PREFIJO_RESPALDO = 'respaldos-json/'
export const DIAS_DE_RESPALDO = 14
export const VERSION_DEL_RESPALDO = 1

/**
 * Las tablas críticas, en el orden en que se restauran (las madres antes que
 * las hijas). Afuera, a propósito: `accounts` y `verification_tokens` (tokens
 * de Google y de ingreso: nunca en un archivo), `ai_usage_log` (el registro del
 * tope de IA), `teacher_program_uploads` (bytes de archivos que vencen solos),
 * `curriculum*` y `deployment_env`/`schema_migrations` (contenido de referencia
 * y marcas de cada base, que se cargan con sus scripts).
 */
export const TABLAS_CRITICAS = [
  'users',
  'codigos_descuento',
  'teacher_programs',
  'subjects',
  'classrooms',
  'classroom_invitations',
  'diagnosticos',
  'teacher_quizzes',
  'classroom_assignments',
  'classroom_members',
  'practicas_extra',
  'quiz_attempts',
  'quiz_answers',
  'correcciones_ensayo',
  'student_misconceptions',
  'topic_mastery',
  'rachas_alumno',
  'fichas_alumno',
  'diagnostico_resultados_impresos',
  'autodidacta_resultados',
  'autodidacta_usos',
  'codigos_descuento_usos',
  'pagos',
  'referidos',
  'feedback_reports',
  'pregunta_valoraciones',
  'informes_compartidos',
] as const

export interface Respaldo {
  version: number
  creadoEl: string
  /** El host de la base de la que salió (para no confundir respaldos). */
  origen: string
  tablas: Record<string, Record<string, unknown>[]>
}

/** Qué falta para que el respaldo corra (vacío = listo). */
export function faltaParaRespaldar(env: Record<string, string | undefined>): string[] {
  return ['BLOB_READ_WRITE_TOKEN', 'RESPALDO_SECRETO'].filter((k) => !env[k]?.trim())
}

/** El pedido trae el secreto (Vercel Cron manda `Authorization: Bearer <CRON_SECRET>`). Comparación de largo fijo. */
export function pedidoAutorizado(autorizacion: string | null, secreto: string | undefined): boolean {
  if (!secreto || !autorizacion) return false
  const esperado = `Bearer ${secreto}`
  if (autorizacion.length !== esperado.length) return false
  let distinto = 0
  for (let i = 0; i < esperado.length; i++) distinto |= autorizacion.charCodeAt(i) ^ esperado.charCodeAt(i)
  return distinto === 0
}

/** `respaldos-json/maestria-2026-11-23.json.gz` (uno por día: el del mismo día se pisa). */
export function nombreDelRespaldo(fecha: Date): string {
  return `${PREFIJO_RESPALDO}maestria-${fecha.toISOString().slice(0, 10)}.json.gz`
}

/** Los que hay que borrar: más viejos que 14 días. Nunca el más nuevo, aunque sea viejo. */
export function respaldosABorrar<B extends { pathname: string; uploadedAt: string | Date }>(blobs: readonly B[], ahora: Date, dias = DIAS_DE_RESPALDO): B[] {
  const ordenados = [...blobs].filter((b) => b.pathname.startsWith(PREFIJO_RESPALDO)).sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  const limite = ahora.getTime() - dias * 86_400_000
  return ordenados.slice(1).filter((b) => new Date(b.uploadedAt).getTime() < limite)
}

/** Un respaldo que se puede restaurar: la versión y las tablas como listas. */
export function respaldoValido(crudo: unknown): crudo is Respaldo {
  const r = crudo as Partial<Respaldo> | null
  return (
    !!r &&
    r.version === VERSION_DEL_RESPALDO &&
    typeof r.creadoEl === 'string' &&
    !!r.tablas &&
    typeof r.tablas === 'object' &&
    Object.values(r.tablas).every((filas) => Array.isArray(filas)) &&
    Array.isArray(r.tablas.users)
  )
}

/**
 * Para restaurar en STAGING: sin datos personales (CLAUDE.md: staging nunca
 * tiene datos reales). Emails `usuarioN@staging.invalid`, nombres "Usuario N",
 * sin foto; en los grupos, "Alumno N"; en los pagos, sin el id de Mercado Pago.
 */
export function anonimizarRespaldo(r: Respaldo): Respaldo {
  const numero = new Map<string, number>()
  const n = (id: unknown) => {
    const k = String(id)
    if (!numero.has(k)) numero.set(k, numero.size + 1)
    return numero.get(k)!
  }
  const tablas = { ...r.tablas }
  tablas.users = (r.tablas.users ?? []).map((u) => ({
    ...u,
    email: `usuario${n(u.id)}@staging.invalid`,
    name: `Usuario ${n(u.id)}`,
    image: null,
  }))
  if (tablas.classroom_members) tablas.classroom_members = tablas.classroom_members.map((m) => ({ ...m, display_name: `Alumno ${n(m.user_id)}` }))
  if (tablas.pagos) tablas.pagos = tablas.pagos.map((p) => ({ ...p, mp_payment_id: null, mp_preference_id: null }))
  if (tablas.feedback_reports) tablas.feedback_reports = tablas.feedback_reports.map((f) => ({ ...f, reporter_email: null }))
  return { ...r, tablas }
}

/** Cuántas filas tiene cada tabla del respaldo (para el informe y para revisar antes de restaurar). */
export function resumenDelRespaldo(r: Respaldo): { tabla: string; filas: number }[] {
  return TABLAS_CRITICAS.filter((t) => t in r.tablas).map((t) => ({ tabla: t, filas: r.tablas[t].length }))
}
