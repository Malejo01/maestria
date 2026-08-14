import { describe, expect, it } from 'vitest'
import {
  countsAsCorrect,
  countsAsIncorrect,
  isGraded,
  scoreOutOfTen,
  tallyAnswers,
} from './answer-grading'
import type { Answer } from './types'

/**
 * El bug que estas funciones existen para impedir: `answers.filter(a => !a.isCorrect)`.
 * Con dos estados era correcto; con tres cuenta como error todo lo que nadie
 * pudo corregir. En la prueba del 2026-08-10 eso le cobró a los alumnos ~224
 * fallas de la API de corrección.
 */
function answer(overrides: Partial<Answer> = {}): Answer {
  return {
    questionId: 'q1',
    questionText: '¿?',
    isCorrect: false,
    topic: 't',
    topicName: 'Tema',
    explanation: '',
    type: 'short_answer',
    selectedText: 'x',
    acceptedAnswers: ['y'],
    ...overrides,
  } as Answer
}

const correcta = answer({ isCorrect: true })
const incorrecta = answer({ isCorrect: false })
/** `isCorrect` va en false porque el tipo lo exige; el que manda es gradingStatus. */
const sinCalificar = answer({ isCorrect: false, gradingStatus: 'ungraded' })

describe('isGraded', () => {
  it('la ausencia del campo significa corregida', () => {
    // Todas las respuestas guardadas antes de este cambio, y los otros tres
    // tipos de pregunta, que se corrigen en el proceso.
    expect(isGraded(answer())).toBe(true)
  })

  it('"graded" explícito también', () => {
    expect(isGraded(answer({ gradingStatus: 'graded' }))).toBe(true)
  })

  it('sólo "ungraded" es sin calificar', () => {
    expect(isGraded(sinCalificar)).toBe(false)
  })
})

describe('countsAsIncorrect — la función que reemplaza a !isCorrect', () => {
  it('una sin calificar NO es un error', () => {
    expect(countsAsIncorrect(sinCalificar)).toBe(false)
    // El contraste con el bug original, escrito al lado para que se vea:
    expect(!sinCalificar.isCorrect).toBe(true)
  })

  it('una incorrecta sí lo es', () => {
    expect(countsAsIncorrect(incorrecta)).toBe(true)
  })

  it('una correcta no lo es', () => {
    expect(countsAsIncorrect(correcta)).toBe(false)
  })
})

describe('countsAsCorrect', () => {
  it('una sin calificar tampoco es un acierto', () => {
    // No suma ni resta: sale de las dos bolsas.
    expect(countsAsCorrect(sinCalificar)).toBe(false)
  })

  it('una correcta sí', () => {
    expect(countsAsCorrect(correcta)).toBe(true)
  })
})

describe('tallyAnswers', () => {
  it('separa las tres categorías y excluye las sin calificar del denominador', () => {
    const tally = tallyAnswers([correcta, correcta, incorrecta, sinCalificar])

    expect(tally).toEqual({ correct: 2, incorrect: 1, ungraded: 1, graded: 3 })
  })

  it('graded nunca incluye las sin calificar', () => {
    const tally = tallyAnswers([sinCalificar, sinCalificar])
    expect(tally.graded).toBe(0)
    expect(tally.ungraded).toBe(2)
  })
})

describe('scoreOutOfTen', () => {
  it('puntúa sobre lo corregido, no sobre el total de preguntas', () => {
    // 8 correctas, 2 sin calificar: es un 10, no un 8. Ese es todo el arreglo.
    const tally = tallyAnswers([...Array(8).fill(correcta), sinCalificar, sinCalificar])
    expect(scoreOutOfTen(tally)).toBe(10)
  })

  it('una sin calificar no baja la nota', () => {
    const conFalla = scoreOutOfTen(tallyAnswers([correcta, correcta, sinCalificar]))
    const sinFalla = scoreOutOfTen(tallyAnswers([correcta, correcta]))
    expect(conFalla).toBe(sinFalla)
  })

  it('un error sí la baja', () => {
    expect(scoreOutOfTen(tallyAnswers([correcta, correcta, incorrecta]))).toBeCloseTo(6.67, 2)
  })

  it('devuelve null —no 0— cuando no se pudo corregir nada', () => {
    // Un 0 diría "no acertó ninguna". Lo que pasó es que no se evaluó nada, y
    // quien llame tiene que poder distinguirlo para ofrecer reintentar.
    expect(scoreOutOfTen(tallyAnswers([sinCalificar, sinCalificar]))).toBeNull()
  })

  it('sin respuestas también es null', () => {
    expect(scoreOutOfTen(tallyAnswers([]))).toBeNull()
  })
})

describe('el escenario del 2026-08-10', () => {
  it('un cuestionario donde la IA se cayó entero no da 0', () => {
    // 5 preguntas: 2 multiple_choice bien, 3 short_answer que no se pudieron
    // corregir. Antes: 2/5 = 4 (aplazado). Ahora: 2/2 = 10.
    const respuestas = [
      answer({ type: 'multiple_choice', isCorrect: true, options: [], selectedAnswer: 0, correctAnswer: 0 }),
      answer({ type: 'multiple_choice', isCorrect: true, options: [], selectedAnswer: 0, correctAnswer: 0 }),
      sinCalificar,
      sinCalificar,
      sinCalificar,
    ]

    const tally = tallyAnswers(respuestas)
    expect(tally).toMatchObject({ correct: 2, incorrect: 0, ungraded: 3, graded: 2 })
    expect(scoreOutOfTen(tally)).toBe(10)
  })
})
