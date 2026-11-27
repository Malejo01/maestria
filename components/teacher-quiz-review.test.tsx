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

/**
 * El flujo de regeneración, contra la forma REAL de las dos respuestas del
 * endpoint. La ruta devuelve `{ question }` con el id viejo conservado y
 * `origin: 'ai_regenerada'` (y NO guarda: el guardado pasa por el PATCH); el
 * fallo devuelve 502 con `{ question: null, error }`. Un mock que devolviera
 * "lo que el cliente espera" en vez de esto pasaría con el contrato roto — es
 * el mismo patrón del fixture desordenado de arriba.
 */
describe('TeacherQuizReview · regenerar una pregunta', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const preguntaRegenerada = {
    // Como la arma la ruta: claves del schema de Zod, id viejo conservado,
    // origin de regeneración y la nota del docente adentro.
    id: 'q1',
    type: 'multiple_choice',
    topic: 't1',
    topicName: 'Funciones polinómicas',
    question: 'Si p(x) tiene grado 3, ¿cuál es el grado de su derivada?',
    options: ['2', '3'],
    correctAnswer: 0,
    explanation: 'Derivar baja el grado en uno.',
    origin: 'ai_regenerada',
    rejectionNote: 'Muy parecida a la anterior',
  }

  it('acepta la propuesta: manda el índice y la nota, muestra la comparación y ensucia el estado', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ question: preguntaRegenerada }),
    } as Response)

    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Regenerar pregunta' }))
    await user.type(screen.getByRole('textbox'), 'Muy parecida a la anterior')
    await user.click(screen.getByRole('button', { name: 'Regenerar' }))

    // La comparación lado a lado, sin aplicar todavía.
    await waitFor(() => expect(screen.getByText('Pregunta nueva')).toBeTruthy())

    const [url, init] = vi.mocked(fetch).mock.calls.find(([u]) => !String(u).endsWith('/valoraciones'))!
    expect(String(url)).toBe('/api/teacher/quizzes/42/regenerate-question')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body).toEqual({ questionIndex: 0, rejectionNote: 'Muy parecida a la anterior' })

    await user.click(screen.getByRole('button', { name: 'Usar la nueva' }))

    // La pregunta quedó reemplazada en el estado local y el guardado sigue
    // pendiente: regenerar NO escribe, eso es del PATCH.
    expect(screen.getByText(/grado de su derivada/)).toBeTruthy()
    expect(screen.getByText('Cambios sin guardar')).toBeTruthy()
    expect(vi.mocked(fetch).mock.calls.filter(([u]) => !String(u).endsWith('/valoraciones'))).toHaveLength(1)
  })

  it('el 502 real ({question: null, error}) no abre la comparación ni toca la pregunta', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({
        question: null,
        error: 'No pudimos regenerar la pregunta. Volvé a intentarlo en unos instantes.',
      }),
    } as Response)

    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} />)

    await user.click(screen.getByRole('button', { name: 'Regenerar pregunta' }))
    await user.click(screen.getByRole('button', { name: 'Regenerar' }))

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([u]) => !String(u).endsWith('/valoraciones'))).toHaveLength(1))
    expect(screen.queryByText('Pregunta nueva')).toBeNull()
    expect(screen.getByText('El grado de p(x) es:')).toBeTruthy()
    expect(screen.getByText('Todo guardado')).toBeTruthy()
  })
})

describe('TeacherQuizReview · consigna que no encaja con su tipo (M2)', () => {
  const clarita = {
    id: 'q3',
    topic: 't1',
    topicName: 'Inecuaciones',
    type: 'true_false' as const,
    question:
      'Si al resolver una inecuación lineal multiplicamos ambos miembros por un número negativo, ¿qué sucede con el sentido de la desigualdad?',
    correctAnswer: true,
    explanation: 'Se invierte.',
  }

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      // Una Response nueva por llamada: el cuerpo se lee una sola vez, y al
      // abrir también se piden las valoraciones (O8).
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify({
            question: {
              ...pregunta({ id: 'q3', question: '¿Qué sucede con el sentido de la desigualdad?', options: ['Se invierte', 'Se mantiene', 'Desaparece', 'Depende'] }),
              origin: 'ai_regenerada',
            },
          }),
          { status: 200 },
        ),
      ),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra el aviso y "Pasar a opción múltiple" pide la misma consigna con opciones', async () => {
    render(<TeacherQuizReview quiz={{ ...quiz, questions: [clarita] }} onClose={() => {}} onSaved={() => {}} />)

    expect(screen.getByText('Esta consigna no encaja con su tipo')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Pasar a opción múltiple' }))

    const [url, init] = vi.mocked(fetch).mock.calls.find(([u]) => !String(u).endsWith('/valoraciones'))!
    expect(url).toBe('/api/teacher/quizzes/42/regenerate-question')
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ questionIndex: 0, convertirA: 'multiple_choice' })
    // La propuesta se compara antes de aplicarse, como cualquier regeneración.
    expect(await screen.findByText('Usar la nueva')).toBeTruthy()
  })

  it('"Editar" abre el editor de esa pregunta', async () => {
    render(<TeacherQuizReview quiz={{ ...quiz, questions: [clarita] }} onClose={() => {}} onSaved={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.queryByText('Esta consigna no encaja con su tipo')).toBeNull()
    expect(screen.getByRole('button', { name: 'Terminar edición' })).toBeTruthy()
  })

  it('una afirmación bien escrita no muestra nada', () => {
    render(
      <TeacherQuizReview
        quiz={{ ...quiz, questions: [{ ...clarita, question: 'El sentido de la desigualdad se invierte al multiplicar por un negativo.' }] }}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    )
    expect(screen.queryByText('Esta consigna no encaja con su tipo')).toBeNull()
  })
})

describe('TeacherQuizReview · AB7, «Revisá y aprobá»', () => {
  const dos: TeacherQuiz = { ...quiz, questions: [pregunta(), pregunta({ id: 'q2', question: '¿Cuántas raíces tiene?' })], questionCount: 2 }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('el paso se llama «Revisá y aprobá» y el contador sube al aprobar una', async () => {
    const user = userEvent.setup()
    render(<TeacherQuizReview quiz={dos} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('Revisá y aprobá')).toBeTruthy()
    expect(document.querySelector('[data-contador-revisadas]')?.textContent).toBe('0 de 2 revisadas')
    await user.click(screen.getByRole('button', { name: 'Aprobar la pregunta 1' }))
    expect(document.querySelector('[data-contador-revisadas]')?.textContent).toBe('1 de 2 revisadas')
    expect(screen.getByRole('button', { name: 'Aprobar la pregunta 1' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('sin onAprobarYMandar no aparece el botón de mandar', () => {
    render(<TeacherQuizReview quiz={dos} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.queryByRole('button', { name: /Aprobar todas y mandar/ })).toBeNull()
  })

  it('«Aprobar todas y mandar» sin cambios: aprueba todas y manda sin guardar', async () => {
    const user = userEvent.setup()
    const onAprobarYMandar = vi.fn()
    render(<TeacherQuizReview quiz={dos} onClose={() => {}} onSaved={() => {}} onAprobarYMandar={onAprobarYMandar} />)
    await user.click(screen.getByRole('button', { name: /Aprobar todas y mandar/ }))
    expect(document.querySelector('[data-contador-revisadas]')?.textContent).toBe('2 de 2 revisadas')
    // Al abrir se leen las valoraciones; lo que no tiene que haber es un PATCH.
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')).toBe(false)
    expect(onAprobarYMandar).toHaveBeenCalledWith(expect.objectContaining({ id: 42, questions: dos.questions }))
  })

  it('«Aprobar todas y mandar» con cambios: primero guarda y manda lo guardado', async () => {
    const user = userEvent.setup()
    const onAprobarYMandar = vi.fn()
    // Una respuesta nueva por llamada (el cuerpo se lee una sola vez); el PATCH devuelve lo guardado.
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      (init as RequestInit | undefined)?.method === 'PATCH'
        ? new Response(JSON.stringify({ quiz: { id: 42, question_count: 1, questions: [comoLoDevuelvePostgres('Editada')] } }), { status: 200 })
        : new Response(JSON.stringify({}), { status: 200 }),
    )
    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} onAprobarYMandar={onAprobarYMandar} />)
    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    const enunciado = screen.getByDisplayValue('El grado de p(x) es:')
    await user.clear(enunciado)
    await user.type(enunciado, 'Editada')
    await user.click(screen.getByRole('button', { name: /Aprobar todas y mandar/ }))
    await waitFor(() => expect(onAprobarYMandar).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith('/api/teacher/quizzes/42', expect.objectContaining({ method: 'PATCH' }))
    expect(onAprobarYMandar.mock.calls[0][0].questions[0].question).toBe('Editada')
  })

  it('si el servidor pide decidir (ya hay intentos), no manda', async () => {
    const user = userEvent.setup()
    const onAprobarYMandar = vi.fn()
    vi.mocked(fetch).mockImplementation(async (_url, init) =>
      (init as RequestInit | undefined)?.method === 'PATCH'
        ? new Response(JSON.stringify({ requiresDecision: true, impact: { assignments: [], totalAttempts: 3, totalStudents: 2, requiresDecision: true } }), { status: 409 })
        : new Response(JSON.stringify({}), { status: 200 }),
    )
    render(<TeacherQuizReview quiz={quiz} onClose={() => {}} onSaved={() => {}} onAprobarYMandar={onAprobarYMandar} />)
    await user.click(screen.getByRole('button', { name: 'Editar pregunta' }))
    await user.type(screen.getByDisplayValue('El grado de p(x) es:'), ' x')
    await user.click(screen.getByRole('button', { name: /Aprobar todas y mandar/ }))
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')).toBe(true))
    expect(onAprobarYMandar).not.toHaveBeenCalled()
  })
})
