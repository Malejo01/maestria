import { describe, expect, it } from 'vitest'
import { claveDePregunta, elegirParaRepasar, preguntaDesdeFila, practicoHace, type FilaGuardada } from './repaso'

const AHORA = new Date('2026-11-23T15:00:00Z')
const haceDias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000).toISOString()

function fila(texto: string, correcta: boolean | null, dias: number, extra: Partial<FilaGuardada> = {}): FilaGuardada {
  return {
    question_id: null,
    question_text: texto,
    question_type: 'multiple_choice',
    options: ['A', 'B', 'C', 'D'],
    correct_answer: 1,
    answer_payload: null,
    is_correct: correcta,
    explanation: 'Porque sí.',
    topic_name: 'Tema',
    el: haceDias(dias),
    materia: 'Lengua',
    ...extra,
  }
}

describe('elegirParaRepasar', () => {
  it('lo errado vuelve al día siguiente, no el mismo día', () => {
    expect(elegirParaRepasar([fila('¿Uno?', false, 0)], AHORA)).toHaveLength(0)
    expect(elegirParaRepasar([fila('¿Uno?', false, 1)], AHORA)).toHaveLength(1)
  })
  it('cada acierto seguido estira el intervalo: 3, 7, 14, 30 días', () => {
    const conRacha = (racha: number, dias: number) => [fila('¿Dos?', false, 60), ...Array.from({ length: racha }, (_, i) => fila('¿Dos?', true, dias + (racha - 1 - i) * 0))]
    expect(elegirParaRepasar(conRacha(1, 2), AHORA)).toHaveLength(0)
    expect(elegirParaRepasar(conRacha(1, 3), AHORA)).toHaveLength(1)
    expect(elegirParaRepasar(conRacha(2, 6), AHORA)).toHaveLength(0)
    expect(elegirParaRepasar(conRacha(2, 7), AHORA)).toHaveLength(1)
    expect(elegirParaRepasar(conRacha(4, 30), AHORA)).toHaveLength(1)
  })
  it('con cinco aciertos seguidos sale del repaso; lo que nunca erró no entra', () => {
    const cinco = [fila('¿Tres?', false, 90), ...[60, 40, 30, 20, 10].map((d) => fila('¿Tres?', true, d))]
    expect(elegirParaRepasar(cinco, AHORA)).toHaveLength(0)
    expect(elegirParaRepasar([fila('¿Cuatro?', true, 10)], AHORA)).toHaveLength(0)
  })
  it('un error nuevo reinicia la cuenta', () => {
    expect(elegirParaRepasar([fila('¿Cinco?', false, 40), fila('¿Cinco?', true, 30), fila('¿Cinco?', false, 2)], AHORA)).toHaveLength(1)
  })
  it('la misma pregunta con otra tilde o mayúscula es una sola; sin calificar no cuenta', () => {
    const r = elegirParaRepasar([fila('¿Qué es?', false, 5), fila('¿que ES?', false, 4), fila('Ensayo', null, 5)], AHORA)
    expect(r).toHaveLength(1)
  })
  it('las más atrasadas primero, con tope', () => {
    const filas = Array.from({ length: 12 }, (_, i) => fila(`¿Pregunta ${i}?`, false, i + 1))
    const r = elegirParaRepasar(filas, AHORA)
    expect(r).toHaveLength(8)
    expect(r[0].question).toBe('¿Pregunta 11?')
  })
  it('por materia: la de la primera vez', () => {
    const filas = [fila('¿Lengua?', false, 3), fila('¿Física?', false, 3, { materia: 'Física' }), fila('¿Física?', false, 2, { materia: 'Repaso' })]
    expect(elegirParaRepasar(filas, AHORA, { materia: 'Física' }).map((q) => q.question)).toEqual(['¿Física?'])
  })
})

describe('preguntaDesdeFila', () => {
  it('opción múltiple (columnas de antes) y verdadero o falso', () => {
    expect(preguntaDesdeFila(fila('¿MC?', false, 1))).toMatchObject({ type: 'multiple_choice', options: ['A', 'B', 'C', 'D'], correctAnswer: 1 })
    expect(preguntaDesdeFila(fila('¿VF?', false, 1, { question_type: 'true_false', options: null, correct_answer: null, answer_payload: { selectedAnswer: true, correctAnswer: false } }))).toMatchObject({
      type: 'true_false',
      correctAnswer: false,
    })
  })
  it('numérica con su fracción, y la calculada como numérica', () => {
    const num = preguntaDesdeFila(fila('¿N?', false, 1, { question_type: 'numeric', answer_payload: { correctAnswer: 0.75, tolerance: null, fraccion: { numerador: 3, denominador: 4 }, exigeIrreducible: true } }))
    expect(num).toMatchObject({ type: 'numeric', correctAnswer: 0.75, fraccion: { numerador: 3, denominador: 4 }, exigeIrreducible: true })
    const calc = preguntaDesdeFila(fila('¿C?', false, 1, { question_type: 'calculated', answer_payload: { tipo: 'calculated', correctAnswer: 12, tolerance: 0.5 } }))
    expect(calc).toMatchObject({ type: 'numeric', correctAnswer: 12, tolerance: 0.5 })
  })
  it('un tipo de Moodle guardado como respuesta corta (sin la 042) vuelve con su tipo', () => {
    const q = preguntaDesdeFila(fila('Ordená', false, 1, { question_type: 'short_answer', answer_payload: { tipo: 'ordering', items: ['a', 'b', 'c'] } }))
    expect(q).toMatchObject({ type: 'ordering', items: ['a', 'b', 'c'] })
  })
  it('el ensayo y una fila incompleta no vuelven', () => {
    expect(preguntaDesdeFila(fila('Ensayo', false, 1, { question_type: 'essay', answer_payload: { tipo: 'essay' } }))).toBeNull()
    expect(preguntaDesdeFila(fila('¿Corta?', false, 1, { question_type: 'short_answer', answer_payload: { acceptedAnswers: [] } }))).toBeNull()
  })
})

describe('utilidades', () => {
  it('la clave y la práctica de la semana', () => {
    expect(claveDePregunta('  ¿Qué  ES? ')).toBe('¿que es?')
    expect(practicoHace([{ el: haceDias(6) }], AHORA)).toBe(true)
    expect(practicoHace([{ el: haceDias(9) }], AHORA)).toBe(false)
  })
})
