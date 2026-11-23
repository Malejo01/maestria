import { describe, expect, it } from 'vitest'
import {
  corregirVariasCorrectas,
  correctaEnTexto,
  fraccionesVariasCorrectas,
  payloadDeRespuesta,
  problemaDeTipoMoodle,
  respuestaEnTexto,
  respuestaGuardadaEnTexto,
  variasCorrectasValida,
} from './tipos-moodle'
import { fraccionValida } from './moodle-xml-validar'
import type { Answer, Question } from './types'

const VARIAS: Question = {
  id: 'q1',
  type: 'multiple_response',
  topic: 't',
  topicName: 'Cultura',
  question: '¿Cuáles son rasgos de la cultura según la antropología? Marcá todas las que correspondan.',
  options: ['Se aprende', 'Es innata', 'Se comparte', 'Es individual', 'Es simbólica'],
  correctAnswers: [0, 2, 4],
  explanation: '',
}

describe('F2 · varias correctas', () => {
  it('se corrige todo o nada: exactamente las correctas, en cualquier orden', () => {
    expect(corregirVariasCorrectas([0, 2, 4], [4, 0, 2])).toBe(true)
    expect(corregirVariasCorrectas([0, 2, 4], [0, 2])).toBe(false)
    expect(corregirVariasCorrectas([0, 2, 4], [0, 1, 2, 4])).toBe(false)
    expect(corregirVariasCorrectas([0, 2, 4], [])).toBe(false)
  })

  it('sirve con entre 2 y n−1 correctas, índices válidos y sin opciones vacías', () => {
    expect(variasCorrectasValida(VARIAS as Extract<Question, { type: 'multiple_response' }>)).toBe(true)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [1] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 1, 2] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 5] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 0] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', '', 'c'], correctAnswers: [0, 2] })).toBe(false)
    expect(problemaDeTipoMoodle({ type: 'multiple_response', options: ['a', 'b', 'c'], correctAnswers: [1] })).toMatch(/varias correctas/)
    expect(problemaDeTipoMoodle(VARIAS as unknown as Record<string, unknown>)).toBeNull()
  })

  it('las fracciones de Moodle: las correctas suman 100 y todas son de las que Moodle acepta', () => {
    for (const [n, correctas] of [[5, [0, 2, 4]], [4, [1, 3]], [6, [0, 1, 2, 3]], [5, [0, 1]]] as const) {
      const f = fraccionesVariasCorrectas(n, correctas)
      expect(f.every(fraccionValida)).toBe(true)
      expect(Math.abs(f.filter((x) => x > 0).reduce((s, x) => s + x, 0) - 100)).toBeLessThan(0.01)
    }
    expect(fraccionesVariasCorrectas(5, [0, 2, 4])).toEqual([33.33333, -50, 33.33333, -50, 33.33333])
  })

  it('en texto: las letras y las opciones, en orden', () => {
    expect(correctaEnTexto(VARIAS)).toBe('A) Se aprende · C) Se comparte · E) Es simbólica')
    const respuesta: Answer = {
      type: 'multiple_response',
      questionId: 'q1',
      questionText: VARIAS.question,
      isCorrect: false,
      topic: 't',
      topicName: 'Cultura',
      explanation: '',
      options: (VARIAS as Extract<Question, { type: 'multiple_response' }>).options,
      selectedAnswers: [2, 0],
      correctAnswers: [0, 2, 4],
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('A) Se aprende · C) Se comparte')
    const payload = payloadDeRespuesta(respuesta)
    expect(payload).toMatchObject({ tipo: 'multiple_response', selectedAnswers: [2, 0], selectedText: 'A) Se aprende · C) Se comparte', acceptedAnswers: ['A) Se aprende · C) Se comparte · E) Es simbólica'] })
    // Leída de vuelta: con su tipo, o guardada como respuesta corta (sin la 042).
    expect(respuestaGuardadaEnTexto('multiple_response', payload)).toEqual({ tipo: 'multiple_response', elegido: 'A) Se aprende · C) Se comparte', correcto: 'A) Se aprende · C) Se comparte · E) Es simbólica' })
    expect(respuestaGuardadaEnTexto('short_answer', payload)?.tipo).toBe('multiple_response')
    expect(respuestaGuardadaEnTexto('short_answer', { selectedText: 'x', acceptedAnswers: ['y'] })).toBeNull()
  })
})
