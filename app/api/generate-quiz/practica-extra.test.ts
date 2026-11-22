import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * P4 · /api/generate-quiz con `practicaExtraId`: los parámetros salen de la
 * tarea (no del cuerpo), la IA se le cobra al docente, y las preguntas nuevas
 * no repiten las de la tarea ni las de prácticas anteriores (dedup).
 */
const { generateObject, generateText, guardAiCall, guardFinish, guardFail, sqlMock, getViewer, paramsDePracticaExtra } = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  guardAiCall: vi.fn(),
  guardFinish: vi.fn(),
  guardFail: vi.fn(),
  sqlMock: vi.fn(),
  getViewer: vi.fn(),
  paramsDePracticaExtra: vi.fn(),
}))

vi.mock('ai', () => ({ generateObject, generateText }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => (model: string) => ({ modelId: model }) }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall }))
vi.mock('@/lib/observability', () => ({ captureAiSchemaFailure: vi.fn(), captureRouteFailure: vi.fn() }))
vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getViewer }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar: vi.fn() }))
vi.mock('@/lib/fichas-server', () => ({ perfilSinRomper: vi.fn() }))
vi.mock('@/lib/practica-extra-server', () => ({ paramsDePracticaExtra }))

import { POST } from './route'

const pregunta = (texto: string, n: number) => ({
  id: `g${n}`,
  topic: 'limites',
  topicName: 'Límites',
  question: texto,
  explanation: 'Porque sí.',
  type: 'multiple_choice' as const,
  options: ['a', 'b', 'c', 'd'],
  correctAnswer: 0,
})

const DE_LA_TAREA = 'Calculá el límite de x² cuando x tiende a 2.'
const DE_UNA_PRACTICA_ANTERIOR = '¿La función 1/x es continua en x = 0?'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  getViewer.mockResolvedValue({ id: 'guest_ana', role: 'ALUMNO', isGuest: true, displayName: 'Ana', email: null })
  sqlMock.mockResolvedValue([])
  guardAiCall.mockResolvedValue({ ok: true, viewer: {}, actor: 'docente', finish: guardFinish, fail: guardFail })
  paramsDePracticaExtra.mockResolvedValue({
    params: {
      subject: 'Análisis Matemático I',
      subjectUnits: [],
      topics: [{ id: 'limites', name: 'Límites' }],
      mode: 'practico',
      previousQuestions: [{ question: DE_LA_TAREA }, { question: DE_UNA_PRACTICA_ANTERIOR }],
      questionCount: 2,
      nivel: 'Superior',
      carrera: 'Análisis de Sistemas',
      difficulty: 'intermedio',
      explicitQuestionTypes: ['multiple_choice'],
      teacherProgramId: 7,
    },
    docente: { id: 'docente-mauro', email: 'm@ejemplo.com' },
    classroomId: 4,
  })
})

describe('P4 · generar una práctica extra', () => {
  it('no repite preguntas de la tarea ni de prácticas anteriores (ni reescritas con otra puntuación)', async () => {
    generateObject
      .mockResolvedValueOnce({
        object: {
          questions: [
            pregunta(DE_LA_TAREA, 1),
            pregunta('¿la función 1/x es continua en x=0', 2), // la misma, sin signos ni espacios
            pregunta('Calculá el límite de 3x + 1 cuando x tiende a 0.', 3),
          ],
        },
        usage: {},
      })
      .mockResolvedValue({ object: { questions: [pregunta('¿Existe el límite de |x|/x en 0?', 4)] }, usage: {} })

    const res = await POST(new Request('http://x/api/generate-quiz', { method: 'POST', body: JSON.stringify({ practicaExtraId: 31 }) }))
    expect(res.status).toBe(200)
    const { questions } = (await res.json()) as { questions: { question: string }[] }
    const textos = questions.map((q) => q.question)
    expect(textos).toEqual(['Calculá el límite de 3x + 1 cuando x tiende a 0.', '¿Existe el límite de |x|/x en 0?'])
  })

  it('los parámetros salen de la tarea (no del cuerpo) y la IA se le cobra al docente', async () => {
    generateObject.mockResolvedValue({ object: { questions: [pregunta('Uno nuevo', 1), pregunta('Otro nuevo', 2)] }, usage: {} })
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ practicaExtraId: 31, subject: 'Otra cosa', questionCount: 40 }) }))
    expect(paramsDePracticaExtra).toHaveBeenCalledWith('guest_ana', 31)
    expect(guardAiCall).toHaveBeenCalledWith(expect.objectContaining({ cobrarA: { id: 'docente-mauro', email: 'm@ejemplo.com' } }))
  })

  it('una práctica que no es suya (o ya usada) es 404 y no gasta', async () => {
    paramsDePracticaExtra.mockResolvedValue(null)
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ practicaExtraId: 31 }) }))
    expect(res.status).toBe(404)
    expect(guardAiCall).not.toHaveBeenCalled()
    expect(generateObject).not.toHaveBeenCalled()
  })
})

describe('P4 · Ronda T · A4: la práctica extra usa el área del programa de la tarea', () => {
  it('con un programa de Antropología: sin LaTeX y con "práctico" como análisis de casos', async () => {
    sqlMock.mockImplementation(async (partes: TemplateStringsArray) =>
      partes.join('?').includes('FROM teacher_programs')
        ? [{ subject_name: 'Temas de Antropología Cultural en Psicología', pedagogy_profile: { area: 'sociales', areaConfianza: 0.9, areaOrigen: 'ia' }, units: [] }]
        : [],
    )
    generateObject.mockResolvedValue({ object: { questions: [pregunta('Uno nuevo', 1), pregunta('Otro nuevo', 2)] }, usage: {} })
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ practicaExtraId: 31 }) }))
    const { system, prompt } = generateObject.mock.calls[0][0]
    expect(system).toContain('ÁREA Y CÓMO SE EVALÚA: Ciencias sociales y humanidades')
    expect(system).not.toContain('FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO')
    expect(prompt).toContain('MODO PRÁCTICO: Análisis de situaciones')
  })
})

describe('Ronda T · A4: tipos por defecto del código (el diagnóstico)', () => {
  it('no habilitan la numérica en lo conceptual; los tildados a mano, sí', async () => {
    const { generateQuiz } = await import('@/lib/quiz-generation')
    generateObject.mockResolvedValue({ object: { questions: [pregunta('Uno nuevo', 1), pregunta('Otro nuevo', 2)] }, usage: {} })
    const base = {
      subject: 'Temas de Antropología Cultural en Psicología',
      subjectUnits: [],
      topics: [{ id: 't', name: 'Etnocentrismo' }],
      mode: 'practico',
      previousQuestions: [],
      questionCount: 2,
      nivel: 'Superior',
      carrera: '',
      difficulty: 'intermedio',
      explicitQuestionTypes: ['multiple_choice', 'numeric'] as ('multiple_choice' | 'numeric')[],
    }
    await generateQuiz({ ...base, tiposPorDefecto: true })
    expect(generateObject.mock.calls[0][0].system).not.toContain('TIPO "numeric"')
    generateObject.mockClear()
    await generateQuiz(base)
    expect(generateObject.mock.calls[0][0].system).toContain('TIPO "numeric"')
  })
})
