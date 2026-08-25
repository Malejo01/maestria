import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET as getJoinPreview, POST as postJoin } from '@/app/api/classrooms/join/route'
import { GET as getStudentClassrooms } from '@/app/api/student/classrooms/route'
import { GET as getAssignment } from '@/app/api/student/assignments/[id]/route'
import { GET as getDiagnosticReport } from '@/app/api/student/diagnostic-report/route'
import { POST as postGuestClaim } from '@/app/api/student/guest/claim/route'
import { POST as postSaveResult } from '@/app/api/quiz/save-result/route'
import { sql } from '@/lib/db'
import { captureRouteFailure } from '@/lib/observability'
import { loadStudentDiagnostic } from '@/lib/diagnostic-report-server'

/**
 * Mismo contrato que tests/curriculum.test.ts, sobre las rutas que toca un
 * alumno: cuando la base falla, el catch REPORTA además de devolver 500.
 *
 * Estas rutas son las del inventario de deuda-tecnica.md §6b que un alumno —o
 * un invitado sin cuenta— ejercita solo. Un alumno al que le falla "entrar al
 * aula" o "guardar el intento" no abre un ticket: se va. El evento con tags es
 * la única señal que queda, y esto fija que exista.
 */
vi.mock('@/lib/db', () => ({ sql: vi.fn() }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({
  getViewer: vi.fn().mockResolvedValue({ id: 'user-1', displayName: 'Alumna', isGuest: false }),
}))
vi.mock('@/lib/diagnostic-report-server', () => ({ loadStudentDiagnostic: vi.fn() }))
vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }) }))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => ({ value: 'token' }), delete: () => {} }),
}))
vi.mock('@/lib/guest-session', () => ({
  GUEST_COOKIE_NAME: 'mm_guest',
  guestCookieOptions: () => ({}),
  newGuestId: () => 'guest-new',
  signGuestToken: vi.fn().mockResolvedValue('signed'),
  verifyGuestToken: vi.fn().mockResolvedValue('guest-9'),
}))

const dbError = new Error('relation "algo" does not exist')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('las rutas de alumno reportan sus fallas a Sentry', () => {
  it('/api/classrooms/join GET reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await getJoinPreview(new Request('http://localhost/api/classrooms/join?code=ABC234'))
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/classrooms/join', operation: 'GET' })
    )
  })

  it('/api/classrooms/join POST reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await postJoin(
      new Request('http://localhost/api/classrooms/join', {
        method: 'POST',
        body: JSON.stringify({ code: 'ABC234', displayName: 'Alumna' }),
      })
    )
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/classrooms/join', operation: 'POST' })
    )
  })

  it('/api/student/classrooms reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await getStudentClassrooms()
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/student/classrooms' })
    )
  })

  it('/api/student/assignments/[id] reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await getAssignment(new Request('http://localhost/api/student/assignments/7'), {
      params: Promise.resolve({ id: '7' }),
    })
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/student/assignments/[id]' })
    )
  })

  it('/api/student/diagnostic-report reporta y devuelve 500', async () => {
    vi.mocked(loadStudentDiagnostic).mockRejectedValueOnce(dbError)
    const res = await getDiagnosticReport()
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/student/diagnostic-report' })
    )
  })

  it('/api/student/guest/claim reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await postGuestClaim()
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/student/guest/claim' })
    )
  })

  it('/api/quiz/save-result reporta y devuelve 500', async () => {
    vi.mocked(sql).mockRejectedValueOnce(dbError)
    const res = await postSaveResult(
      new Request('http://localhost/api/quiz/save-result', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Matemática',
          mode: 'practico',
          topics: ['Funciones'],
          totalQuestions: 1,
          correctAnswers: 1,
          score: 10,
          answers: [],
        }),
      })
    )
    expect(res.status).toBe(500)
    expect(captureRouteFailure).toHaveBeenCalledWith(
      dbError,
      expect.objectContaining({ endpoint: '/api/quiz/save-result' })
    )
  })
})
