// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react'
import { QuizEngine } from './quiz-engine'
import { useAppStore } from '@/lib/store'
import type { QuizConfig, ShortAnswerQuestion } from '@/lib/types'

/**
 * El fail-open de la corrección de respuestas cortas.
 *
 * El bug original tenía dos partes, y la segunda es la que casi no se ve:
 *
 *   const data = await response.json()
 *   const isCorrect = Boolean(data.isCorrect)
 *
 * `fetch` sólo rechaza por fallo de red, así que un **500 no lanza**: entraba
 * por el camino feliz, `data.isCorrect` daba `undefined`, `Boolean(undefined)`
 * daba `false`, y la respuesta se guardaba como incorrecta sin que el alumno
 * viera un solo aviso. El `catch` que existía sólo cubría la caída de red — y
 * aun ahí pasaba `isCorrect: false`.
 *
 * En la prueba del 2026-08-10 el endpoint falló ~224 veces sobre 238 respuestas.
 */

const config: QuizConfig = {
  subject: 'mat',
  subjectName: 'Matemática',
  topics: [{ id: 't1', name: 'Cónicas' }],
  mode: 'teorico',
  questionCount: 1,
  questionTypes: ['short_answer'],
}

/** Pregunta real del examen: la respuesta esperada NO coincide literalmente. */
const preguntaConceptual: ShortAnswerQuestion = {
  id: 'q1',
  type: 'short_answer',
  topic: 't1',
  topicName: 'Cónicas',
  question: '¿Cómo se llaman los dos puntos fijos de una elipse?',
  explanation: 'Se llaman focos.',
  acceptedAnswers: ['focos', 'los focos'],
}

/** Caso `alexpng15`: escribió exactamente lo esperado y quedó incorrecta. */
const preguntaLiteral: ShortAnswerQuestion = {
  id: 'q2',
  type: 'short_answer',
  topic: 't1',
  topicName: 'Aritmética',
  question: 'Calculá 3 · (5 − 2) + 8 ÷ 2',
  explanation: 'Es 13.',
  acceptedAnswers: ['13'],
}

function startQuizWith(questions: ShortAnswerQuestion[]) {
  act(() => {
    useAppStore.getState().startQuiz(config, questions)
  })
}

function escribirYVerificar(texto: string) {
  const textarea = screen.getByPlaceholderText('Escribe tu respuesta...')
  fireEvent.change(textarea, { target: { value: texto } })
  act(() => {
    screen.getByRole('button', { name: 'Verificar' }).click()
  })
}

/** La respuesta guardada en el store, que es la que termina en quiz_answers. */
function respuestaGuardada() {
  return useAppStore.getState().currentQuiz.answers[0]
}

beforeEach(() => {
  vi.stubGlobal('confirm', () => true)
})

afterEach(() => {
  cleanup()
  act(() => {
    useAppStore.getState().resetQuiz()
  })
  vi.unstubAllGlobals()
})

describe('corrección determinista, antes de la IA', () => {
  it('no llama a la API cuando la respuesta coincide con la esperada', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    startQuizWith([preguntaLiteral])
    render(<QuizEngine />)
    escribirYVerificar('13')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())

    // Lo importante no es sólo que acierte: es que no haya red de por medio.
    // Con Gemini caído, este caso se sigue corrigiendo bien — y no abre fila
    // en ai_usage_log ni consume rate limit.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(respuestaGuardada()).toMatchObject({ isCorrect: true })
    expect(respuestaGuardada().gradingStatus).toBeUndefined()
  })

  it('tolera tildes y mayúsculas sin salir del browser', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('Focos')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(respuestaGuardada()).toMatchObject({ isCorrect: true })
  })
})

describe('fail-open: la IA no contesta', () => {
  it('un 500 NO se guarda como incorrecta', async () => {
    // El corazón del bug: 500 con cuerpo de error, que no lanza.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'No se pudo corregir la respuesta' }),
    }))

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('los puntos de referencia')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())

    expect(respuestaGuardada().gradingStatus).toBe('ungraded')
    // Antes de este arreglo, esto era `true`.
    expect(respuestaGuardada().isCorrect).toBe(false)
  })

  it('se lo dice al alumno en vez de fallar en silencio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    }))

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('algo')

    // Ni "Correcto!" ni "Respuesta Incorrecta": un tercer estado propio.
    await waitFor(() => expect(screen.getByText('Sin calificar')).toBeTruthy())
    expect(screen.queryByText('Respuesta Incorrecta')).toBeNull()
    expect(screen.getByText(/No cuenta como error en tu nota/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Reintentar la corrección/ })).toBeTruthy()
  })

  it('un fallo de red también queda sin calificar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('algo')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())
    expect(respuestaGuardada().gradingStatus).toBe('ungraded')
  })

  it('un 200 con un cuerpo sin booleano tampoco es una corrección', async () => {
    // El schema del modelo puede volver incompleto sin que el HTTP falle.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ feedback: 'mmm' }),
    }))

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('algo')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())
    expect(respuestaGuardada().gradingStatus).toBe('ungraded')
  })

  it('el reintento puede resolver lo que quedó sin calificar', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ isCorrect: true, feedback: 'Bien.' }) })
    vi.stubGlobal('fetch', fetchMock)

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('los puntos de referencia')

    await waitFor(() => expect(screen.getByText('Sin calificar')).toBeTruthy())

    act(() => {
      screen.getByRole('button', { name: /Reintentar la corrección/ }).click()
    })

    await waitFor(() => expect(respuestaGuardada().gradingStatus).toBeUndefined())
    expect(respuestaGuardada()).toMatchObject({ isCorrect: true })
  })
})

describe('la IA sí contesta', () => {
  it('respeta el veredicto negativo del modelo', async () => {
    // Un fallo real tiene que seguir siendo un fallo: el fail-open no puede
    // convertirse en "todo lo que no entiendo lo perdono".
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ isCorrect: false, feedback: 'Se llaman focos.' }),
    }))

    startQuizWith([preguntaConceptual])
    render(<QuizEngine />)
    escribirYVerificar('vértices')

    await waitFor(() => expect(respuestaGuardada()).toBeTruthy())
    expect(respuestaGuardada().isCorrect).toBe(false)
    expect(respuestaGuardada().gradingStatus).toBeUndefined()
    expect(screen.getByText('Respuesta Incorrecta')).toBeTruthy()
  })
})
