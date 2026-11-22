import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * C2 · El webhook de Mercado Pago, con respuestas simuladas (nunca las
 * credenciales reales): aprobado acredita, repetido no duplica, rechazado no
 * acredita, firma inválida da 401. La base es una tabla `pagos` en memoria.
 */
const { sqlMock, acreditarPlan, marcarFundadora, registrarUso } = vi.hoisted(() => ({
  sqlMock: vi.fn(),
  acreditarPlan: vi.fn(),
  marcarFundadora: vi.fn(),
  registrarUso: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/planes-server', () => ({ acreditarPlan, marcarFundadora }))
vi.mock('@/lib/codigos-descuento-server', () => ({ registrarUso, buscarCodigo: vi.fn() }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { POST } from './route'

const SECRETO = 'secreto-de-prueba'
type Pago = { id: number; user_id: string; plan: string; forma: string; cantidad: number; monto: number; codigo_id: number | null; detalle: unknown; estado: string; mp_payment_id: string | null }
let pagos: Pago[]
let estadoEnMercadoPago: string
let montoEnMercadoPago: number

function pedido(dataId: string, { firma = true }: { firma?: boolean } = {}) {
  const ts = '1700000000'
  const v1 = createHmac('sha256', firma ? SECRETO : 'otra-clave').update(`id:${dataId};request-id:req-1;ts:${ts};`).digest('hex')
  return new Request(`http://x/api/pagos/mercadopago?data.id=${dataId}&type=payment`, {
    method: 'POST',
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'payment', action: 'payment.updated', data: { id: dataId } }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token-simulado')
  vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', SECRETO)
  pagos = [{ id: 41, user_id: 'silvana', plan: 'particular', forma: 'mensual', cantidad: 1, monto: 10000, codigo_id: 7, detalle: { dias: 30, fundadora: true, descripcion: 'Plan Particular · 1 bloque · mes' }, estado: 'pendiente', mp_payment_id: null }]
  estadoEnMercadoPago = 'approved'
  montoEnMercadoPago = 10000
  // La API de Mercado Pago, simulada: el pago 9001 tiene external_reference 41.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 9001, status: estadoEnMercadoPago, external_reference: '41', transaction_amount: montoEnMercadoPago }))))
  sqlMock.mockImplementation(async (partes: TemplateStringsArray, ...v: unknown[]) => {
    const q = partes.join('?')
    if (q.includes("SET estado = 'aprobado'")) {
      const p = pagos.find((x) => x.id === v[1] && x.estado !== 'aprobado')
      if (!p) return []
      p.estado = 'aprobado'
      p.mp_payment_id = String(v[0])
      return [p]
    }
    if (q.includes('UPDATE pagos SET estado =')) {
      const p = pagos.find((x) => x.id === v[2] && x.estado !== 'aprobado')
      if (p) p.estado = String(v[0])
      return []
    }
    if (q.includes('SELECT plan_vence_el FROM users')) return [{ plan_vence_el: null }]
    return []
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('POST /api/pagos/mercadopago', () => {
  it('aprobado: acredita el plan, registra el uso del código y marca fundadora', async () => {
    const res = await POST(pedido('9001'))
    expect(await res.json()).toMatchObject({ ok: true, resultado: 'acreditado' })
    expect(pagos[0].estado).toBe('aprobado')
    expect(acreditarPlan).toHaveBeenCalledTimes(1)
    expect(acreditarPlan).toHaveBeenCalledWith(expect.objectContaining({ docenteId: 'silvana', nivel: 1, tipo: 'particular', acreditadoPor: 'Mercado Pago' }))
    expect(registrarUso).toHaveBeenCalledWith(7, 'silvana')
    expect(marcarFundadora).toHaveBeenCalledWith(expect.objectContaining({ docenteId: 'silvana', fundadora: true }))
  })

  it('repetido: la segunda notificación del mismo pago no acredita otra vez', async () => {
    await POST(pedido('9001'))
    const res = await POST(pedido('9001'))
    expect(await res.json()).toMatchObject({ resultado: 'ya_estaba' })
    expect(acreditarPlan).toHaveBeenCalledTimes(1)
  })

  it('rechazado: no acredita y queda rechazado', async () => {
    estadoEnMercadoPago = 'rejected'
    const res = await POST(pedido('9001'))
    expect(await res.json()).toMatchObject({ resultado: 'rechazado' })
    expect(pagos[0].estado).toBe('rechazado')
    expect(acreditarPlan).not.toHaveBeenCalled()
  })

  it('firma inválida: 401, sin consultar ni acreditar', async () => {
    const res = await POST(pedido('9001', { firma: false }))
    expect(res.status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
    expect(acreditarPlan).not.toHaveBeenCalled()
  })

  it('un monto distinto del pedido no se acredita solo', async () => {
    montoEnMercadoPago = 100
    const res = await POST(pedido('9001'))
    expect(await res.json()).toMatchObject({ resultado: 'pendiente' })
    expect(acreditarPlan).not.toHaveBeenCalled()
  })

  it('lo que no es un pago: 200 y nada', async () => {
    const ts = '1700000000'
    const v1 = createHmac('sha256', SECRETO).update(`id:55;request-id:req-1;ts:${ts};`).digest('hex')
    const res = await POST(
      new Request('http://x/api/pagos/mercadopago?data.id=55&type=merchant_order', {
        method: 'POST',
        headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': 'req-1' },
        body: '{}',
      }),
    )
    expect(res.status).toBe(200)
    expect(fetch).not.toHaveBeenCalled()
  })
})
