// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

/** Decisión 1 de la tanda P (ronda T · A4): la pantalla de resultados sin Revancha en lo que tiene nota. */
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null, status: 'unauthenticated' }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('@/hooks/use-pendientes-de-guardado', () => ({ usePendientesDeGuardado: () => ({ cola: null, viewerId: null }) }))
vi.mock('@/components/alumno/practica-extra', () => ({ PracticaExtra: () => <p>Practicar otra vez con preguntas nuevas</p> }))

import { ResultsScreen } from './results-screen'
import { useAppStore } from '@/lib/store'
import type { Answer, QuizConfig, Question } from '@/lib/types'

const pregunta: Question = {
  id: 'q1',
  type: 'multiple_choice',
  topic: 't1',
  topicName: 'Fracciones',
  question: '¿Cuánto es 1/2 + 1/2?',
  explanation: 'Un entero.',
  options: ['0', '1', '2', '3'],
  correctAnswer: 1,
}
const errada = { questionId: 'q1', type: 'multiple_choice', selectedAnswer: 0, correctAnswer: 1, isCorrect: false, questionText: pregunta.question, topic: 't1', topicName: 'Fracciones', explanation: 'x', options: pregunta.options } as unknown as Answer
const base: QuizConfig = { subject: 'mat', subjectName: 'Matemática', topics: [{ id: 't1', name: 'Fracciones' }], mode: 'practico', questionCount: 1 }

function mostrar(config: QuizConfig) {
  act(() => {
    useAppStore.setState({ currentQuiz: { config, questions: [pregunta], currentIndex: 0, answers: [errada], startedAt: null } })
  })
  render(<ResultsScreen />)
}

afterEach(() => {
  cleanup()
  act(() => useAppStore.getState().resetQuiz())
})

describe('ResultsScreen — la Revancha', () => {
  it('práctica libre desaprobada: "Tomar revancha de todo el cuestionario"', () => {
    mostrar(base)
    expect(screen.queryByText(/Tomar revancha/)).not.toBeNull()
  })

  it('tarea desaprobada: sin Revancha, con "Practicar otra vez"', () => {
    mostrar({ ...base, assignmentId: 12, classroomId: 4 })
    expect(screen.queryByText(/revancha/i)).toBeNull()
    expect(screen.queryByText('Practicar otra vez con preguntas nuevas')).not.toBeNull()
  })

  it('diagnóstico (es una tarea): sin Revancha', () => {
    mostrar({ ...base, assignmentId: 30, classroomId: 4, devolucion: 'al_final' } as QuizConfig)
    expect(screen.queryByText(/revancha/i)).toBeNull()
  })
})
