import { describe, expect, it } from 'vitest'
import { sameJsonValue, stableStringify } from './stable-json'

/**
 * El caso que motiva el módulo es el primero: el orden de claves que devuelve
 * Postgres. Está copiado de una ida y vuelta REAL contra producción, no
 * inventado — `SELECT '{...}'::jsonb` con una pregunta del formato que guarda
 * `teacher_quizzes.questions`.
 */
describe('stableStringify', () => {
  it('da lo mismo para el orden del cliente y el que devuelve jsonb', () => {
    const delCliente = {
      id: 'q1',
      topic: 't1',
      topicName: 'Funciones',
      type: 'multiple_choice',
      question: '¿Cuál?',
      options: ['a', 'b'],
      correctAnswer: 0,
      explanation: 'porque sí',
      origin: 'editada',
    }

    // Exactamente el orden en que Postgres lo devolvió, medido el 24/08/2026.
    const dePostgres = {
      id: 'q1',
      type: 'multiple_choice',
      topic: 't1',
      origin: 'editada',
      options: ['a', 'b'],
      question: '¿Cuál?',
      topicName: 'Funciones',
      explanation: 'porque sí',
      correctAnswer: 0,
    }

    // La premisa del bug: con JSON.stringify pelado son distintos.
    expect(JSON.stringify(delCliente)).not.toBe(JSON.stringify(dePostgres))

    // Lo que arregla este módulo.
    expect(stableStringify(delCliente)).toBe(stableStringify(dePostgres))
    expect(sameJsonValue(delCliente, dePostgres)).toBe(true)
  })

  it('ordena también las claves anidadas', () => {
    expect(stableStringify({ a: { z: 1, y: 2 } })).toBe(stableStringify({ a: { y: 2, z: 1 } }))
  })

  it('NO reordena arrays, donde el orden es dato', () => {
    // Las opciones de una pregunta y el orden de las preguntas son
    // significativos: mezclarlos sería "arreglar" algo que no está roto.
    expect(sameJsonValue({ options: ['a', 'b'] }, { options: ['b', 'a'] })).toBe(false)
  })

  it('sigue distinguiendo datos que de verdad difieren', () => {
    expect(sameJsonValue({ correctAnswer: 0 }, { correctAnswer: 1 })).toBe(false)
    expect(sameJsonValue({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(sameJsonValue({ a: 1 }, { a: '1' })).toBe(false)
  })

  it('aguanta null, arrays en la raíz y valores primitivos', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]')
    expect(stableStringify('hola')).toBe('"hola"')
  })
})
