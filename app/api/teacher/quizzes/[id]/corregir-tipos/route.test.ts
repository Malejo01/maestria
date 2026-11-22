import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Question } from '@/lib/types'

/**
 * N2. El endpoint con el modelo SIMULADO: sí/no → afirmación con el mismo valor
 * de verdad, abierta → opción múltiple, una respuesta que cambia el valor de
 * verdad se rechaza, y nada se escribe (sin aplicar no hay UPDATE ni INSERT).
 */
const { getTeacherViewer, generateObject, consultas, guard } = vi.hoisted(() => ({
  getTeacherViewer: vi.fn(),
  generateObject: vi.fn(),
  consultas: [] as string[],
  guard: { finish: vi.fn(), fail: vi.fn() },
}))
let preguntasGuardadas: Question[] = []

vi.mock('@/lib/auth-session', () => ({ getTeacherViewer }))
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/planes-server', () => ({ bloqueoParaGenerar: vi.fn(async () => null) }))
vi.mock('@/lib/ai-guard', () => ({ guardAiCall: vi.fn(async () => ({ ok: true, ...guard })) }))
vi.mock('ai', () => ({ generateObject }))
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => () => 'modelo-simulado' }))
vi.mock('@/lib/db', () => ({
  sql: (strings: TemplateStringsArray, ...valores: unknown[]) => {
    const texto = strings.join('?').replace(/\s+/g, ' ')
    consultas.push(texto)
    return Promise.resolve(texto.includes('FROM teacher_quizzes') && valores[1] === 'irina' ? [{ id: 41, questions: preguntasGuardadas }] : [])
  },
}))

import { POST } from './route'

const siNo: Question = {
  id: 'q1',
  type: 'true_false',
  topic: 'divisibilidad',
  topicName: 'Divisibilidad',
  question: 'Aplicando el criterio de divisibilidad, ¿es el número 1.242 divisible por 9?',
  correctAnswer: true,
  explanation: '1 + 2 + 4 + 2 = 9.',
}
const abierta: Question = {
  id: 'q2',
  type: 'true_false',
  topic: 'inecuaciones',
  topicName: 'Inecuaciones',
  question: 'Al multiplicar por un número negativo, ¿qué sucede con el sentido de la desigualdad?',
  correctAnswer: true,
  explanation: 'Se invierte.',
}

const pedir = (cuerpo?: unknown) =>
  POST(new Request('http://x', { method: 'POST', body: cuerpo ? JSON.stringify(cuerpo) : undefined }), { params: Promise.resolve({ id: '41' }) })

beforeEach(() => {
  consultas.length = 0
  generateObject.mockReset()
  guard.finish.mockReset()
  getTeacherViewer.mockResolvedValue({ id: 'irina', email: 'irina@x' })
  preguntasGuardadas = [siNo, abierta]
})

describe('POST /api/teacher/quizzes/[id]/corregir-tipos', () => {
  it('sí/no → afirmación con el mismo valor de verdad; abierta → opción múltiple', async () => {
    generateObject
      .mockResolvedValueOnce({ object: { afirmacion: 'El número 1.242 es divisible por 9.', valorDeVerdad: true, topic: 'divisibilidad' }, usage: {} })
      .mockResolvedValueOnce({
        object: {
          question: 'Al multiplicar por un número negativo, ¿qué pasa con el sentido de la desigualdad?',
          options: ['Se invierte', 'Se mantiene', 'Se vuelve igualdad', 'Depende del número'],
          correctAnswer: 0,
          explanation: 'Se invierte.',
          topic: 'inecuaciones',
        },
        usage: {},
      })
    const { propuestas } = await (await pedir()).json()
    expect(propuestas).toHaveLength(2)
    expect(propuestas[0]).toMatchObject({ indice: 0, via: 'ia', despues: { type: 'true_false', correctAnswer: true, question: 'El número 1.242 es divisible por 9.' } })
    expect(propuestas[1]).toMatchObject({ indice: 1, via: 'ia', despues: { type: 'multiple_choice', correctAnswer: 0 } })
    expect(guard.finish).toHaveBeenCalledTimes(1)
  })

  it('una respuesta del modelo que cambia el valor de verdad se rechaza y la pregunta queda igual', async () => {
    preguntasGuardadas = [siNo]
    generateObject.mockResolvedValueOnce({ object: { afirmacion: 'El número 1.242 no es divisible por 9.', valorDeVerdad: false, topic: 'divisibilidad' } })
    const { propuestas } = await (await pedir()).json()
    expect(propuestas[0].despues).toBeNull()
    expect(propuestas[0].motivo).toMatch(/valor de verdad/)
  })

  it('sin aplicar no se escribe nada', async () => {
    generateObject.mockResolvedValue({ object: { afirmacion: 'El número 1.242 es divisible por 9.', valorDeVerdad: true, topic: 'divisibilidad' } })
    await pedir()
    expect(consultas.some((c) => /UPDATE|INSERT|DELETE/i.test(c))).toBe(false)
  })

  it('con las preguntas en pantalla (Revisar y editar) usa ésas', async () => {
    const { propuestas } = await (await pedir({ questions: [{ ...siNo, question: 'El 1.242 es divisible por 9.' }] })).json()
    expect(propuestas).toEqual([])
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('el cuestionario de otro docente da 404 y no llama al modelo', async () => {
    getTeacherViewer.mockResolvedValue({ id: 'joaquin', email: 'j@x' })
    expect((await pedir()).status).toBe(404)
    expect(generateObject).not.toHaveBeenCalled()
  })

  it('un alumno recibe 403', async () => {
    getTeacherViewer.mockResolvedValue(null)
    expect((await pedir()).status).toBe(403)
  })
})
