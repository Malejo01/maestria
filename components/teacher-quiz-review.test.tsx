// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeacherQuizReview } from './teacher-quiz-review'
import type { MultipleChoiceQuestion, TeacherQuiz } from '@/lib/types'

/**
 * Regresión del 24/08/2026, reportada probando con un cuestionario real:
 * después de guardar, el toast decía "Cuestionario guardado" pero el cartel
 * ámbar "Cambios sin guardar" seguía ahí, el botón Guardar seguía habilitado, y
 * salir pedía confirmación sobre un cuestionario que ya estaba guardado.
 *
 * ─── La causa ───────────────────────────────────────────────────────────────
 *
 * Postgres guarda `jsonb` reordenando las claves. La respuesta del PATCH vuelve
 * con el mismo dato y OTRO orden, así que comparar con `JSON.stringify` daba
 * distinto para siempre. Medido contra producción con `SELECT '{...}'::jsonb`:
 *
 *   enviado  : id, topic, topicName, type, question, options, correctAnswer...
 *   devuelto : id, type, topic, origin, options, question, topicName...
 *
 * ─── Por qué importa que este test exista ───────────────────────────────────
 *
 * El aviso de "cambios sin guardar" es la única defensa contra perder veinte
 * ediciones. Un aviso que aparece cuando no corresponde deja de leerse, y
 * entonces tampoco protege el día que sí corresponde. Por eso el fixture del
 * mock devuelve las claves DESORDENADAS a propósito: un mock que devuelva el
 * mismo orden que mandó el cliente pasa con el bug puesto y no prueba nada.
 */

const pregunta = (over: Partial<MultipleChoiceQuestion> = {}): MultipleChoiceQuestion => ({
  id: 'q1',
  topic: 't1',
  topicName: 'Funciones polinómicas',
  type: 'multiple_choice',
  question: 'El grado de p(x) es:',
  options: ['4', '3'],
  correctAnswer: 0,
  explanation: 'El mayor exponente.',
  ...over,
})

const quiz: TeacherQuiz = {
  id: 42,
  userId: 'u1',
  teacherProgramId: 14,
  title: 'Unidad 5',
  subjectName: 'Matemática',
  mode: 'mixto',
  status: 'saved',
  selectedTopics: [{ id: 't1', name: 'Funciones polinómicas' }],
  questionCount: 1,
  questions: [pregunta()],
  createdAt: '2026-08-24T00:00:00.000Z',
  updatedAt: '2026-08-24T00:00:00.000Z',
}

/**
 * Devuelve la pregunta con las claves en el orden en que las escupe `jsonb`,
 * que es lo que de verdad llega del PATCH.
 */
function comoLoDevuelvePostgres(texto: string) {
  return {
    id: 'q1',
    type: 'multiple_choice',
    topic: 't1',
    origin: 'editada',
    options: ['4', '3'],
    question: texto,
    topicName: 'Funciones polinómicas',
    explanation: 'El mayor exponente.',
    correctAnswer: 0,
  }
}

describe('TeacherQuizReview · estado de cambios sin guardar', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('arranca limpio y se ensucia al editar', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} />)

    expect(screen.getByText('Todo guardado')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Guardar/ }).hasAttribute('disabled')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    const enunciado = screen.getAllByRole('textbox')[0]
    await user.type(enunciado, '!')

    expect(screen.getByText('Cambios sin guardar')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Guardar/ }).hasAttribute('disabled')).toBe(false)
  })

  it('queda limpio después de guardar, aunque el servidor devuelva las claves en otro orden', async () => {
    const user = userEvent.setup()

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        quiz: {
          id: 42,
          question_count: 1,
          // Acá está el veneno: mismo dato, otro orden de claves.
          questions: [comoLoDevuelvePostgres('El grado de p(x) es:!')],
        },
      }),
    } as Response)

    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    await user.type(screen.getAllByRole('textbox')[0], '!')
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^Guardar/ }))

    // Lo que fallaba: el cartel se quedaba en "Cambios sin guardar".
    await waitFor(() => {
      expect(screen.getByText('Todo guardado')).toBeTruthy()
    })
    expect(screen.queryByText('Cambios sin guardar')).toBeNull()
    expect(screen.getByRole('button', { name: /^Guardar/ }).hasAttribute('disabled')).toBe(true)
  })

  it('después de guardar, salir NO pide confirmación', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        quiz: { id: 42, question_count: 1, questions: [comoLoDevuelvePostgres('El grado de p(x) es:!')] },
      }),
    } as Response)

    render(<TeacherQuizReview quiz={quiz} onClose={onClose} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    await user.type(screen.getAllByRole('textbox')[0], '!')
    await user.click(screen.getByRole('button', { name: /^Guardar/ }))
    await waitFor(() => expect(screen.getByText('Todo guardado')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    // Sin cambios pendientes, "Volver" tiene que salir derecho.
    expect(screen.queryByText('Tenés cambios sin guardar')).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('con cambios pendientes, salir SÍ pide confirmación', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(<TeacherQuizReview quiz={quiz} onClose={onClose} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    await user.type(screen.getAllByRole('textbox')[0], '!')
    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(screen.getByText('Tenés cambios sin guardar')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
  })
})
