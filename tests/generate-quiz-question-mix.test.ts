import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateObject } from 'ai'
import { sql } from '@/lib/db'
import { POST } from '@/app/api/generate-quiz/route'

/**
 * La precedencia entre lo que sugiere el programa de cátedra
 * (`curriculum.tipos_pregunta_sugeridos`, migración 023) y lo que el usuario
 * pidió explícitamente.
 *
 * La columna se llama "sugeridos" y el comportamiento tiene que coincidir: es un
 * default pre-seleccionado, no una restricción. El alumno destilda tipos en el
 * selector y el docente arma el cuestionario con los que quiere; en los dos
 * casos manda la persona. Lo único que la sugerencia corrige es el llamador que
 * no eligió nada, que hasta ahora caía a 100% opción múltiple.
 *
 * Se prueba mirando el system prompt que recibe el modelo porque es el único
 * lugar donde la decisión se vuelve observable: no hay valor de retorno que
 * diga "usé estos tipos".
 */

vi.mock('ai', () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: () => () => 'modelo-de-prueba',
}))

vi.mock('@/lib/db', () => ({ sql: vi.fn() }))

vi.mock('@/lib/ai-guard', () => ({
  guardAiCall: vi.fn(async () => ({
    ok: true as const,
    finish: vi.fn(async () => {}),
    fail: vi.fn(async () => {}),
  })),
}))

vi.mock('@/lib/observability', () => ({
  captureAiSchemaFailure: vi.fn(),
  captureRouteFailure: vi.fn(),
}))

const QUESTION_COUNT = 20

/** Mezcla de la Unidad 7 del programa: sesgada a producir la respuesta. */
const MEZCLA_DERIVADAS = {
  numeric: 50,
  short_answer: 25,
  multiple_choice: 20,
  true_false: 5,
}

/** Preguntas distintas entre sí, para que ninguna caiga por el dedup. */
const fakeQuestions = () =>
  Array.from({ length: QUESTION_COUNT }, (_, i) => ({
    id: `q${i + 1}`,
    topic: 'derivadas',
    topicName: 'Derivadas',
    type: 'numeric' as const,
    question: `Derivada número ${i + 1} de la serie de prueba`,
    explanation: 'Explicación de prueba.',
    correctAnswer: i + 1,
  }))

function buildRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/generate-quiz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Matemática',
      subjectUnits: [{ id: 'u7', name: 'Unidad 7 — Derivadas', topics: [] }],
      topics: [{ id: 'derivada', name: 'Derivada: definición y aplicaciones.' }],
      mode: 'practico',
      questionCount: QUESTION_COUNT,
      nivel: 'Superior',
      grado: '1er Año',
      carrera: 'Tecnicatura Superior en Análisis de Sistemas',
      ...body,
    }),
  })
}

/** El system prompt de la primera (y única) llamada al modelo. */
const systemPrompt = () => vi.mocked(generateObject).mock.calls[0][0].system as string

describe('/api/generate-quiz · mezcla sugerida vs. elección del usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(sql).mockResolvedValue([
      {
        eje: 'Unidad 7 — Derivadas',
        contexto_profesional: null,
        tipos_pregunta_sugeridos: MEZCLA_DERIVADAS,
      },
    ] as never)
    vi.mocked(generateObject).mockResolvedValue({
      object: { questions: fakeQuestions() },
      usage: {},
    } as never)
  })

  it('aplica la mezcla del programa cuando el llamador no eligió tipos', async () => {
    // El agujero que esto tapa: sin `questionTypes` en el body, la ruta caía a
    // ['multiple_choice'] y el cuestionario salía 100% de reconocimiento aunque
    // el programa pidiera lo contrario. Le pasa a los cuestionarios de aula.
    await POST(buildRequest({}))
    const prompt = systemPrompt()

    expect(prompt).toContain('DISTRIBUCIÓN OBLIGATORIA POR TIPO')
    expect(prompt).toContain('- numeric: 10 preguntas')
    expect(prompt).toContain('- short_answer: 5 preguntas')
    expect(prompt).toContain('- multiple_choice: 4 preguntas')
    expect(prompt).toContain('- true_false: 1 pregunta')
  })

  it('una selección explícita del usuario gana sobre lo sugerido', async () => {
    // El docente quiere un cuestionario de opción múltiple y verdadero/falso.
    // La sugerencia de la cátedra pesa 75% en producción y tiene que ceder por
    // completo: ni una numérica, ni una de respuesta corta.
    await POST(buildRequest({ questionTypes: ['multiple_choice', 'true_false'] }))
    const prompt = systemPrompt()

    expect(prompt).toContain('- multiple_choice: 16 preguntas')
    expect(prompt).toContain('- true_false: 4 preguntas')
    expect(prompt).not.toContain('- numeric:')
    expect(prompt).not.toContain('- short_answer:')
    expect(prompt).toContain('No generes ninguna pregunta de tipo: numeric, short_answer')

    // Y los campos del tipo excluido tampoco se le describen al modelo.
    expect(prompt).not.toContain('TIPO "numeric"')
    expect(prompt).toContain('TIPO "multiple_choice"')
  })

  it('respeta una selección de un solo tipo, aunque el programa lo pondere poco', async () => {
    // true_false pesa 5 sobre 100 en el programa. Elegido solo, es el 100% del
    // cuestionario: la sugerencia no puede colar otros tipos "para compensar".
    await POST(buildRequest({ questionTypes: ['true_false'] }))
    const prompt = systemPrompt()

    expect(prompt).toContain('TIPO "true_false"')
    expect(prompt).not.toContain('TIPO "numeric"')
    expect(prompt).not.toContain('TIPO "multiple_choice"')
  })

  it('incluye un tipo que el usuario pidió y el programa no pondera', async () => {
    vi.mocked(sql).mockResolvedValue([
      {
        eje: 'Unidad 7 — Derivadas',
        contexto_profesional: null,
        tipos_pregunta_sugeridos: { numeric: 50, short_answer: 25 },
      },
    ] as never)

    await POST(buildRequest({ questionTypes: ['numeric', 'short_answer', 'true_false'] }))
    const prompt = systemPrompt()

    expect(prompt).toContain('TIPO "true_false"')
    expect(prompt).toMatch(/- true_false: [1-9]\d* pregunta/)
  })

  it('sin mezcla declarada deja el reparto parejo de siempre', async () => {
    // Todo K-12 y cualquier programa Superior que no declare la columna: el
    // comportamiento previo a la migración 023, intacto.
    vi.mocked(sql).mockResolvedValue([] as never)

    await POST(buildRequest({ questionTypes: ['multiple_choice', 'short_answer'] }))
    const prompt = systemPrompt()

    expect(prompt).toContain('Distribuí las preguntas de forma pareja entre los tipos solicitados.')
    expect(prompt).not.toContain('DISTRIBUCIÓN OBLIGATORIA POR TIPO')
  })

  it('sin tipos elegidos ni mezcla declarada sigue siendo opción múltiple', async () => {
    vi.mocked(sql).mockResolvedValue([] as never)

    await POST(buildRequest({}))
    const prompt = systemPrompt()

    expect(prompt).toContain('TIPO "multiple_choice"')
    expect(prompt).not.toContain('TIPO "numeric"')
  })
})
