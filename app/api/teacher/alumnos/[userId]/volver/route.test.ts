import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const { getTeacherViewer, volverASumarAlumno, bloqueoParaSumarAlumno } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  volverASumarAlumno: vi.fn(),
  bloqueoParaSumarAlumno: vi.fn(),
}))

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/alumnos-docente-server', () => ({ volverASumarAlumno }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaSumarAlumno }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))

import { POST } from './route'

const pedir = () => POST(new Request('http://localhost/x', { method: 'POST' }), { params: Promise.resolve({ userId: 'beto' }) })

beforeEach(() => {
  vi.clearAllMocks()
  getTeacherViewer.mockResolvedValue({ id: 'docente', email: 'd@x.com' })
  bloqueoParaSumarAlumno.mockResolvedValue(null)
  volverASumarAlumno.mockResolvedValue(1)
})

describe('POST /api/teacher/alumnos/[userId]/volver (J1)', () => {
  it('con lugar, lo vuelve a sumar', async () => {
    const res = await pedir()
    expect(res.status).toBe(200)
    expect(volverASumarAlumno).toHaveBeenCalledWith('docente', 'beto')
  })

  it('sin lugar en el plan: el 402 de siempre, y no toca nada', async () => {
    bloqueoParaSumarAlumno.mockResolvedValue(NextResponse.json({ motivo: 'sin_cupo' }, { status: 402 }))
    const res = await pedir()
    expect(res.status).toBe(402)
    expect(volverASumarAlumno).not.toHaveBeenCalled()
  })

  it('si no estaba quitado, 404', async () => {
    volverASumarAlumno.mockResolvedValue(0)
    expect((await pedir()).status).toBe(404)
  })

  it('sólo docentes', async () => {
    getTeacherViewer.mockResolvedValue(null)
    expect((await pedir()).status).toBe(403)
  })
})
