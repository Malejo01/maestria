import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Ronda T · A4: regenerar una pregunta usa el área del programa y la metodología del docente. */
const { sqlMock, generateQuiz } = vi.hoisted(() => ({ sqlMock: vi.fn(), generateQuiz: vi.fn() }))

vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getTeacherViewer: async () => ({ id: 'doc', email: 'd@x.com' }) }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar: async () => null }))
vi.mock('@/lib/fichas-server', () => ({ perfilSinRomper: async () => null }))
vi.mock('@/lib/valoraciones-server', () => ({ preguntasAEvitar: async () => [] }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall: async () => ({ ok: true, finish: vi.fn(), fail: vi.fn() }) }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/quiz-generation', () => ({ generateQuiz }))

import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  sqlMock.mockImplementation(async (partes: TemplateStringsArray) => {
    const q = partes.join('?')
    if (q.includes('FROM teacher_quizzes'))
      return [{
        id: 5,
        teacher_program_id: 18,
        subject_name: 'Temas de Antropología Cultural en Psicología',
        mode: 'practico',
        pedagogy_context: 'Metodología: casos de la vida cotidiana',
        questions: [{ id: 'q1', type: 'true_false', question: 'El etnocentrismo es universal.', topic: 't', topicName: 'Etnocentrismo', correctAnswer: false, explanation: 'x' }],
      }]
    if (q.includes('FROM teacher_programs')) return [{ id: 18, units: [], nivel: 'Superior', grado: '1er Año', pedagogy_profile: { degree: 'Psicología' } }]
    return []
  })
  generateQuiz.mockResolvedValue({ ok: true, questions: [{ id: 'q1', type: 'true_false', question: 'Otra', correctAnswer: true, explanation: 'x' }] })
})

describe('POST regenerate-question — Ronda T · A4', () => {
  it('genera con el programa (de donde sale el área) y con la metodología como preferencias', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ questionIndex: 0 }) }), { params: Promise.resolve({ id: '5' }) })
    expect(res.status).toBe(200)
    const params = generateQuiz.mock.calls[0][0]
    expect(params.teacherProgramId).toBe(18)
    expect(params.pedagogyContext).toContain('casos de la vida cotidiana')
  })
})
