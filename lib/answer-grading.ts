/**
 * Corrección por tipo de pregunta, y cómo se cuenta una respuesta para la nota
 * cuando "corregida" dejó de ser algo que se puede dar por hecho.
 *
 * Existe porque el bug que originó todo esto era un solo carácter:
 * `answers.filter(a => !a.isCorrect)`. Con dos estados eso era correcto; con
 * tres es una mentira, porque mete en la bolsa de errores todo lo que nadie
 * pudo corregir. En la prueba del 2026-08-10 eso significó que ~224 fallas de
 * la API se le cobraran a los alumnos como respuestas mal.
 *
 * La regla es una sola y está acá para que no se pueda reescribir mal en cada
 * call site: **una respuesta sin calificar no suma ni resta**. Sale del
 * numerador y también del denominador — no es un error, y tampoco un acierto.
 */
import type { Answer, MultipleChoiceQuestion, NumericQuestion, TrueFalseQuestion } from './types'

// ─── Corrección en el proceso, por tipo ──────────────────────────────────────
// Estos tres se resuelven sin salir del browser, así que nunca quedan sin
// calificar. El único tipo que depende de un servicio externo —y por lo tanto
// el único que puede terminar `ungraded`— es `short_answer`.

export function isCorrectMultipleChoice(question: MultipleChoiceQuestion, selected: number): boolean {
  return selected === question.correctAnswer
}

export function isCorrectTrueFalse(question: TrueFalseQuestion, selected: boolean): boolean {
  return selected === question.correctAnswer
}

export function isCorrectNumeric(question: NumericQuestion, selected: number): boolean {
  const tolerance = question.tolerance ?? 0
  return Math.abs(selected - question.correctAnswer) <= tolerance
}

// ─── Conteo para la nota ─────────────────────────────────────────────────────

/**
 * ¿La corrección llegó a correr?
 *
 * El campo es opcional, así que su ausencia tiene que significar `true`: los
 * otros tres tipos de pregunta nunca lo escriben, y ninguna de las respuestas
 * guardadas antes de este cambio lo trae.
 */
export function isGraded(answer: Pick<Answer, 'gradingStatus'>): boolean {
  return answer.gradingStatus !== 'ungraded'
}

/** Acierto real: corregida Y correcta. */
export function countsAsCorrect(answer: Pick<Answer, 'gradingStatus' | 'isCorrect'>): boolean {
  return isGraded(answer) && answer.isCorrect
}

/**
 * Error real: corregida Y incorrecta.
 *
 * Es la función que reemplaza a `!a.isCorrect`. La diferencia entre las dos es
 * todo el arreglo.
 */
export function countsAsIncorrect(answer: Pick<Answer, 'gradingStatus' | 'isCorrect'>): boolean {
  return isGraded(answer) && !answer.isCorrect
}

export interface GradedTally {
  correct: number
  incorrect: number
  ungraded: number
  /** Denominador de la nota: corregidas, sin las que quedaron sin calificar. */
  graded: number
}

/**
 * Cuenta las tres categorías de una vez.
 *
 * Devolver `graded` explícito y no dejar que cada llamador haga
 * `total - ungraded` es a propósito: ese es justo el cálculo que alguien va a
 * escribir mal el día que agregue un cuarto estado.
 */
export function tallyAnswers(answers: Answer[]): GradedTally {
  let correct = 0
  let incorrect = 0
  let ungraded = 0

  for (const answer of answers) {
    if (!isGraded(answer)) ungraded += 1
    else if (answer.isCorrect) correct += 1
    else incorrect += 1
  }

  return { correct, incorrect, ungraded, graded: correct + incorrect }
}

/**
 * Nota de 0 a 10 sobre lo efectivamente corregido.
 *
 * `null` cuando no quedó nada que corregir. No es 0: un 0 dice "no acertó
 * ninguna", y acá lo que pasó es que no se pudo evaluar nada. Quien llame tiene
 * que decidir qué hacer con eso — en el flujo del alumno, ofrecer reintentar en
 * vez de guardar un intento que después nadie va a saber leer.
 */
export function scoreOutOfTen(tally: GradedTally): number | null {
  if (tally.graded === 0) return null
  return Number(((tally.correct / tally.graded) * 10).toFixed(2))
}
