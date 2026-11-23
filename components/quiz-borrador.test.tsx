// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// X1: la pista lee la sesión; acá no hay SessionProvider.
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizEngine } from './quiz-engine'
import { useAppStore } from '@/lib/store'
import { armarBorrador, claveDeBorrador, guardarBorrador, cargarBorrador } from '@/lib/borrador-cuestionario'
import type { Answer, Question, QuizConfig } from '@/lib/types'

/**
 * M1. Responder 5 preguntas, cortar, recargar y seguir desde la 6 — en el
 * motor, con el borrador que dejó la sesión anterior en localStorage.
 */
vi.mock('@/hooks/use-viewer-id', () => ({ useViewerId: () => 'alumno-1' }))

const config: QuizConfig = {
  subject: 'classroom-4',
  subjectName: 'Matemática',
  topics: [],
  mode: 'practico',
  questionCount: 20,
  classroomId: 4,
  assignmentId: 12,
  teacherQuizId: 41,
}

const preguntas: Question[] = Array.from({ length: 20 }, (_, i) => ({
  id: `q${i + 1}`,
  type: 'multiple_choice',
  question: `Enunciado número ${i + 1}`,
  options: ['uno', 'dos', 'tres', 'cuatro'],
  correctAnswer: 0,
  explanation: '',
  topic: 't',
  topicName: 'Tema',
})) as Question[]

function respuesta(q: Question): Answer {
  return {
    type: 'multiple_choice',
    questionId: q.id,
    questionText: q.question,
    isCorrect: true,
    topic: 't',
    topicName: 'Tema',
    explanation: '',
    options: ['uno', 'dos', 'tres', 'cuatro'],
    selectedAnswer: 0,
    correctAnswer: 0,
  }
}

function dejarBorradorDeCinco() {
  const b = armarBorrador(
    { config, questions: preguntas, answers: preguntas.slice(0, 5).map(respuesta), currentIndex: 5, startedAt: '2026-11-21T14:00:00.000Z' },
    { ahora: new Date() },
  )!
  guardarBorrador(window.localStorage, 'alumno-1', b)
}

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  act(() => useAppStore.getState().resetQuiz())
})

describe('seguir donde estaba', () => {
  it('ofrece seguir y vuelve a la pregunta 6', async () => {
    dejarBorradorDeCinco()
    act(() => useAppStore.getState().startQuiz(config, preguntas))
    render(<QuizEngine />)

    expect(await screen.findByText('Tenés un cuestionario empezado')).toBeTruthy()
    expect(screen.getByText('5 de 20 respondidas')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Seguir donde estaba' }))

    expect(await screen.findByText('Enunciado número 6')).toBeTruthy()
    expect(useAppStore.getState().currentQuiz.answers).toHaveLength(5)
    expect(useAppStore.getState().currentQuiz.currentIndex).toBe(5)
  })

  it('empezar de nuevo pide confirmación y borra el borrador', async () => {
    dejarBorradorDeCinco()
    act(() => useAppStore.getState().startQuiz(config, preguntas))
    render(<QuizEngine />)

    await userEvent.click(await screen.findByRole('button', { name: 'Empezar de nuevo' }))
    expect(screen.getByText('¿Empezás de nuevo?')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Sí, empezar de nuevo' }))

    expect(await screen.findByText('Enunciado número 1')).toBeTruthy()
    expect(window.localStorage.getItem(claveDeBorrador('alumno-1', 'tarea-12'))).toBeNull()
  })

  it('si el docente editó la tarea, no ofrece nada y descarta el borrador', async () => {
    dejarBorradorDeCinco()
    const editadas = preguntas.map((q) => (q.id === 'q2' ? { ...q, question: 'Otra consigna' } : q))
    act(() => useAppStore.getState().startQuiz(config, editadas))
    render(<QuizEngine />)

    expect(await screen.findByText('Enunciado número 1')).toBeTruthy()
    expect(screen.queryByText('Tenés un cuestionario empezado')).toBeNull()
    expect(cargarBorrador(window.localStorage, 'alumno-1', 'tarea-12')).toBeNull()
  })

  it('escribe el borrador después de cada respuesta', async () => {
    act(() => useAppStore.getState().startQuiz(config, preguntas))
    render(<QuizEngine />)
    expect(await screen.findByText('Enunciado número 1')).toBeTruthy()
    expect(cargarBorrador(window.localStorage, 'alumno-1', 'tarea-12')).toBeNull()

    await userEvent.click(screen.getByRole('radio', { name: /uno/ }))
    await userEvent.click(screen.getByRole('button', { name: /verificar/i }))

    const borrador = cargarBorrador(window.localStorage, 'alumno-1', 'tarea-12')
    expect(borrador?.answers.map((a) => a.questionId)).toEqual(['q1'])
    expect(borrador?.ordenDePreguntas).toHaveLength(20)
  })

  it('la vista previa del docente no ofrece ni escribe borrador', async () => {
    dejarBorradorDeCinco()
    act(() => useAppStore.getState().startQuizPreview(config, preguntas))
    render(<QuizEngine />)
    expect(await screen.findByText('Enunciado número 1')).toBeTruthy()
    expect(screen.queryByText('Tenés un cuestionario empezado')).toBeNull()
  })
})
