/**
 * Persistencia del uso de IA: precios, conteo por ventana deslizante y el par
 * insert/update que envuelve cada llamada a Gemini.
 *
 * Una fila de `ai_usage_log` por llamada sirve para las dos cosas que necesita
 * el proyecto: contar (rate limiting) y sumar (dashboard de costo). La fila se
 * escribe ANTES de llamar al modelo y se completa después — ese orden es lo que
 * evita que dos requests simultáneos pasen el mismo chequeo, y hace que una
 * llamada que explota a mitad de camino igual quede contabilizada. Gemini
 * factura el intento aunque el parseo falle del lado nuestro.
 */
import { sql } from '@/lib/db'
import type { AiBucket } from '@/lib/ai-rate-limit'

/**
 * USD por millón de tokens. Verificado contra la tarifa pública de la API de
 * Gemini en agosto de 2026; si Google la cambia, este objeto es el único lugar
 * que hay que tocar. Ojo: en los modelos 2.5 los "thinking tokens" se facturan
 * como salida, así que el costo real puede superar al estimado en prompts que
 * razonan mucho. Preferimos subestimar acá y que el kill switch de presupuesto
 * (que mira el total, no la llamada) sea la red de contención.
 */
export const MODEL_PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.15, output: 1.25 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4 },
  // Tarifa estándar pública verificada el 30/09/2026 (entrada de texto).
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
}

const FALLBACK_PRICING = MODEL_PRICING_USD_PER_MTOK['gemini-2.5-flash']

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK[model] ?? FALLBACK_PRICING
  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
  // La columna es NUMERIC(12,6); redondear acá evita que Postgres lo haga por
  // su cuenta y que el total del dashboard no cierre con la suma de las filas.
  return Math.round(cost * 1_000_000) / 1_000_000
}

/**
 * Presupuesto diario de todo el proyecto. Es la única protección contra el
 * escenario que los límites por usuario no cubren: muchos usuarios legítimos
 * de golpe. Configurable por env para poder subirlo sin redeploy.
 */
export const DEFAULT_DAILY_BUDGET_USD = 15

export function dailyBudgetUsd(): number {
  const raw = Number(process.env.AI_DAILY_BUDGET_USD)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_BUDGET_USD
}

/**
 * Sub-tope para invitados DENTRO del presupuesto global, no una bolsa aparte:
 * lo que gastan los invitados sigue sumando al total, pero ellos se cortan
 * mucho antes de que el total se acerque al global.
 *
 * Existe porque crear un invitado es gratis (basta un código de aula y un
 * nombre), así que el límite por usuario no acota nada: cada invitado nuevo
 * trae su cupo limpio. Sin este sub-tope, un script que fabrica invitados
 * agota el global en minutos, y el global corta también a los alumnos
 * logueados en medio de una clase. Con él, lo peor que puede hacer un abuso
 * anónimo es dejar sin IA a los demás invitados.
 *
 * Si se configura por encima del global deja de servir como sub-tope; el
 * global sigue cortando igual.
 */
export const DEFAULT_GUEST_DAILY_BUDGET_USD = 3

export function guestDailyBudgetUsd(): number {
  const raw = Number(process.env.AI_GUEST_DAILY_BUDGET_USD)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_GUEST_DAILY_BUDGET_USD
}

export interface UsageWindow {
  usedInDay: number
  usedInHour: number
  oldestInDay: Date | null
  oldestInHour: Date | null
}

/**
 * Cuenta lo consumido por un usuario en un bucket. Las dos ventanas salen en
 * una sola consulta: son el mismo scan de índice y el round trip a Neon es lo
 * caro, no el filtro.
 */
export async function readUsageWindow(userId: string, bucket: AiBucket): Promise<UsageWindow> {
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS used_in_day,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS used_in_hour,
      MIN(created_at) AS oldest_in_day,
      MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS oldest_in_hour
    FROM ai_usage_log
    WHERE user_id = ${userId}
      AND endpoint = ${bucket}
      AND created_at > NOW() - INTERVAL '24 hours'
  `) as {
    used_in_day: number
    used_in_hour: number
    oldest_in_day: string | Date | null
    oldest_in_hour: string | Date | null
  }[]

  const row = rows[0]
  const toDate = (value: string | Date | null | undefined) => (value ? new Date(value) : null)

  return {
    usedInDay: Number(row?.used_in_day ?? 0),
    usedInHour: Number(row?.used_in_hour ?? 0),
    oldestInDay: toDate(row?.oldest_in_day),
    oldestInHour: toDate(row?.oldest_in_hour),
  }
}

export interface DailySpend {
  totalUsd: number
  /** La parte del total que gastaron invitados. */
  guestUsd: number
}

/**
 * Gasto estimado en la ventana deslizante de 24 h, para el kill switch y el
 * sub-tope de invitados. Las dos sumas salen del mismo scan. Los `::float8`
 * no son decorativos: sin ellos Neon devuelve el NUMERIC como string.
 */
export async function readDailySpend(): Promise<DailySpend> {
  const rows = (await sql`
    SELECT
      COALESCE(SUM(estimated_cost_usd), 0)::float8 AS spent,
      COALESCE(SUM(estimated_cost_usd) FILTER (WHERE is_guest), 0)::float8 AS guest_spent
    FROM ai_usage_log
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `) as { spent: number; guest_spent: number }[]

  return {
    totalUsd: Number(rows[0]?.spent ?? 0),
    guestUsd: Number(rows[0]?.guest_spent ?? 0),
  }
}

// ─── Agregados para el dashboard interno ────────────────────────────────────

export interface DailySpendRow {
  day: string
  /**
   * Días transcurridos, calculado por Postgres. La posición en el array no
   * sirve para etiquetar "Hoy": un día sin ninguna llamada no genera fila, y
   * la primera pasaría a mentir.
   */
  daysAgo: number
  calls: number
  costUsd: number
  errors: number
}

export interface GroupedSpendRow {
  key: string
  calls: number
  costUsd: number
  inputTokens: number
  outputTokens: number
  errors: number
}

export interface AiUsageReport {
  spendTodayUsd: number
  spendWeekUsd: number
  spendMonthUsd: number
  callsToday: number
  budgetUsd: number
  /** Filas anteriores a la migración 016: cuentan como llamada, no como costo. */
  unpricedCalls: number
  daily: DailySpendRow[]
  byEndpoint: GroupedSpendRow[]
  byModel: GroupedSpendRow[]
}

/**
 * Todo lo que muestra `/admin/ai-usage`, en cuatro consultas paralelas.
 *
 * `estimated_cost_usd` es NULL en las filas que quedaron de antes de la 016 y
 * en las que fallaron sin reportar tokens. Se suman como 0 pero se cuentan
 * aparte en `unpricedCalls`, para que el número de la pantalla no aparente una
 * precisión que no tiene.
 */
export async function readAiUsageReport(): Promise<AiUsageReport> {
  const [totals, daily, byEndpoint, byModel] = await Promise.all([
    sql`
      SELECT
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours'), 0)::float8 AS today,
        COALESCE(SUM(estimated_cost_usd) FILTER (WHERE created_at > NOW() - INTERVAL '7 days'), 0)::float8 AS week,
        COALESCE(SUM(estimated_cost_usd), 0)::float8 AS month,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS calls_today,
        COUNT(*) FILTER (WHERE estimated_cost_usd IS NULL)::int AS unpriced
      FROM ai_usage_log
      WHERE created_at > NOW() - INTERVAL '30 days'
    `,
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        -- Calculado por Postgres para que "Hoy" no dependa del huso horario
        -- del server que renderiza ni de la posición de la fila en el array.
        (CURRENT_DATE - DATE_TRUNC('day', created_at)::date)::int AS days_ago,
        COUNT(*)::int AS calls,
        COALESCE(SUM(estimated_cost_usd), 0)::float8 AS cost,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors
      FROM ai_usage_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1, 2
      ORDER BY 1 DESC
    `,
    sql`
      SELECT
        endpoint AS key,
        COUNT(*)::int AS calls,
        COALESCE(SUM(estimated_cost_usd), 0)::float8 AS cost,
        COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors
      FROM ai_usage_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY cost DESC
    `,
    sql`
      SELECT
        model AS key,
        COUNT(*)::int AS calls,
        COALESCE(SUM(estimated_cost_usd), 0)::float8 AS cost,
        COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COUNT(*) FILTER (WHERE status = 'error')::int AS errors
      FROM ai_usage_log
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY cost DESC
    `,
  ])

  const totalsRow = (totals as any[])[0] ?? {}
  const toGrouped = (rows: any[]): GroupedSpendRow[] =>
    rows.map((row) => ({
      key: String(row.key),
      calls: Number(row.calls),
      costUsd: Number(row.cost),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      errors: Number(row.errors),
    }))

  return {
    spendTodayUsd: Number(totalsRow.today ?? 0),
    spendWeekUsd: Number(totalsRow.week ?? 0),
    spendMonthUsd: Number(totalsRow.month ?? 0),
    callsToday: Number(totalsRow.calls_today ?? 0),
    unpricedCalls: Number(totalsRow.unpriced ?? 0),
    budgetUsd: dailyBudgetUsd(),
    daily: (daily as any[]).map((row) => ({
      day: String(row.day),
      daysAgo: Number(row.days_ago),
      calls: Number(row.calls),
      costUsd: Number(row.cost),
      errors: Number(row.errors),
    })),
    byEndpoint: toGrouped(byEndpoint as any[]),
    byModel: toGrouped(byModel as any[]),
  }
}

/**
 * Reserva la fila antes de llamar al modelo. Devuelve el id para completarla
 * después, o null si la escritura falló: en ese caso la llamada sigue adelante
 * sin registro. Es una decisión consciente — un problema de bookkeeping no
 * debería dejar sin practicar a un alumno — y el kill switch global sigue
 * cubriendo el peor caso.
 */
export async function startAiUsage(params: {
  userId: string
  isGuest: boolean
  bucket: AiBucket
  model: string
}): Promise<number | null> {
  try {
    const rows = (await sql`
      INSERT INTO ai_usage_log (user_id, is_guest, endpoint, model, status, created_at)
      VALUES (${params.userId}, ${params.isGuest}, ${params.bucket}, ${params.model}, 'pending', NOW())
      RETURNING id
    `) as { id: number }[]

    return rows[0]?.id ?? null
  } catch (error) {
    console.error('[ai-usage] no se pudo reservar la fila de uso', error)
    return null
  }
}

/**
 * Forma del `usage` que devuelven generateObject/generateText en el AI SDK v6.
 * Los campos son opcionales porque el proveedor puede no reportarlos.
 */
export interface AiSdkUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

/**
 * Acumulador para los handlers que hacen varias llamadas por request (
 * generate-quiz reintenta hasta tres veces y el modo mixto genera dos tandas).
 * El rate limit cuenta la request, pero el costo tiene que sumar todo lo que
 * realmente se le pidió al modelo.
 */
export function sumUsage(...parts: (AiSdkUsage | null | undefined)[]): AiSdkUsage {
  let inputTokens = 0
  let outputTokens = 0

  for (const part of parts) {
    inputTokens += part?.inputTokens ?? 0
    outputTokens += part?.outputTokens ?? 0
  }

  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens }
}

/**
 * Cierra la fila con los tokens reales y devuelve el costo estimado (null si el
 * proveedor no reportó tokens), para que el llamador pueda mantener al día su
 * acumulado sin volver a consultar la base. Nunca lanza.
 */
export async function finishAiUsage(
  usageId: number | null,
  params: { model: string; usage?: AiSdkUsage | null }
): Promise<number | null> {
  if (usageId == null) return null

  const inputTokens = params.usage?.inputTokens ?? null
  const outputTokens = params.usage?.outputTokens ?? null
  const cost =
    inputTokens != null && outputTokens != null
      ? estimateCostUsd(params.model, inputTokens, outputTokens)
      : null

  try {
    await sql`
      UPDATE ai_usage_log
      SET status = 'ok',
          input_tokens = ${inputTokens},
          output_tokens = ${outputTokens},
          estimated_cost_usd = ${cost}
      WHERE id = ${usageId}
    `
  } catch (error) {
    console.error('[ai-usage] no se pudo cerrar la fila de uso', error)
  }

  return cost
}

/**
 * Marca la llamada como fallida. La fila se conserva y sigue contando contra el
 * límite: el intento igual se facturó del lado de Google.
 */
export async function failAiUsage(usageId: number | null): Promise<void> {
  if (usageId == null) return

  try {
    await sql`UPDATE ai_usage_log SET status = 'error' WHERE id = ${usageId}`
  } catch (error) {
    console.error('[ai-usage] no se pudo marcar la fila como fallida', error)
  }
}
