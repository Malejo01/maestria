/**
 * El guard contra un libro de gastos en memoria que contesta las mismas
 * consultas que `ai_usage_log`, con la forma en que las devuelve Neon: los
 * `::float8` y `::int` llegan como número, los timestamps como string. Se
 * verificó contra la base real — un `NUMERIC` sin cast llega como "0", no
 * como 0, y un doble que devolviera números donde Postgres devuelve strings
 * probaría un código que no es el que corre.
 *
 * El escenario que importa no es una llamada suelta sino la secuencia: alguien
 * fabrica invitados (cada uno con su cupo por usuario limpio) y genera hasta
 * que algo lo frena. Sin sub-tope de invitados, lo único que lo frena es el
 * presupuesto global, y para entonces el global también corta a los alumnos
 * logueados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface LedgerRow {
  id: number
  userId: string
  isGuest: boolean
  endpoint: string
  cost: number | null
  createdAt: Date
}

const { state, sqlMock, getViewerMock, captureAiBudgetCutoff } = vi.hoisted(() => {
  const state = { rows: [] as LedgerRow[], nextId: 1 }

  /**
   * Reconoce cada consulta por un fragmento estable de su texto. Si el código
   * manda una consulta que este doble no conoce, el test explota en vez de
   * devolver un `[]` que el código interpretaría como "sin uso".
   */
  const sqlMock = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')

    if (text.includes('INSERT INTO ai_usage_log')) {
      const [userId, isGuest, endpoint] = values as [string, boolean, string]
      const row: LedgerRow = { id: state.nextId++, userId, isGuest, endpoint, cost: null, createdAt: new Date() }
      state.rows.push(row)
      return [{ id: row.id }]
    }

    if (text.includes("SET status = 'ok'")) {
      const cost = values[2] as number | null
      const id = values[3] as number
      const row = state.rows.find((r) => r.id === id)
      if (row) row.cost = cost
      return []
    }

    if (text.includes("SET status = 'error'")) return []

    if (text.includes('SUM(estimated_cost_usd)')) {
      const sum = (rows: LedgerRow[]) => rows.reduce((acc, r) => acc + (r.cost ?? 0), 0)
      return [
        {
          spent: sum(state.rows),
          guest_spent: sum(state.rows.filter((r) => r.isGuest)),
        },
      ]
    }

    if (text.includes('used_in_day')) {
      const [userId, endpoint] = values as [string, string]
      const mine = state.rows.filter((r) => r.userId === userId && r.endpoint === endpoint)
      const oldest = mine[0]?.createdAt.toISOString() ?? null
      return [{ used_in_day: mine.length, used_in_hour: mine.length, oldest_in_day: oldest, oldest_in_hour: oldest }]
    }

    throw new Error(`Consulta no reconocida por el doble de ai_usage_log: ${text}`)
  }

  return { state, sqlMock, getViewerMock: vi.fn(), captureAiBudgetCutoff: vi.fn() }
})

vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getViewer: getViewerMock }))
vi.mock('@/lib/observability', () => ({ captureAiBudgetCutoff }))

import { guardAiCall, resetDailySpendCache } from '@/lib/ai-guard'
import { DEFAULT_GUEST_DAILY_BUDGET_USD, guestDailyBudgetUsd } from '@/lib/ai-usage'

/** Tokens que dan $0,0111 en gemini-2.5-flash: el promedio medido en producción. */
const AVERAGE_GENERATION = { inputTokens: 4000, outputTokens: 8400 }

function guest(n: number) {
  return { id: `guest_${n}`, role: 'ALUMNO' as const, isGuest: true, displayName: `Invitado ${n}`, email: null }
}

const ALUMNO = { id: '1077', role: 'ALUMNO' as const, isGuest: false, displayName: 'Alumna', email: 'alumna@example.com' }

async function generateAs(viewer: ReturnType<typeof guest> | typeof ALUMNO) {
  getViewerMock.mockResolvedValue(viewer)
  const guard = await guardAiCall({ bucket: 'quiz_generation' })
  if (guard.ok) await guard.finish(AVERAGE_GENERATION)
  return guard
}

const ENV_KEYS = ['AI_DAILY_BUDGET_USD', 'AI_GUEST_DAILY_BUDGET_USD', 'ADMIN_EMAILS'] as const
let savedEnv: Record<string, string | undefined>

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
  state.rows = []
  state.nextId = 1
  resetDailySpendCache()
  getViewerMock.mockReset()
  captureAiBudgetCutoff.mockReset()
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('presupuesto de invitados', () => {
  it('invitados fabricados en serie se quedan sin presupuesto y un alumno logueado sigue generando', async () => {
    let blockedGuest: Awaited<ReturnType<typeof guardAiCall>> | null = null

    // Cada invitado nuevo trae su cupo por usuario limpio: es exactamente lo
    // que se consigue repitiendo POST /api/classrooms/join sin cookie.
    for (let n = 0; n < 1000 && !blockedGuest; n += 1) {
      for (let call = 0; call < 3; call += 1) {
        const guard = await generateAs(guest(n))
        if (!guard.ok) {
          blockedGuest = guard
          break
        }
      }
    }

    expect(blockedGuest).not.toBeNull()

    const alumno = await generateAs(ALUMNO)
    expect(alumno.ok).toBe(true)

    // El corte es del sub-tope de invitados, no del global: el gasto total
    // quedó lejos de los $15.
    const total = state.rows.reduce((acc, r) => acc + (r.cost ?? 0), 0)
    expect(total).toBeLessThan(DEFAULT_GUEST_DAILY_BUDGET_USD + 0.05)
  })

  it('el corte al invitado dice qué pasó y cómo seguir, y queda en Sentry con su pool', async () => {
    process.env.AI_GUEST_DAILY_BUDGET_USD = '0.02'

    await generateAs(guest(1))
    await generateAs(guest(2))
    const blocked = await generateAs(guest(3))

    expect(blocked.ok).toBe(false)
    if (blocked.ok) return

    expect(blocked.response.status).toBe(429)
    const body = await blocked.response.json()
    expect(body.guestBudgetExhausted).toBe(true)
    expect(body.error).toMatch(/invitad/i)
    expect(body.error).toMatch(/Google/)

    expect(captureAiBudgetCutoff).toHaveBeenCalledWith(
      expect.objectContaining({ pool: 'guest', bucket: 'quiz_generation', budgetUsd: 0.02 })
    )
  })

  it('el gasto de invitados sigue sumando al global: es un sub-tope, no una bolsa aparte', async () => {
    process.env.AI_GUEST_DAILY_BUDGET_USD = '10'
    process.env.AI_DAILY_BUDGET_USD = '0.03'

    await generateAs(guest(1))
    await generateAs(guest(2))
    await generateAs(guest(3))

    // $0,033 de invitados ya agotó el global de $0,03 aunque el de invitados
    // tenga margen: el alumno también queda afuera.
    const alumno = await generateAs(ALUMNO)
    expect(alumno.ok).toBe(false)
    if (alumno.ok) return
    expect(alumno.response.status).toBe(503)
    expect(captureAiBudgetCutoff).toHaveBeenCalledWith(expect.objectContaining({ pool: 'global' }))
  })
})

describe('guestDailyBudgetUsd', () => {
  it('usa $3 por defecto y acepta sólo números positivos', () => {
    expect(guestDailyBudgetUsd()).toBe(DEFAULT_GUEST_DAILY_BUDGET_USD)
    expect(DEFAULT_GUEST_DAILY_BUDGET_USD).toBe(3)

    process.env.AI_GUEST_DAILY_BUDGET_USD = 'tres'
    expect(guestDailyBudgetUsd()).toBe(3)

    process.env.AI_GUEST_DAILY_BUDGET_USD = '0'
    expect(guestDailyBudgetUsd()).toBe(3)

    process.env.AI_GUEST_DAILY_BUDGET_USD = '1.5'
    expect(guestDailyBudgetUsd()).toBe(1.5)
  })
})
