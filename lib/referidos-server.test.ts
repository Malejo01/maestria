import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Ronda V · V3 — los referidos en la base, con la base simulada. */
const { sqlMock, consultas, filas } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  consultas: [] as string[],
  filas: new Map<string, unknown[]>(),
}))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { codigoSugerido, premiarReferidos, registrarReferido, validarCodigoDeReferido } from './referidos-server'

/** La respuesta para la primera consulta que contiene el texto. */
const responder = (contiene: string, resultado: unknown[]) => filas.set(contiene, resultado)

beforeEach(() => {
  consultas.length = 0
  filas.clear()
  sqlMock.mockReset()
  sqlMock.mockImplementation(async (partes: TemplateStringsArray) => {
    const q = partes.join('?').replace(/\s+/g, ' ')
    consultas.push(q)
    for (const [k, v] of filas) if (q.includes(k)) return v
    return []
  })
  vi.stubEnv('MAESTRIA_REFERIDOS_ACTIVO', '1')
})
afterEach(() => vi.unstubAllEnvs())

const ahora = new Date('2026-11-23T12:00:00Z')

describe('la válvula', () => {
  it('apagado, nada toca la base', async () => {
    vi.stubEnv('MAESTRIA_REFERIDOS_ACTIVO', '')
    await registrarReferido('nuevo')
    await premiarReferidos('nuevo', 1, ahora)
    expect(await validarCodigoDeReferido('IRINA-K7Q2', 'nuevo', { plan: 'particular', forma: 'mensual' })).toBeNull()
    expect(await codigoSugerido('nuevo')).toBeNull()
    expect(consultas).toEqual([])
  })
})

describe('registrarReferido', () => {
  it('anota al que trajo si llegó con su código', async () => {
    responder("->> 'origen_ref'", [{ ref: 'irina-k7q2' }])
    responder('WHERE codigo_referido =', [{ id: 'irina' }])
    await registrarReferido('nuevo')
    expect(consultas.some((q) => q.includes('INSERT INTO referidos'))).toBe(true)
  })
  it('AA2 · un anuncio de Meta (ref=AD-…) no es un referido: ni busca dueño ni anota', async () => {
    responder("->> 'origen_ref'", [{ ref: 'AD-PRUEBA' }])
    responder('WHERE codigo_referido =', [{ id: 'alguien' }])
    await registrarReferido('nuevo')
    expect(consultas.some((q) => q.includes('WHERE codigo_referido ='))).toBe(false)
    expect(consultas.some((q) => q.includes('INSERT INTO referidos'))).toBe(false)
  })
  it('no se anota a sí mismo ni sin código', async () => {
    responder("->> 'origen_ref'", [{ ref: 'IRINA-K7Q2' }])
    responder('WHERE codigo_referido =', [{ id: 'nuevo' }])
    await registrarReferido('nuevo')
    expect(consultas.some((q) => q.includes('INSERT INTO referidos'))).toBe(false)
  })
  it('sin la 046 no lanza', async () => {
    sqlMock.mockRejectedValue(Object.assign(new Error('no existe'), { code: '42703' }))
    await expect(registrarReferido('nuevo')).resolves.toBeUndefined()
  })
})

describe('premiarReferidos', () => {
  it('suma 30 días al que trajo si tiene plan', async () => {
    responder('UPDATE referidos SET pago_id', [{ id: 5, referente_id: 'irina' }])
    responder('SELECT plan_vence_el FROM users', [{ plan_vence_el: '2026-12-10T00:00:00Z' }])
    responder('WHERE id = ? AND premiado_el IS NULL', [{ id: 5 }])
    await premiarReferidos('nuevo', 16, ahora)
    expect(consultas.filter((q) => q.includes('UPDATE users SET plan_vence_el'))).toHaveLength(1)
  })
  it('sin plan, queda pendiente (no suma días al que trajo)', async () => {
    responder('UPDATE referidos SET pago_id', [{ id: 5, referente_id: 'irina' }])
    responder('SELECT plan_vence_el FROM users', [{ plan_vence_el: null }])
    await premiarReferidos('nuevo', 16, ahora)
    expect(consultas.some((q) => q.includes('WHERE id = ? AND premiado_el IS NULL'))).toBe(false)
    expect(consultas.filter((q) => q.includes('UPDATE users SET plan_vence_el'))).toHaveLength(0)
  })
  it('los pendientes de quien paga se le suman ahora', async () => {
    responder('WHERE referente_id = ? AND pago_id IS NOT NULL AND premiado_el IS NULL', [{ id: 1 }, { id: 2 }])
    responder('SELECT plan_vence_el FROM users', [{ plan_vence_el: '2026-12-10T00:00:00Z' }])
    await premiarReferidos('irina', 20, ahora)
    expect(consultas.filter((q) => q.includes('UPDATE users SET plan_vence_el'))).toHaveLength(1)
  })
})

describe('validarCodigoDeReferido', () => {
  it('10 % en el primer pago', async () => {
    responder('WHERE codigo_referido =', [{ id: 'irina' }])
    expect(await validarCodigoDeReferido('IRINA-K7Q2', 'nuevo', { plan: 'particular', forma: 'mensual' })).toMatchObject({ ok: true, porcentaje: 10 })
  })
  it('un código que no es de referido sigue a C1', async () => {
    expect(await validarCodigoDeReferido('FUNDADORA-SIL', 'nuevo', { plan: 'particular', forma: 'mensual' })).toBeNull()
  })
})
