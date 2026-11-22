import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** C2 · El checkout: el monto lo calcula el servidor, con el código; la preferencia lleva la fila como referencia. */
const { sqlMock, docente, buscarCodigo } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  docente: { actual: { id: 'silvana', email: 's@x' } as { id: string; email: string } | null },
  buscarCodigo: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getTeacherViewer: async () => docente.actual }))
vi.mock('@/lib/codigos-descuento-server', () => ({ buscarCodigo, registrarUso: vi.fn() }))
vi.mock('@/lib/planes-server', () => ({ acreditarPlan: vi.fn(), marcarFundadora: vi.fn() }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { POST } from './route'
import { POST as resumen } from '../resumen/route'

const SIL = { id: 7, codigo: 'FUNDADORA-SIL', porcentaje: 50, aplica: 'particular', forma: 'mensual', meses: 6, usosMaximos: 1, usosHechos: 0, venceEl: null, fundadora: true, activo: true, nota: null }
const pedir = (ruta: (req: Request) => Promise<Response>, body: unknown) => ruta(new Request('http://localhost:3000/api/pagos/checkout', { method: 'POST', body: JSON.stringify(body) }))

let insertado: unknown[] | null
beforeEach(() => {
  vi.clearAllMocks()
  docente.actual = { id: 'silvana', email: 's@x' }
  insertado = null
  vi.stubEnv('MAESTRIA_PRECIO_MENSUAL_BLOQUE', '20000')
  vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token-simulado')
  buscarCodigo.mockResolvedValue({ codigo: SIL, primerUsoDeLaPersona: null })
  sqlMock.mockImplementation(async (partes: TemplateStringsArray, ...v: unknown[]) => {
    const q = partes.join('?')
    if (q.includes('INSERT INTO pagos')) {
      insertado = v
      return [{ id: 41 }]
    }
    return []
  })
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'pref-1', init_point: 'https://mp/real', sandbox_init_point: 'https://mp/sandbox' }))))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('POST /api/pagos/checkout', () => {
  it('con FUNDADORA-SIL: guarda $10.000 y la preferencia pide $10.000 con la fila como referencia', async () => {
    const res = await pedir(POST, { plan: 'particular', forma: 'mensual', cantidad: 1, codigo: 'fundadora-sil', monto: 1 })
    const cuerpo = await res.json()
    expect(cuerpo).toEqual({ url: 'https://mp/sandbox', pago: 41 })
    // user, plan, forma, cantidad, lista, monto, codigo_id, codigo
    expect(insertado?.slice(0, 8)).toEqual(['silvana', 'particular', 'mensual', 1, 20000, 10000, 7, 'FUNDADORA-SIL'])
    const enviado = JSON.parse(String((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body))
    expect(enviado.items[0].unit_price).toBe(10000)
    expect(enviado.external_reference).toBe('41')
    expect(enviado.notification_url).toBe('http://localhost:3000/api/pagos/mercadopago')
  })

  it('un código que no vale: 409, sin crear nada', async () => {
    buscarCodigo.mockResolvedValue({ codigo: { ...SIL, usosHechos: 1 }, primerUsoDeLaPersona: null })
    const res = await pedir(POST, { plan: 'particular', forma: 'mensual', cantidad: 1, codigo: 'FUNDADORA-SIL' })
    expect(res.status).toBe(409)
    expect(insertado).toBeNull()
  })

  it('sin docente: 401; sin token (la válvula): 409 y el resumen ofrece el pago a mano', async () => {
    docente.actual = null
    expect((await pedir(POST, { plan: 'particular', forma: 'mensual', cantidad: 1 })).status).toBe(401)
    docente.actual = { id: 'silvana', email: 's@x' }
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', '')
    vi.stubEnv('MAESTRIA_WHATSAPP_CONTACTO', '5491100000000')
    expect((await pedir(POST, { plan: 'particular', forma: 'mensual', cantidad: 1 })).status).toBe(409)
    const r = await (await pedir(resumen, { plan: 'particular', forma: 'mensual', cantidad: 1, codigo: 'FUNDADORA-SIL' })).json()
    expect(r).toMatchObject({ conCheckout: false, codigo: { ok: true, porcentaje: 50 }, cobro: { monto: 10000 } })
    expect(r.manual.whatsapp).toMatch(/^https:\/\/wa\.me\/5491100000000\?text=.*FUNDADORA-SIL/)
  })
})
