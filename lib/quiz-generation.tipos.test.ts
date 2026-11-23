import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Ronda U · U1 — `generateQuiz` con un modelo simulado que omite tipos: si
 * falta un tipo pedido, pide una tanda chica sólo de ese tipo y reemplaza una
 * pregunta de un tipo que sobra. Lo que no se puede, lo avisa.
 */
const { generateObject } = vi.hoisted(() => ({ generateObject: vi.fn() }))

vi.mock('ai', () => ({ generateObject, generateText: vi.fn() }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => () => 'modelo-simulado' }))
vi.mock('@/lib/db', () => ({ sql: vi.fn(async () => []) }))
vi.mock('@/lib/observability', () => ({ captureAiSchemaFailure: vi.fn(), captureRouteFailure: vi.fn() }))

import { generateQuiz, type QuizRequestParams } from './quiz-generation'
import type { QuestionType } from './types'

const tema = { id: 't1', name: 'Elasticidad precio de la demanda' }

let n = 0
const base = () => {
  n++
  return { id: `x${n}`, topic: tema.id, topicName: tema.name, explanation: 'Porque sí.' }
}
const PREGUNTAS: Record<string, () => Record<string, unknown>> = {
  matching: () => ({
    ...base(),
    type: 'matching',
    question: `Uní cada concepto con su definición (${n}).`,
    pairs: [
      { left: `Elástica ${n}`, right: `Responde mucho ${n}` },
      { left: `Inelástica ${n}`, right: `Responde poco ${n}` },
      { left: `Unitaria ${n}`, right: `Responde igual ${n}` },
    ],
  }),
  multiple_response: () => ({
    ...base(),
    type: 'multiple_response',
    question: `¿Cuáles de estos bienes suelen tener demanda inelástica? (${n})`,
    options: ['Sal', 'Insulina', 'Viajes', 'Joyas'],
    correctAnswers: [0, 1],
  }),
  ddwtos: () => ({
    ...base(),
    type: 'ddwtos',
    question: `Arrastrá las palabras (${n}).`,
    text: `Si sube el [[1]], baja la [[2]] demandada sobre la [[3]] (${n}).`,
    choices: ['precio', 'cantidad', 'curva', 'oferta'],
  }),
  ordering: () => ({
    ...base(),
    type: 'ordering',
    question: `Ordená las etapas de un trabajo de campo (${n}).`,
    items: ['Elegir el problema', 'Entrar al campo', 'Escribir la etnografía'],
  }),
  calculated: () => ({
    ...base(),
    type: 'calculated',
    question: 'El precio sube de 100 a 110.',
    plantilla: 'El precio sube de {p} a {q}. ¿Cuál es la variación porcentual?',
    formula: '({q} - {p}) / {p} * 100',
    variables: [
      { name: 'p', min: 100, max: 200, decimals: 0 },
      { name: 'q', min: 210, max: 300, decimals: 0 },
    ],
    valores: { p: 100, q: 110 },
    correctAnswer: 10,
    tolerance: 0.01,
  }),
}

/** Lo que "genera" el modelo simulado para los tipos que le piden. */
function simular(respuestas: (tipos: QuestionType[], cantidad: number) => string[]) {
  generateObject.mockImplementation(async (args: { schemaDescription: string }) => {
    const m = args.schemaDescription.match(/exactamente (\d+) preguntas.*\(([^)]*)\)\.$/)
    const cantidad = Number(m?.[1] ?? 0)
    const tipos = (m?.[2] ?? '').split(', ') as QuestionType[]
    return { object: { questions: respuestas(tipos, cantidad).map((t) => PREGUNTAS[t]()) }, usage: undefined }
  })
}

const params = (tipos: QuestionType[], caracter: string, extra: Partial<QuizRequestParams> = {}): QuizRequestParams => ({
  subject: 'Economía',
  subjectUnits: [{ name: 'Unidad 1', caracter, topics: [tema] } as never],
  topics: [tema],
  mode: 'practico',
  previousQuestions: [],
  questionCount: 5,
  nivel: 'Secundario',
  carrera: '',
  difficulty: 'intermedio',
  explicitQuestionTypes: tipos,
  ...extra,
})

const G1: QuestionType[] = ['calculated', 'ddwtos', 'matching', 'multiple_response', 'ordering']

beforeEach(() => {
  generateObject.mockReset()
  n = 0
})

describe('generateQuiz · al menos uno de cada tipo pedido (U1)', () => {
  it('el caso del G1: faltan calculada y ordenamiento, se piden aparte y quedan los cinco', async () => {
    simular((tipos, cantidad) =>
      tipos.length === G1.length
        ? ['ddwtos', 'matching', 'matching', 'multiple_response', 'multiple_response'].slice(0, cantidad)
        : tipos,
    )
    const r = await generateQuiz(params(G1, 'cuantitativo'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.questions).toHaveLength(5)
    expect(new Set(r.questions.map((q) => q.type))).toEqual(new Set(G1))
    expect(r.avisosDeTipos).toBeUndefined()
    // Una sola tanda extra, sólo con los que faltaban.
    expect(generateObject).toHaveBeenCalledTimes(2)
    expect(generateObject.mock.calls[1][0].schemaDescription).toMatch(/exactamente 2 preguntas.*\(calculated, ordering\)/)
  })

  it('si con todos ya salen, no se llama de nuevo', async () => {
    simular(() => G1)
    const r = await generateQuiz(params(G1, 'cuantitativo'))
    expect(r.ok && r.questions).toHaveLength(5)
    expect(generateObject).toHaveBeenCalledTimes(1)
  })

  it('una calculada en una unidad conceptual no se fuerza: se avisa', async () => {
    simular((tipos) => (tipos.includes('matching') ? ['matching', 'ordering', 'matching', 'ordering', 'matching'] : tipos))
    const r = await generateQuiz(params(['calculated', 'matching', 'ordering'], 'conceptual'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.questions.some((q) => q.type === 'calculated')).toBe(false)
    expect(r.avisosDeTipos).toEqual([{ tipo: 'calculated', motivo: 'sin-calculos' }])
    // Ni siquiera se le pidió la calculada al modelo.
    for (const [args] of generateObject.mock.calls) expect(args.schemaDescription).not.toContain('calculated')
  })

  it('si el tipo no sale ni en la tanda extra, se avisa y el cuestionario igual se arma', async () => {
    simular((tipos, cantidad) => (tipos.includes('matching') ? Array(cantidad).fill('matching').map((t, i) => (i % 2 ? 'multiple_response' : t)) : []))
    const r = await generateQuiz(params(['matching', 'multiple_response', 'ordering'], 'cuantitativo'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.questions).toHaveLength(5)
    expect(r.avisosDeTipos).toEqual([{ tipo: 'ordering', motivo: 'no-salio' }])
    // La tanda normal y una sola extra, sólo con el que falta.
    expect(generateObject.mock.calls.filter(([a]) => a.schemaDescription.endsWith('(ordering).'))).toHaveLength(1)
  })

  it('un solo tipo pedido o los tipos por defecto no piden tandas extra', async () => {
    simular((tipos, cantidad) => Array(cantidad).fill(tipos[0]))
    await generateQuiz(params(['matching'], 'cuantitativo'))
    expect(generateObject).toHaveBeenCalledTimes(1)
    generateObject.mockClear()
    simular((_, cantidad) => Array(cantidad).fill('matching'))
    await generateQuiz(params(['matching', 'ordering'], 'cuantitativo', { tiposPorDefecto: true }))
    expect(generateObject.mock.calls.every(([a]) => !a.schemaDescription.endsWith('(ordering).'))).toBe(true)
  })

  it('con tiposAGarantizar (una mitad del mixto) garantiza sólo ésos', async () => {
    simular((tipos, cantidad) => (tipos.includes('ddwtos') ? Array(cantidad).fill('matching') : tipos))
    const r = await generateQuiz(params(G1, 'cuantitativo', { questionCount: 2, tiposAGarantizar: ['calculated', 'ordering'] }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(new Set(r.questions.map((q) => q.type))).toEqual(new Set(['calculated', 'ordering']))
  })
})
