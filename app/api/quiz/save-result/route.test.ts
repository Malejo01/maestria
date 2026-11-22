import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

/**
 * M1. Reintentar el guardado de un resultado no crea dos intentos: con un
 * `clientAttemptId` que ya está guardado, save-result devuelve 200 con el
 * intento existente y no inserta nada. Sin la 029 (la columna no existe), el
 * id se ignora y se guarda como siempre.
 */

interface Consulta {
  texto: string
  valores: unknown[]
}

const ejecutadas: Consulta[] = []
const enTransaccion: Consulta[][] = []
let responder: (c: Consulta) => unknown = () => []
let fallarTransaccion: unknown = null

vi.mock('@/lib/db', () => {
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...valores: unknown[]) => {
      const consulta = { texto: strings.join('?').replace(/\s+/g, ' ').trim(), valores }
      // Igual que el driver: la consulta corre recién cuando alguien la espera.
      return {
        consulta,
        then(ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) {
          ejecutadas.push(consulta)
          return Promise.resolve()
            .then(() => responder(consulta))
            .then(ok, mal)
        },
      }
    },
    {
      transaction: vi.fn(async (consultas: { consulta: Consulta }[]) => {
        if (fallarTransaccion) throw fallarTransaccion
        enTransaccion.push(consultas.map((c) => c.consulta))
        return []
      }),
    },
  )
  return { sql }
})
vi.mock('@/lib/observability', () => ({ captureRouteFailure: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({
  getViewer: vi.fn().mockResolvedValue({ id: 'alumno-1', role: 'ALUMNO', isGuest: false, displayName: 'Clara', email: null }),
}))


function pedido(cuerpo: Record<string, unknown>) {
  return new Request('http://localhost/api/quiz/save-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: 'Matemática',
      mode: 'practico',
      topics: [{ id: 't1', name: 'Inecuaciones' }],
      totalQuestions: 1,
      correctAnswers: 1,
      ungradedAnswers: 0,
      score: 10,
      answers: [
        {
          type: 'true_false',
          questionId: 'q1',
          questionText: 'El sentido de la desigualdad se invierte.',
          isCorrect: true,
          selectedAnswer: true,
          correctAnswer: true,
          topic: 't1',
          topicName: 'Inecuaciones',
          explanation: '',
        },
      ],
      ...cuerpo,
    }),
  })
}

const ID = '3f2b8c1e-7a4d-4b1e-9c2a-5d6e7f8a9b0c'

beforeEach(() => {
  ejecutadas.length = 0
  enTransaccion.length = 0
  fallarTransaccion = null
  responder = () => []
})

describe('save-result idempotente (M1)', () => {
  it('con un clientAttemptId ya guardado devuelve 200 con el intento existente, sin insertar', async () => {
    responder = (c) =>
      c.texto.includes('client_attempt_id =')
        ? [{ id: 501, classroom_id: 4, assignment_id: 12, attempt_number: 1 }]
        : []

    const res = await POST(pedido({ clientAttemptId: ID, assignmentId: 12, classroomId: 4 }))
    expect(res.status).toBe(200)
    const datos = await res.json()
    expect(datos).toMatchObject({ success: true, quizAttemptId: 501, assignmentId: 12, attemptNumber: 1, duplicado: true })

    // Ni una inserción, ni la revisión de la ventana o del cupo: el primer
    // envío pudo haber gastado el último intento.
    expect(ejecutadas.some((c) => /INSERT/i.test(c.texto))).toBe(false)
    expect(ejecutadas.some((c) => c.texto.includes('classroom_assignments'))).toBe(false)
    expect(enTransaccion).toHaveLength(0)
  })

  it('la primera vez guarda el intento con su clientAttemptId, junto con las respuestas', async () => {
    responder = (c) => (c.texto.includes('nextval') ? [{ id: 777 }] : [])

    const res = await POST(pedido({ clientAttemptId: ID }))
    expect(res.status).toBe(200)
    expect((await res.json()).quizAttemptId).toBe(777)

    expect(enTransaccion).toHaveLength(1)
    const [intento, ...respuestas] = enTransaccion[0]
    expect(intento.texto).toContain('client_attempt_id')
    expect(intento.valores).toContain(ID)
    expect(intento.valores[0]).toBe(777)
    expect(respuestas).toHaveLength(1)
    expect(respuestas[0].texto).toContain('INSERT INTO quiz_answers')
    expect(respuestas[0].valores[0]).toBe(777)
  })

  it('sin la 029 ignora el clientAttemptId y guarda como hoy', async () => {
    responder = (c) => {
      if (c.texto.includes('client_attempt_id =')) throw Object.assign(new Error('column does not exist'), { code: '42703' })
      return c.texto.includes('nextval') ? [{ id: 778 }] : []
    }

    const res = await POST(pedido({ clientAttemptId: ID }))
    expect(res.status).toBe(200)
    expect(enTransaccion).toHaveLength(1)
    expect(enTransaccion[0][0].texto).not.toContain('client_attempt_id')
  })

  it('dos envíos simultáneos: el que pierde contra el índice único devuelve el que ganó', async () => {
    let buscadas = 0
    responder = (c) => {
      if (c.texto.includes('client_attempt_id =')) {
        buscadas += 1
        return buscadas === 1 ? [] : [{ id: 900, classroom_id: null, assignment_id: null, attempt_number: null }]
      }
      return c.texto.includes('nextval') ? [{ id: 901 }] : []
    }
    fallarTransaccion = Object.assign(new Error('duplicate key'), { code: '23505' })

    const res = await POST(pedido({ clientAttemptId: ID }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ quizAttemptId: 900, duplicado: true })
  })

  it('un clientAttemptId con otra forma se ignora (no llega a la consulta)', async () => {
    responder = (c) => (c.texto.includes('nextval') ? [{ id: 779 }] : [])
    const res = await POST(pedido({ clientAttemptId: "x'; DROP TABLE" }))
    expect(res.status).toBe(200)
    expect(ejecutadas.some((c) => c.texto.includes('client_attempt_id ='))).toBe(false)
    expect(enTransaccion[0][0].texto).not.toContain('client_attempt_id')
  })
})

describe('P4 · la práctica extra no es un intento de la tarea', () => {
  it('se guarda sin tarea ni número de intento, en el grupo de la tarea, con su vínculo', async () => {
    responder = (c) => {
      if (c.texto.includes('nextval')) return [{ id: 880 }]
      if (c.texto.includes('FROM practicas_extra pe')) return [{ classroom_id: 4 }]
      return []
    }
    // Aunque el cliente mande también assignmentId, una práctica extra se guarda por su lado.
    const res = await POST(pedido({ clientAttemptId: ID, practicaExtraId: 31, classroomId: 99 }))
    expect(res.status).toBe(200)
    const datos = await res.json()
    expect(datos).toMatchObject({ classroomId: 4, assignmentId: null, attemptNumber: null })

    // Nunca se consulta el cupo ni la ventana de una tarea.
    expect(ejecutadas.some((c) => c.texto.includes('max_attempts'))).toBe(false)
    const [intento, vinculo] = enTransaccion[0]
    expect(intento.texto).toContain('INSERT INTO quiz_attempts')
    // classroom_id, assignment_id, attempt_number: el grupo de la tarea y nada más.
    const i = intento.valores.indexOf(4)
    expect(intento.valores.slice(i, i + 3)).toEqual([4, null, null])
    expect(vinculo.texto).toContain('UPDATE quiz_attempts SET practica_extra_id')
    expect(vinculo.valores).toEqual([31, 880])
  })

  it('una práctica ajena (o sin la 036) se guarda como práctica suelta, sin grupo ni vínculo', async () => {
    responder = (c) => (c.texto.includes('nextval') ? [{ id: 881 }] : [])
    const res = await POST(pedido({ practicaExtraId: 31 }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ classroomId: null, assignmentId: null })
    expect(enTransaccion[0].some((c) => c.texto.includes('practica_extra_id'))).toBe(false)
  })
})

