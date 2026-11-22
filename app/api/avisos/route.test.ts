import { beforeEach, describe, expect, it, vi } from 'vitest'

/** P3 · /api/avisos: siempre con el id del viewer; sin viewer, 401. */
const { getViewer, avisosDelAlumno, marcar } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  avisosDelAlumno: vi.fn(async () => ({ avisos: [], vistoEl: null, puedeMarcar: true })),
  marcar: vi.fn(async () => undefined),
}))
vi.mock('@/lib/auth-session', () => ({ getViewer }))
vi.mock('@/lib/avisos-alumno-server', () => ({ avisosDelAlumno, marcarAvisosDelAlumnoLeidos: marcar }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { GET, POST } from './route'

beforeEach(() => vi.clearAllMocks())

describe('/api/avisos', () => {
  it('sin sesión ni invitado: 401 y no se lee nada', async () => {
    getViewer.mockResolvedValue(null)
    expect((await GET()).status).toBe(401)
    expect((await POST()).status).toBe(401)
    expect(avisosDelAlumno).not.toHaveBeenCalled()
    expect(marcar).not.toHaveBeenCalled()
  })

  it('el invitado lee y marca los suyos, con su id', async () => {
    getViewer.mockResolvedValue({ id: 'guest_abc', isGuest: true, role: 'ALUMNO', displayName: 'Clarita', email: null })
    expect((await GET()).status).toBe(200)
    expect(avisosDelAlumno).toHaveBeenCalledWith('guest_abc', { esInvitado: true })
    await POST()
    expect(marcar).toHaveBeenCalledWith('guest_abc')
  })
})
