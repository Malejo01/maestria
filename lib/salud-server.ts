import { sql } from '@/lib/db'
import { alertasDelSistema, MINUTOS_COLGADA, type AlertaDelSistema, type CuentaDeGeneraciones, type PagoARevisar } from '@/lib/salud'

/**
 * Ronda Y · Y1 — Lo que lee /admin/salud. Cada parte tiene su válvula: sin la
 * 049 no hay tasa de descarte; sin la 039 no hay pagos; sin token de Sentry,
 * un link. Nada de esto escribe.
 */
const ENDPOINTS_DE_GENERACION = ['quiz_generation', 'autodidacta']
const falta = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')

async function generaciones(horas: number): Promise<CuentaDeGeneraciones> {
  try {
    const [f] = (await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'error' OR (status = 'pending' AND created_at < NOW() - make_interval(mins => ${MINUTOS_COLGADA})))::int AS fallidas,
             SUM(preguntas_crudas)::int AS crudas, SUM(preguntas_descartadas)::int AS descartadas
      FROM ai_usage_log
      WHERE endpoint = ANY(${ENDPOINTS_DE_GENERACION}) AND created_at > NOW() - make_interval(hours => ${horas})
    `) as { total: number; fallidas: number; crudas: number | null; descartadas: number | null }[]
    return { total: f.total, fallidas: f.fallidas, crudas: f.crudas ?? null, descartadas: f.descartadas ?? null }
  } catch (error) {
    if (!falta(error)) throw error
    // Sin la 049: lo mismo, sin las columnas de preguntas.
    const [f] = (await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'error' OR (status = 'pending' AND created_at < NOW() - make_interval(mins => ${MINUTOS_COLGADA})))::int AS fallidas
      FROM ai_usage_log
      WHERE endpoint = ANY(${ENDPOINTS_DE_GENERACION}) AND created_at > NOW() - make_interval(hours => ${horas})
    `) as { total: number; fallidas: number }[]
    return { total: f.total, fallidas: f.fallidas, crudas: null, descartadas: null }
  }
}

/** Las generaciones de la última hora (para la alerta). */
export const generacionesDeLaUltimaHora = () => generaciones(1)

async function gasto(): Promise<{ hoyUsd: number; mesUsd: number; porEndpoint: { endpoint: string; llamadas: number; fallidas: number; usd: number }[] }> {
  const [g] = (await sql`
    SELECT COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires'), 0)::float AS hoy,
           COALESCE(SUM(estimated_cost_usd), 0)::float AS mes
    FROM ai_usage_log
    WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires'
  `) as { hoy: number; mes: number }[]
  const porEndpoint = (await sql`
    SELECT endpoint, COUNT(*)::int AS llamadas, COUNT(*) FILTER (WHERE status = 'error')::int AS fallidas, COALESCE(SUM(estimated_cost_usd), 0)::float AS usd
    FROM ai_usage_log WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY endpoint ORDER BY llamadas DESC
  `) as { endpoint: string; llamadas: number; fallidas: number; usd: number }[]
  return { hoyUsd: g.hoy, mesUsd: g.mes, porEndpoint }
}

/** Los pagos para revisar (sin la 039, ninguno). */
export async function pagosARevisar(): Promise<PagoARevisar[] | null> {
  try {
    const filas = (await sql`
      SELECT p.id, p.monto, p.mp_payment_id, p.detalle ->> 'revisar' AS revisar, p.actualizado_el,
             COALESCE(u.name, u.email, p.user_id) AS docente
      FROM pagos p LEFT JOIN users u ON u.id = p.user_id
      WHERE p.estado = 'pendiente' AND (p.mp_payment_id IS NOT NULL OR p.detalle ? 'revisar')
      ORDER BY p.actualizado_el DESC
      LIMIT 20
    `) as { id: number; monto: number; revisar: string | null; actualizado_el: string | Date; docente: string }[]
    return filas.map((f) => ({
      id: Number(f.id),
      docente: String(f.docente),
      monto: Number(f.monto),
      motivo: f.revisar === 'montoDistinto' ? 'montoDistinto' : 'pendienteEnMercadoPago',
      desde: new Date(f.actualizado_el).toISOString(),
    }))
  } catch (error) {
    if (falta(error)) return null
    throw error
  }
}

async function pagosSinPagar(): Promise<number | null> {
  try {
    const [f] = (await sql`
      SELECT COUNT(*)::int AS n FROM pagos WHERE estado = 'pendiente' AND mp_payment_id IS NULL AND creado_el > NOW() - INTERVAL '7 days'
    `) as { n: number }[]
    return f.n
  } catch (error) {
    if (falta(error)) return null
    throw error
  }
}

export interface ErrorReciente {
  titulo: string
  veces: number
  ultimaVez: string
  link: string
}

/**
 * Los errores sin resolver de las últimas 24 h, si hay un token de lectura de
 * Sentry (`SENTRY_API_TOKEN`, con `project:read`). Sin token, o si Sentry no
 * responde, sólo el link al panel.
 */
async function erroresRecientes(): Promise<{ errores: ErrorReciente[] | null; link: string }> {
  const org = process.env.SENTRY_ORG?.trim()
  const proyecto = process.env.SENTRY_PROJECT?.trim()
  const link = org ? `https://${org}.sentry.io/issues/${proyecto ? `?project=${encodeURIComponent(proyecto)}` : ''}` : 'https://sentry.io/issues/'
  const token = process.env.SENTRY_API_TOKEN?.trim()
  if (!token || !org || !proyecto) return { errores: null, link }
  try {
    const res = await fetch(`https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(proyecto)}/issues/?statsPeriod=24h&query=is:unresolved&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 300 },
    })
    if (!res.ok) return { errores: null, link }
    const issues = (await res.json()) as { title?: string; count?: string; lastSeen?: string; permalink?: string }[]
    return {
      errores: issues.map((i) => ({ titulo: String(i.title ?? ''), veces: Number(i.count ?? 0), ultimaVez: String(i.lastSeen ?? ''), link: String(i.permalink ?? link) })),
      link,
    }
  } catch {
    return { errores: null, link }
  }
}

export async function leerSalud() {
  const [dia, hora, ia, pagos, sinPagar, sentry] = await Promise.all([
    generaciones(24),
    generaciones(1),
    gasto(),
    pagosARevisar(),
    pagosSinPagar(),
    erroresRecientes(),
  ])
  return { dia, hora, ia, pagos, sinPagar, sentry }
}

export type Salud = Awaited<ReturnType<typeof leerSalud>>

/** Las alertas de ahora (para la portada del admin y su campanita). */
export async function alertasActuales(ahora = new Date()): Promise<AlertaDelSistema[]> {
  const [ultimaHora, pagos] = await Promise.all([generaciones(1), pagosARevisar()])
  return alertasDelSistema({ ultimaHora, pagos: pagos ?? [], ahora })
}
