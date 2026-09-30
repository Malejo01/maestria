import { describe, it, expect, afterEach } from 'vitest'
import {
  AI_LIMITS,
  DAY_WINDOW_SECONDS,
  HOUR_WINDOW_SECONDS,
  evaluateAiRateLimit,
  humanizeRetryAfter,
  isAdminEmail,
  rateLimitMessage,
  type AiActor,
  type AiBucket,
} from '@/lib/ai-rate-limit'
import { DEFAULT_DAILY_BUDGET_USD, MODEL_PRICING_USD_PER_MTOK, dailyBudgetUsd, estimateCostUsd } from '@/lib/ai-usage'
import { AI_MODEL } from '@/lib/ai-model'

const NOW = new Date('2026-08-03T12:00:00.000Z')

/** Atajo: "este actor ya consumió N en el día y M en la hora". */
function evaluate(bucket: AiBucket, actor: AiActor, usedInDay: number, usedInHour = usedInDay) {
  return evaluateAiRateLimit({ bucket, actor, usedInDay, usedInHour, now: NOW })
}

describe('evaluateAiRateLimit — el límite corta', () => {
  it('deja pasar al invitado hasta el tope diario y corta en el siguiente', () => {
    const limit = AI_LIMITS.quiz_generation.guest.perDay
    expect(limit).toBe(3)

    for (let used = 0; used < limit; used += 1) {
      expect(evaluate('quiz_generation', 'guest', used).allowed).toBe(true)
    }

    const blocked = evaluate('quiz_generation', 'guest', limit)
    expect(blocked.allowed).toBe(false)
    expect(blocked).toMatchObject({ reason: 'hour_limit', limit: 3 })
  })

  it('corta al alumno por hora antes que por día', () => {
    // 10 en la hora, pero sólo 10 en el día: todavía falta para el tope diario
    // de 30, así que el corte tiene que ser el horario.
    const decision = evaluate('quiz_generation', 'alumno', 10, 10)
    expect(decision).toMatchObject({ allowed: false, reason: 'hour_limit', limit: 10 })
  })

  it('corta al alumno por día cuando la hora está limpia', () => {
    // 30 en el día repartidas en horas anteriores, 0 en la última hora.
    const decision = evaluate('quiz_generation', 'alumno', 30, 0)
    expect(decision).toMatchObject({ allowed: false, reason: 'day_limit', limit: 30 })
  })

  it('le da más margen al docente que al alumno en generación', () => {
    expect(evaluate('quiz_generation', 'docente', 30, 0).allowed).toBe(true)
    expect(evaluate('quiz_generation', 'docente', 60, 0).allowed).toBe(false)
  })

  it('bloquea extracción de programas para invitados y alumnos, la permite al docente', () => {
    expect(evaluate('program_extraction', 'guest', 0)).toMatchObject({
      allowed: false,
      reason: 'blocked_for_role',
    })
    expect(evaluate('program_extraction', 'alumno', 0)).toMatchObject({
      allowed: false,
      reason: 'blocked_for_role',
    })
    expect(evaluate('program_extraction', 'docente', 0).allowed).toBe(true)
  })

  it('deja subir programas al alumno, que es quien usa el flujo de Superior', () => {
    // Distinto de program_extraction a propósito: el selector de currículum de
    // Nivel Superior lo usa un alumno subiendo el programa de su carrera.
    expect(evaluate('program_upload', 'alumno', 0).allowed).toBe(true)
    expect(evaluate('program_upload', 'alumno', 8, 0).allowed).toBe(false)
    expect(evaluate('program_extraction', 'alumno', 0).allowed).toBe(false)
  })

  it('deja pasar al admin por encima de cualquier tope', () => {
    expect(evaluate('quiz_generation', 'admin', 9999)).toEqual({ allowed: true, reason: 'admin_bypass' })
    // Incluso en el bucket vedado por rol.
    expect(evaluate('program_extraction', 'admin', 9999).allowed).toBe(true)
  })

  it('aplica el corte en todos los buckets, no sólo en generación', () => {
    const buckets: AiBucket[] = ['quiz_generation', 'feedback', 'grading']
    for (const bucket of buckets) {
      const { perDay } = AI_LIMITS[bucket].alumno
      expect(evaluate(bucket, 'alumno', perDay - 1, 0).allowed).toBe(true)
      expect(evaluate(bucket, 'alumno', perDay, 0).allowed).toBe(false)
    }
  })
})

describe('evaluateAiRateLimit — retry-after', () => {
  it('usa la ventana completa cuando no se conoce la llamada más vieja', () => {
    const decision = evaluate('quiz_generation', 'alumno', 30, 0)
    expect(decision.allowed).toBe(false)
    if (decision.allowed) return
    expect(decision.retryAfterSeconds).toBe(DAY_WINDOW_SECONDS)
  })

  it('descuenta lo que ya transcurrió de la ventana', () => {
    // La llamada más vieja de la hora fue hace 50 minutos → faltan 10.
    const decision = evaluateAiRateLimit({
      bucket: 'quiz_generation',
      actor: 'alumno',
      usedInDay: 10,
      usedInHour: 10,
      oldestInHour: new Date(NOW.getTime() - 50 * 60 * 1000),
      now: NOW,
    })

    expect(decision.allowed).toBe(false)
    if (decision.allowed) return
    expect(decision.retryAfterSeconds).toBe(10 * 60)
  })

  it('nunca sugiere reintentar ya mismo aunque el contador venga desfasado', () => {
    const decision = evaluateAiRateLimit({
      bucket: 'quiz_generation',
      actor: 'alumno',
      usedInDay: 10,
      usedInHour: 10,
      // Más vieja que la ventana: el conteo estaba desactualizado.
      oldestInHour: new Date(NOW.getTime() - 3 * HOUR_WINDOW_SECONDS * 1000),
      now: NOW,
    })

    expect(decision.allowed).toBe(false)
    if (decision.allowed) return
    expect(decision.retryAfterSeconds).toBeGreaterThanOrEqual(1)
    expect(decision.retryAfterSeconds).toBeLessThanOrEqual(HOUR_WINDOW_SECONDS)
  })
})

describe('humanizeRetryAfter', () => {
  it('traduce segundos a algo que un alumno pueda leer', () => {
    expect(humanizeRetryAfter(30)).toBe('en un ratito')
    expect(humanizeRetryAfter(600)).toBe('en 10 minutos')
    expect(humanizeRetryAfter(3600)).toBe('en una hora')
    expect(humanizeRetryAfter(4 * 3600)).toBe('en 4 horas')
    expect(humanizeRetryAfter(DAY_WINDOW_SECONDS)).toBe('mañana')
  })
})

describe('rateLimitMessage', () => {
  const blocked = evaluate('quiz_generation', 'alumno', 30, 0)

  it('invita al invitado a crear cuenta en lugar de sólo negarle', () => {
    const guestBlocked = evaluate('quiz_generation', 'guest', 3)
    if (guestBlocked.allowed) throw new Error('debería estar bloqueado')

    const message = rateLimitMessage(guestBlocked, { actor: 'guest' })
    expect(message).toContain('Google')
    expect(message).toContain('progreso')
  })

  it('usa un registro cálido en primaria y neutro en superior', () => {
    if (blocked.allowed) throw new Error('debería estar bloqueado')

    const primario = rateLimitMessage(blocked, { actor: 'alumno', nivel: 'Primario' })
    const superior = rateLimitMessage(blocked, { actor: 'alumno', nivel: 'Superior' })

    expect(primario).toMatch(/🌱/)
    expect(primario).toContain('Descansá')
    expect(superior).not.toMatch(/🌱/)
    expect(superior).toContain('límite')
  })

  it('explica el bloqueo por rol sin hablar de cupos', () => {
    const roleBlocked = evaluate('program_extraction', 'alumno', 0)
    if (roleBlocked.allowed) throw new Error('debería estar bloqueado')

    const message = rateLimitMessage(roleBlocked, { actor: 'alumno' })
    expect(message).toContain('docente')
    expect(message).not.toMatch(/\d/)
  })
})

describe('isAdminEmail', () => {
  const original = process.env.ADMIN_EMAILS

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = original
  })

  it('es false cuando la allowlist no está configurada', () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdminEmail('alguien@ejemplo.com')).toBe(false)
  })

  it('ignora mayúsculas y espacios alrededor de las entradas', () => {
    process.env.ADMIN_EMAILS = ' Dueno@Ejemplo.com , otro@ejemplo.com '
    expect(isAdminEmail('dueno@ejemplo.com')).toBe(true)
    expect(isAdminEmail('  OTRO@EJEMPLO.COM ')).toBe(true)
    expect(isAdminEmail('ajeno@ejemplo.com')).toBe(false)
  })

  it('no confunde a un invitado sin email con un admin', () => {
    process.env.ADMIN_EMAILS = 'dueno@ejemplo.com'
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })
})

describe('estimateCostUsd', () => {
  it('cobra la salida bastante más cara que la entrada', () => {
    // 1M de entrada = 0.15, 1M de salida = 1.25
    expect(estimateCostUsd('gemini-2.5-flash', 1_000_000, 0)).toBeCloseTo(0.15, 6)
    expect(estimateCostUsd('gemini-2.5-flash', 0, 1_000_000)).toBeCloseTo(1.25, 6)
  })

  it('el modelo que usa la app tiene tarifa propia, no la de reemplazo', () => {
    // Sin su fila, estimateCostUsd lo cobraría con la tarifa de otro modelo y el
    // tope de gasto diario mediría mal. Cambiar AI_MODEL obliga a cargar el precio.
    expect(MODEL_PRICING_USD_PER_MTOK[AI_MODEL]).toBeDefined()
  })

  it('mantiene un cuestionario típico en el orden del centavo', () => {
    const cost = estimateCostUsd('gemini-2.5-flash', 3_000, 6_000)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.02)
  })

  it('cae a la tarifa de flash ante un modelo desconocido en vez de cobrar cero', () => {
    expect(estimateCostUsd('modelo-que-no-existe', 1_000_000, 0)).toBeCloseTo(0.15, 6)
  })
})

describe('dailyBudgetUsd', () => {
  const original = process.env.AI_DAILY_BUDGET_USD

  afterEach(() => {
    if (original === undefined) delete process.env.AI_DAILY_BUDGET_USD
    else process.env.AI_DAILY_BUDGET_USD = original
  })

  it('usa el default cuando la env no está o no es un número positivo', () => {
    delete process.env.AI_DAILY_BUDGET_USD
    expect(dailyBudgetUsd()).toBe(DEFAULT_DAILY_BUDGET_USD)

    process.env.AI_DAILY_BUDGET_USD = 'quince'
    expect(dailyBudgetUsd()).toBe(DEFAULT_DAILY_BUDGET_USD)

    // Un 0 accidental apagaría la IA por completo; se trata como "sin valor".
    process.env.AI_DAILY_BUDGET_USD = '0'
    expect(dailyBudgetUsd()).toBe(DEFAULT_DAILY_BUDGET_USD)
  })

  it('respeta el valor configurado', () => {
    process.env.AI_DAILY_BUDGET_USD = '42.5'
    expect(dailyBudgetUsd()).toBe(42.5)
  })
})
