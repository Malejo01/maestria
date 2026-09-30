import { describe, expect, it } from 'vitest'
import { isConceptualNumericQuestion, questionTypesForMode, scopeUnitsToTopics } from './quiz-scope'

const PROGRAMA = [
  {
    name: 'Unidad I: Números naturales',
    topics: [
      { name: 'Divisibilidad en los naturales: división por números enteros, múltiplos y divisores (método por tanteo y por factores)' },
      { name: 'Máximo Común Divisor (MCD) y Mínimo Común Múltiplo (MCM)' },
      { name: 'Números primos, compuestos y coprimos' },
    ],
  },
  {
    name: 'Unidad II: El problema',
    topics: [
      { name: 'La noción de problema: diferentes concepciones' },
      { name: 'Teoría de las situaciones didácticas: acción, formulación, validación e institucionalización' },
    ],
  },
]

describe('scopeUnitsToTopics', () => {
  it('deja sólo la unidad y el tema elegidos, sin los hermanos (caso real del aula, 30/09)', () => {
    const scoped = scopeUnitsToTopics(PROGRAMA, [{ name: PROGRAMA[0].topics[0].name as string }])
    expect(scoped).toHaveLength(1)
    expect(scoped[0].name).toBe('Unidad I: Números naturales')
    expect(scoped[0].topics.map((t) => t.name)).toEqual([PROGRAMA[0].topics[0].name])
  })

  it('conserva temas de unidades distintas cuando se eligen varios', () => {
    const scoped = scopeUnitsToTopics(PROGRAMA, [
      { name: 'Números primos, compuestos y coprimos' },
      { name: 'La noción de problema: diferentes concepciones' },
    ])
    expect(scoped.map((u) => u.topics.length)).toEqual([1, 1])
  })

  it('compara sin distinguir tildes, mayúsculas ni espacios', () => {
    const scoped = scopeUnitsToTopics(PROGRAMA, [{ name: '  numeros PRIMOS,  compuestos y coprimos ' }])
    expect(scoped[0].topics.map((t) => t.name)).toEqual(['Números primos, compuestos y coprimos'])
  })

  it('devuelve el programa entero si ningún tema coincide (regeneración con topicName de la IA)', () => {
    expect(scopeUnitsToTopics(PROGRAMA, [{ name: 'Divisibilidad' }])).toBe(PROGRAMA)
  })

  it('no rompe con unidades vacías o sin topics', () => {
    expect(scopeUnitsToTopics([], [{ name: 'x' }])).toEqual([])
    expect(scopeUnitsToTopics([{ name: 'U' }], [{ name: 'x' }])).toEqual([{ name: 'U' }])
  })
})

describe('questionTypesForMode', () => {
  const todos = ['multiple_choice', 'short_answer', 'true_false', 'numeric'] as const

  it('saca numeric de la tanda teórica', () => {
    expect(questionTypesForMode([...todos], 'teorico')).toEqual(['multiple_choice', 'short_answer', 'true_false'])
  })

  it('no toca la tanda práctica ni la mixta', () => {
    expect(questionTypesForMode([...todos], 'practico')).toEqual([...todos])
    expect(questionTypesForMode([...todos], 'mixto')).toEqual([...todos])
  })

  it('respeta numeric si es lo único pedido', () => {
    expect(questionTypesForMode(['numeric'], 'teorico')).toEqual(['numeric'])
  })
})

describe('isConceptualNumericQuestion', () => {
  const numeric = (question: string) => ({ type: 'numeric', question })

  it.each([
    'Explique cómo se calcula el Máximo Común Divisor. Responda 1 si usa factores primos y 0 si no.',
    '¿Qué error conceptual comete el alumno que dice que 12 es divisor de 4?',
    'Justificá por qué 15 es múltiplo de 3.',
    '¿Por qué el 1 no es primo?',
    'Escribí 1 si la afirmación es verdadera.',
  ])('marca como conceptual: %s', (question) => {
    expect(isConceptualNumericQuestion(numeric(question))).toBe(true)
  })

  it.each([
    'Calculá el MCD(24, 36).',
    '¿Cuántos divisores tiene el 36?',
    '¿Qué número es el menor múltiplo común de 4 y 6?',
    'Se reparten 45 caramelos y 30 chocolates en bolsas iguales. ¿Cuántas bolsas como máximo?',
  ])('deja pasar un cálculo: %s', (question) => {
    expect(isConceptualNumericQuestion(numeric(question))).toBe(false)
  })

  it('sólo mira preguntas numeric', () => {
    expect(isConceptualNumericQuestion({ type: 'short_answer', question: 'Explique el MCD.' })).toBe(false)
  })
})
