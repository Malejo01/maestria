import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAdminViewer, acreditarPlan, captureRouteFailure } = vi.hoisted(() => ({
  getAdminViewer: vi.fn(),
  acreditarPlan: vi.fn(),
  captureRouteFailure: vi.fn(),
}))

vi.mock('@/lib/auth-session', () => ({ getAdminViewer }))
vi.mock('@/lib/planes-server', () => ({ acreditarPlan }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure }))

import { POST } from './route'

const pedido = (cuerpo: unknown) =>
  new Request('http://localhost/api/admin/planes', { method: 'POST', body: JSON.stringify(cuerpo) })

beforeEach(() => {
  vi.clearAllMocks()
  getAdminViewer.mockResolvedValue({ id: 'm', email: 'mauro@x.com', displayName: 'Mauro', isGuest: false, role: 'DOCENTE' })
  acreditarPlan.mockResolvedValue(true)
})

describe('POST /api/admin/planes (G4)', () => {
  it('para quien no está en la lista de admin, la ruta no existe', async () => {
    getAdminViewer.mockResolvedValue(null)
    const res = await POST(pedido({ docenteId: 'd1', nivel: 2, dias: 30 }))
    expect(res.status).toBe(404)
    expect(acreditarPlan).not.toHaveBeenCalled()
  })

  it('sin nivel válido o sin hasta cuándo, 400', async () => {
    expect((await POST(pedido({ docenteId: 'd1', nivel: 9, dias: 30 }))).status).toBe(400)
    expect((await POST(pedido({ docenteId: 'd1', nivel: 2 }))).status).toBe(400)
    expect(acreditarPlan).not.toHaveBeenCalled()
  })

  it('acredita 90 días desde ahora y deja registrado quién', async () => {
    const antes = Date.now()
    const res = await POST(pedido({ docenteId: 'd1', nivel: 2, dias: 90, nota: 'pase por MercadoPago' }))
    expect(res.status).toBe(200)
    const args = acreditarPlan.mock.calls[0][0]
    expect(args).toMatchObject({ docenteId: 'd1', nivel: 2, nota: 'pase por MercadoPago', acreditadoPor: 'mauro@x.com' })
    const dias = (args.venceEl.getTime() - antes) / 86_400_000
    expect(dias).toBeGreaterThan(89.99)
    expect(dias).toBeLessThan(90.01)
  })

  it('una fecha exacta se respeta', async () => {
    await POST(pedido({ docenteId: 'd1', nivel: 5, venceEl: '2027-03-01T23:59:59-03:00' }))
    expect(acreditarPlan.mock.calls[0][0].venceEl.toISOString()).toBe('2027-03-02T02:59:59.000Z')
  })

  it('un docente que no existe, 404', async () => {
    acreditarPlan.mockResolvedValue(false)
    expect((await POST(pedido({ docenteId: 'nadie', nivel: 1, dias: 30 }))).status).toBe(404)
  })
})
