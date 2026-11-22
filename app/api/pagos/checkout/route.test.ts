import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** C2 · El checkout: el monto lo calcula el servidor, con el código; la preferencia lleva la fila como referencia. */
const { sqlMock, docente, alumno, buscarCodigo, materiaParaElPase } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  docente: { actual: { id: 'silvana', email: 's@x' } as { id: string; email: string } | null },
  alumno: { actual: { id: 'sofia', email: null, isGuest: false } as { id: string; email: string | null; isGuest: boolean } | null },
  buscarCodigo: vi.fn(),
  materiaParaElPase: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getTeacherViewer: async () => docente.actual, getViewer: async () => alumno.actual }))
vi.mock('@/lib/autodidacta-server', () => ({ materiaParaElPase, acreditarPase: vi.fn() }))
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
  alumno.actual = { id: 'sofia', email: null, isGuest: false }
  materiaParaElPase.mockImplementation(async (userId: string, id: number) => (userId === 'sofia' && id === 57 ? { id: 57, nombre: 'Economía', fechaExamen: '2026-12-04' } : null))
  vi.stubEnv('MAESTRIA_PRECIO_PASE_ALUMNO', '6000')
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

  it('E2 · el pase de alumno lo paga el alumno dueño de la materia, y la fila lleva la materia', async () => {
    docente.actual = null
    buscarCodigo.mockResolvedValue(null)
    const res = await pedir(POST, { plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 })
    expect(await res.json()).toEqual({ url: 'https://mp/sandbox', pago: 41 })
    // user, plan, forma, cantidad, lista, monto
    expect(insertado?.slice(0, 6)).toEqual(['sofia', 'pase_alumno', 'pase', 1, 6000, 6000])
    expect(JSON.parse(String(insertado?.[8]))).toMatchObject({ materia: 57, descripcion: 'Pase por materia · hasta el examen + 7 días · Economía' })
  })

  it('E2 · sin cuenta o invitado: 401; la materia de otro (o sin materia): 404 / 400', async () => {
    alumno.actual = { id: 'guest-1', email: null, isGuest: true }
    expect((await pedir(POST, { plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 })).status).toBe(401)
    alumno.actual = { id: 'otra', email: null, isGuest: false }
    expect((await pedir(POST, { plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 })).status).toBe(404)
    expect((await pedir(resumen, { plan: 'pase_alumno', forma: 'pase', cantidad: 1, materia: 57 })).status).toBe(404)
    expect((await pedir(POST, { plan: 'pase_alumno', forma: 'pase', cantidad: 1 })).status).toBe(400)
    expect(insertado).toBeNull()
  })
})
