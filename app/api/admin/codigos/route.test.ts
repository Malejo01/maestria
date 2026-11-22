import { beforeEach, describe, expect, it, vi } from 'vitest'

const { admin, crearCodigo, listarCodigos } = vi.hoisted(() => ({
  admin: { actual: { email: 'mauro@x', displayName: 'Mauro' } as { email: string; displayName: string } | null },
  crearCodigo: vi.fn(),
  listarCodigos: vi.fn(),
}))
vi.mock('@/lib/auth-session', () => ({ getAdminViewer: async () => admin.actual }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/codigos-descuento-server', () => ({ crearCodigo, listarCodigos }))

import { GET, POST } from './route'

const pedir = (body: unknown) => POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.clearAllMocks()
  admin.actual = { email: 'mauro@x', displayName: 'Mauro' }
  crearCodigo.mockResolvedValue({ id: 7 })
})

describe('/api/admin/codigos (C1)', () => {
  it('para quien no es admin, 404', async () => {
    admin.actual = null
    expect((await GET()).status).toBe(404)
    expect((await pedir({})).status).toBe(404)
  })

  it('crea FUNDADORA-SIL: 50 %, Particular, mensual, 6 meses, 1 uso, Fundadora', async () => {
    const res = await pedir({ codigo: 'fundadora-sil', porcentaje: 50, aplica: 'particular', forma: 'mensual', meses: 6, usosMaximos: 1, fundadora: true, nota: 'Silvana' })
    expect(res.status).toBe(200)
    expect(crearCodigo).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'FUNDADORA-SIL', porcentaje: 50, aplica: 'particular', forma: 'mensual', meses: 6, usosMaximos: 1, fundadora: true, creadoPor: 'mauro@x' }))
  })

  it('un código mal escrito o un porcentaje fuera de rango: 400, sin crear', async () => {
    expect((await pedir({ codigo: 'X', porcentaje: 50, aplica: 'todos', forma: 'ambos' })).status).toBe(400)
    expect((await pedir({ codigo: 'BIEN-123', porcentaje: 150, aplica: 'todos', forma: 'ambos' })).status).toBe(400)
    expect(crearCodigo).not.toHaveBeenCalled()
  })

  it('repetido: 409; sin la 038: 409 con qué falta', async () => {
    crearCodigo.mockResolvedValueOnce('repetido')
    expect((await pedir({ codigo: 'OTRO-1', porcentaje: 10, aplica: 'todos', forma: 'ambos' })).status).toBe(409)
    listarCodigos.mockResolvedValueOnce('sin_migracion')
    const res = await GET()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/038/)
  })
})
