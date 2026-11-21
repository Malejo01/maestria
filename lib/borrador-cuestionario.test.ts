import { describe, expect, it } from 'vitest'
import {
  armarBorrador,
  cargarBorrador,
  claveDeBorrador,
  descartarBorrador,
  evaluarBorrador,
  guardarBorrador,
  idDeBorrador,
  leerBorrador,
  reconciliarBorrador,
  resumenDeBorrador,
  serializarBorrador,
  type Almacen,
} from './borrador-cuestionario'
import type { Answer, Question, QuizConfig } from './types'

function pregunta(id: string, texto = `Pregunta ${id}`): Question {
  return {
    id,
    type: 'multiple_choice',
    question: texto,
    options: ['a', 'b', 'c', 'd'],
    correctAnswer: 0,
    explanation: '',
    topic: 't',
    topicName: 'Tema',
  } as Question
}

function respuesta(questionId: string, isCorrect = true): Answer {
  return {
    type: 'multiple_choice',
    questionId,
    questionText: '',
    isCorrect,
    topic: 't',
    topicName: 'Tema',
    explanation: '',
    options: ['a', 'b', 'c', 'd'],
    selectedAnswer: isCorrect ? 0 : 1,
    correctAnswer: 0,
  }
}

const tarea: QuizConfig = {
  subject: 'classroom-4',
  subjectName: 'Matemática',
  topics: [],
  mode: 'mixto',
  questionCount: 20,
  classroomId: 4,
  assignmentId: 12,
  teacherQuizId: 41,
  dueAt: '2026-11-30T03:00:00.000Z',
}

const veinte = Array.from({ length: 20 }, (_, i) => pregunta(`q${i + 1}`))
const ahora = new Date('2026-11-21T15:00:00.000Z')

function almacenDePrueba(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>()
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
    removeItem: (k) => void datos.delete(k),
  }
}

function borradorCon(respondidas: number, config = tarea, preguntas = veinte) {
  const b = armarBorrador(
    {
      config,
      questions: preguntas,
      answers: preguntas.slice(0, respondidas).map((q) => respuesta(q.id)),
      currentIndex: respondidas,
      startedAt: '2026-11-21T14:40:00.000Z',
    },
    { ahora },
  )
  if (!b) throw new Error('sin borrador')
  return b
}

describe('idDeBorrador', () => {
  it('tarea, cuestionario del docente y práctica libre', () => {
    expect(idDeBorrador(tarea)).toBe('tarea-12')
    expect(idDeBorrador({ ...tarea, assignmentId: undefined })).toBe('cuestionario-41')
    expect(idDeBorrador({ ...tarea, assignmentId: undefined, teacherQuizId: undefined })).toBe('practica')
  })

  it('la vista previa del docente no tiene borrador', () => {
    expect(idDeBorrador({ ...tarea, previewOnly: true })).toBeNull()
    expect(idDeBorrador(null)).toBeNull()
  })

  it('la clave lleva la persona y el cuestionario', () => {
    expect(claveDeBorrador('u-1', 'tarea-12')).toBe('maestria:borrador:u-1:tarea-12')
  })
})

describe('guardar y recuperar', () => {
  it('guarda después de responder y recupera lo mismo', () => {
    const almacen = almacenDePrueba()
    const b = borradorCon(12)
    expect(guardarBorrador(almacen, 'u-1', b)).toBe(true)
    expect(almacen.datos.has('maestria:borrador:u-1:tarea-12')).toBe(true)

    const leido = cargarBorrador(almacen, 'u-1', 'tarea-12')
    expect(leido).toEqual(b)
    expect(resumenDeBorrador(leido!)).toEqual({ respondidas: 12, total: 20 })
  })

  it('sin respuestas no hay borrador (no pisa uno anterior al abrir)', () => {
    expect(
      armarBorrador({ config: tarea, questions: veinte, answers: [], currentIndex: 0, startedAt: null }, { ahora }),
    ).toBeNull()
  })

  it('la tarea guarda sólo los ids; la práctica libre guarda las preguntas', () => {
    expect(borradorCon(3).preguntas).toBeUndefined()
    const practica = borradorCon(3, { ...tarea, assignmentId: undefined, teacherQuizId: undefined, dueAt: undefined })
    expect(practica.id).toBe('practica')
    expect(practica.preguntas).toHaveLength(20)
  })

  it('otra persona en el mismo dispositivo no ve el borrador', () => {
    const almacen = almacenDePrueba()
    guardarBorrador(almacen, 'u-1', borradorCon(5))
    expect(cargarBorrador(almacen, 'u-2', 'tarea-12')).toBeNull()
  })

  it('lo que no tiene la forma esperada se ignora', () => {
    expect(leerBorrador('{no es json')).toBeNull()
    expect(leerBorrador(JSON.stringify({ version: 2 }))).toBeNull()
    expect(leerBorrador(serializarBorrador(borradorCon(2)))).not.toBeNull()
  })

  it('un almacén que explota no rompe nada', () => {
    const roto: Almacen = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(guardarBorrador(roto, 'u-1', borradorCon(1))).toBe(false)
    expect(cargarBorrador(roto, 'u-1', 'tarea-12')).toBeNull()
    expect(() => descartarBorrador(roto, 'u-1', 'tarea-12')).not.toThrow()
    expect(guardarBorrador(null, 'u-1', borradorCon(1))).toBe(false)
  })
})

describe('evaluarBorrador', () => {
  it('sirve con las mismas preguntas', () => {
    expect(evaluarBorrador(borradorCon(5), { ahora, preguntasActuales: veinte })).toEqual({ valido: true })
  })

  it('se descarta si el docente cambió las preguntas', () => {
    const b = borradorCon(5)
    // Una pregunta menos.
    expect(evaluarBorrador(b, { ahora, preguntasActuales: veinte.slice(1) })).toEqual({ valido: false, motivo: 'preguntas' })
    // Mismos ids, una editada.
    const editadas = veinte.map((q) => (q.id === 'q3' ? pregunta('q3', 'Otra consigna') : q))
    expect(evaluarBorrador(b, { ahora, preguntasActuales: editadas })).toEqual({ valido: false, motivo: 'preguntas' })
    // Otra pregunta en lugar de una.
    const cambiadas = [...veinte.slice(0, 19), pregunta('q99')]
    expect(evaluarBorrador(b, { ahora, preguntasActuales: cambiadas })).toEqual({ valido: false, motivo: 'preguntas' })
  })

  it('el mismo conjunto en otro orden sigue sirviendo', () => {
    expect(evaluarBorrador(borradorCon(5), { ahora, preguntasActuales: [...veinte].reverse() })).toEqual({ valido: true })
  })

  it('se descarta si la tarea venció', () => {
    const despues = new Date('2026-11-30T03:00:00.000Z')
    expect(evaluarBorrador(borradorCon(5), { ahora: despues, preguntasActuales: veinte })).toEqual({
      valido: false,
      motivo: 'vencida',
    })
  })

  it('se descarta con más de 7 días', () => {
    const b = { ...borradorCon(5), venceEl: null }
    const ocho = new Date(ahora.getTime() + 8 * 24 * 60 * 60 * 1000)
    const seis = new Date(ahora.getTime() + 6 * 24 * 60 * 60 * 1000)
    expect(evaluarBorrador(b, { ahora: ocho, preguntasActuales: veinte })).toEqual({ valido: false, motivo: 'vieja' })
    expect(evaluarBorrador(b, { ahora: seis, preguntasActuales: veinte })).toEqual({ valido: true })
  })

  it('la práctica libre se compara contra sus propias preguntas', () => {
    const practica = borradorCon(3, { ...tarea, assignmentId: undefined, teacherQuizId: undefined, dueAt: undefined })
    expect(evaluarBorrador(practica, { ahora })).toEqual({ valido: true })
  })
})

describe('reconciliarBorrador', () => {
  it('sigue desde la primera sin responder (la 6 después de 5)', () => {
    const r = reconciliarBorrador(borradorCon(5), veinte)
    expect(r.currentIndex).toBe(5)
    expect(r.questions[5].id).toBe('q6')
    expect(r.answers).toHaveLength(5)
    expect(r.completo).toBe(false)
  })

  it('respeta el orden que le tocó, aunque el servidor las mande en otro', () => {
    const r = reconciliarBorrador(borradorCon(5), [...veinte].reverse())
    expect(r.questions.map((q) => q.id)).toEqual(veinte.map((q) => q.id))
  })

  it('con todo respondido va directo al resultado', () => {
    const r = reconciliarBorrador(borradorCon(20), veinte)
    expect(r.completo).toBe(true)
    expect(r.currentIndex).toBe(19)
  })

  it('la práctica libre vuelve con sus propias preguntas', () => {
    const practica = borradorCon(3, { ...tarea, assignmentId: undefined, teacherQuizId: undefined, dueAt: undefined })
    const r = reconciliarBorrador(practica)
    expect(r.questions).toHaveLength(20)
    expect(r.currentIndex).toBe(3)
  })
})
