/**
 * Punto único por el que pasa toda llamada a Gemini.
 *
 * Une las barreras que protegen la factura, en orden de menor a mayor costo de
 * evaluación: identidad → presupuesto global → sub-tope de invitados → límite
 * por usuario.
 * Un handler queda así:
 *
 *   const guard = await guardAiCall({ bucket: 'feedback', nivel })
 *   if (!guard.ok) return guard.response
 *   try {
 *     const result = await generateText({ ... })
 *     await guard.finish(result.usage)
 *   } catch (error) {
 *     await guard.fail()
 *     throw error
 *   }
 *
 * `finish`/`fail` nunca lanzan: un problema de bookkeeping no debería tumbar
 * una generación que salió bien.
 */
import { getViewer, type Viewer } from '@/lib/auth-session'
import {
  evaluateAiRateLimit,
  isAdminEmail,
  rateLimitMessage,
  type AiActor,
  type AiBucket,
} from '@/lib/ai-rate-limit'
import {
  dailyBudgetUsd,
  failAiUsage,
  finishAiUsage,
  guestDailyBudgetUsd,
  readDailySpend,
  readUsageWindow,
  startAiUsage,
  type AiSdkUsage,
  type DailySpend,
} from '@/lib/ai-usage'
import { captureAiBudgetCutoff } from '@/lib/observability'

export const DEFAULT_AI_MODEL = 'gemini-2.5-flash'

export interface AiGuardGranted {
  ok: true
  viewer: Viewer
  actor: AiActor
  /** Cierra la fila de uso con los tokens reales. Idempotente ante usage nulo. */
  finish: (usage?: AiSdkUsage | null) => Promise<void>
  /** Marca el intento como fallido; la fila igual cuenta contra el límite. */
  fail: () => Promise<void>
}

export type AiGuardResult = AiGuardGranted | { ok: false; response: Response }

export interface GuardAiCallOptions {
  bucket: AiBucket
  model?: string
  /** Ajusta el tono del mensaje de corte (primaria recibe otro registro). */
  nivel?: string | null
  /**
   * Rol efectivo, cuando el handler ya lo verificó por su cuenta. Las rutas de
   * docente lo pasan explícito porque el rol del JWT puede estar desactualizado
   * y no queremos que un docente recién promovido choque contra el 0 de alumno.
   */
  actor?: Exclude<AiActor, 'admin'>
  /**
   * Forma del cuerpo de error. generate-quiz responde `{ questions: [], ... }`
   * porque su cliente espera siempre esa clave.
   */
  errorBody?: (message: string) => Record<string, unknown>
}

/**
 * El gasto del día cambia despacio y se consulta en cada llamada, así que se
 * cachea por instancia de lambda. El precio de la caché es sobrepasar el
 * presupuesto por lo que se gaste en un minuto — muy por debajo del margen de
 * error del propio estimado, que no cuenta thinking tokens.
 */
const SPEND_CACHE_MS = 60_000
let spendCache: { value: DailySpend; at: number } | null = null

async function dailySpendCached(): Promise<DailySpend> {
  const now = Date.now()
  if (spendCache && now - spendCache.at < SPEND_CACHE_MS) return spendCache.value

  const value = await readDailySpend()
  spendCache = { value, at: now }
  return value
}

/** Para tests y para forzar una relectura después de un cambio de presupuesto. */
export function resetDailySpendCache(): void {
  spendCache = null
}

function resolveActor(viewer: Viewer, override?: Exclude<AiActor, 'admin'>): AiActor {
  if (isAdminEmail(viewer.email)) return 'admin'
  if (override) return override
  if (viewer.isGuest) return 'guest'
  return viewer.role === 'DOCENTE' ? 'docente' : 'alumno'
}

function jsonError(
  message: string,
  status: number,
  extra: Record<string, unknown>,
  headers?: Record<string, string>
): Response {
  return Response.json({ error: message, ...extra }, { status, headers })
}

export async function guardAiCall(options: GuardAiCallOptions): Promise<AiGuardResult> {
  const { bucket, model = DEFAULT_AI_MODEL, nivel, errorBody } = options
  const extra = (message: string) => (errorBody ? errorBody(message) : {})

  const viewer = await getViewer()
  if (!viewer) {
    return {
      ok: false,
      response: jsonError(
        'Necesitás iniciar sesión (o entrar a un aula con tu código) para usar esta función.',
        401,
        extra('unauthenticated')
      ),
    }
  }

  const actor = resolveActor(viewer, options.actor)

  // El kill switch va antes que el límite por usuario y no lo saltea nadie,
  // ni siquiera la allowlist de admin: acá el objetivo es la factura, no el
  // abuso individual.
  const budget = dailyBudgetUsd()
  const spent = await dailySpendCached()
  if (spent.totalUsd >= budget) {
    captureAiBudgetCutoff({ pool: 'global', bucket, spentUsd: spent.totalUsd, budgetUsd: budget })
    return {
      ok: false,
      response: jsonError(
        'La generación con IA está pausada por hoy porque se alcanzó el presupuesto diario. Volvé mañana y va a estar disponible de nuevo.',
        503,
        { ...extra('budget_exhausted'), budgetExhausted: true },
        { 'Retry-After': '3600' }
      ),
    }
  }

  // Sub-tope de invitados: va después del global (que corta a todos y tiene
  // prioridad en el mensaje) y antes del límite por usuario, que para un
  // invitado no acota nada — fabricar otro invitado es gratis. Se decide por
  // `viewer.isGuest` y no por el actor, porque es la misma columna que suma
  // `readDailySpend`: si el guard y la suma no miran lo mismo, el tope no
  // corta a quien lo gastó.
  if (viewer.isGuest) {
    const guestBudget = guestDailyBudgetUsd()
    if (spent.guestUsd >= guestBudget) {
      captureAiBudgetCutoff({ pool: 'guest', bucket, spentUsd: spent.guestUsd, budgetUsd: guestBudget })
      const message =
        'La práctica con IA para invitados llegó al límite de hoy. No hiciste nada mal: ingresá con tu cuenta de Google para seguir, o volvé a probar mañana.'
      return {
        ok: false,
        response: jsonError(
          message,
          429,
          { ...extra(message), rateLimited: true, guestBudgetExhausted: true },
          { 'Retry-After': '3600' }
        ),
      }
    }
  }

  const window = await readUsageWindow(viewer.id, bucket)
  const decision = evaluateAiRateLimit({
    bucket,
    actor,
    usedInDay: window.usedInDay,
    usedInHour: window.usedInHour,
    oldestInDay: window.oldestInDay,
    oldestInHour: window.oldestInHour,
  })

  if (!decision.allowed) {
    const message = rateLimitMessage(decision, { actor, nivel })
    const status = decision.reason === 'blocked_for_role' ? 403 : 429

    return {
      ok: false,
      response: jsonError(
        message,
        status,
        {
          ...extra(message),
          rateLimited: status === 429,
          // El cliente viejo de generate-quiz leía esta clave; se mantiene para
          // no romper builds desplegados mientras rota la caché de Vercel.
          guestLimitReached: status === 429 && actor === 'guest',
          retryAfterSeconds: decision.retryAfterSeconds,
        },
        status === 429 ? { 'Retry-After': String(decision.retryAfterSeconds) } : undefined
      ),
    }
  }

  const usageId = await startAiUsage({
    userId: viewer.id,
    isGuest: viewer.isGuest,
    bucket,
    model,
  })

  return {
    ok: true,
    viewer,
    actor,
    finish: async (usage) => {
      const cost = await finishAiUsage(usageId, { model, usage })
      // Sumar el costo recién medido mantiene la caché caliente y aproximada,
      // en vez de invalidarla y forzar un SELECT en cada request — que era
      // justo lo que la caché venía a evitar.
      if (cost != null && spendCache) {
        spendCache.value.totalUsd += cost
        if (viewer.isGuest) spendCache.value.guestUsd += cost
      }
    },
    fail: async () => {
      await failAiUsage(usageId)
    },
  }
}
