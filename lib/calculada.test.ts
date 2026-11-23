import { describe, expect, it } from 'vitest'
import {
  aleatorioConSemilla,
  calculadaValida,
  corregirCalculada,
  enunciadoConValores,
  instanciarCalculada,
  margenAbsoluto,
  valoresDelConjunto,
} from './calculada'
import { payloadDeRespuesta, problemaDeTipoMoodle, respuestaEnTexto } from './tipos-moodle'
import type { Answer } from './types'

const CRUDA = {
  question: 'Un bien cuesta {p} pesos y sube un {x} %. ¿Cuánto cuesta ahora?',
  formula: '{p} * (1 + {x} / 100)',
  variables: [
    { name: 'p', min: 100, max: 500, decimals: 0 },
    { name: 'x', min: 5, max: 20, decimals: 0 },
  ],
  tolerance: 0.01,
}

describe('F7 · la calculada', () => {
  it('sortea los valores dentro de su rango, arma el enunciado con coma y saca la correcta de la fórmula', () => {
    const q = instanciarCalculada(CRUDA, aleatorioConSemilla('prueba'))!
    expect(q.plantilla).toBe(CRUDA.question)
    expect(q.valores.p).toBeGreaterThanOrEqual(100)
    expect(q.valores.p).toBeLessThanOrEqual(500)
    expect(Number.isInteger(q.valores.x)).toBe(true)
    expect(q.question).toBe(`Un bien cuesta ${q.valores.p} pesos y sube un ${q.valores.x} %. ¿Cuánto cuesta ahora?`)
    expect(q.correctAnswer).toBeCloseTo(q.valores.p * (1 + q.valores.x / 100))
    expect(enunciadoConValores('Área: {b} × {h}', { b: 2.5, h: 4 })).toBe('Área: 2,5 × 4')
  })

  it('si un sorteo no da número, sortea de nuevo; si nunca da, null', () => {
    expect(instanciarCalculada({ question: '{a}', formula: '1 / ({a} - {a})', variables: [{ name: 'a', min: 1, max: 9, decimals: 0 }] })).toBeNull()
  })

  it('qué sirve: los comodines del enunciado con su rango, fórmula de Moodle, tolerancia entre 0 y 10 %', () => {
    expect(calculadaValida(CRUDA)).toBe(true)
    expect(calculadaValida({ ...CRUDA, formula: 'pow({p}, 2) ^ 1' })).toBe(false)
    expect(calculadaValida({ ...CRUDA, formula: '{p} * {z}' })).toBe(false)
    expect(calculadaValida({ ...CRUDA, question: 'Cuesta {p} pesos.' })).toBe(false)
    expect(calculadaValida({ ...CRUDA, variables: [{ name: 'p', min: 5, max: 1, decimals: 0 }, CRUDA.variables[1]] })).toBe(false)
    expect(calculadaValida({ ...CRUDA, tolerance: 0.5 })).toBe(false)
    expect(calculadaValida({ ...CRUDA, tolerance: undefined })).toBe(false)
    expect(problemaDeTipoMoodle({ type: 'calculated', ...CRUDA, formula: 'alert(1)' })).toMatch(/calculada/)
  })

  it('tolerancia relativa', () => {
    expect(corregirCalculada(200, 0.01, 201.9)).toBe(true)
    expect(corregirCalculada(200, 0.01, 202.5)).toBe(false)
    expect(corregirCalculada(0, 0.01, 0.005)).toBe(true)
    expect(corregirCalculada(200, 0.01, NaN)).toBe(false)
    expect(margenAbsoluto(-300, 0.01)).toBe(3)
  })

  it('el conjunto de datos para Moodle: siempre los mismos valores para la pregunta, dentro del rango', () => {
    const a = valoresDelConjunto(CRUDA.variables[0], 10, 'q1')
    expect(valoresDelConjunto(CRUDA.variables[0], 10, 'q1')).toEqual(a)
    expect(a.every((v) => v >= 100 && v <= 500 && Number.isInteger(v))).toBe(true)
  })

  it('en texto y en el payload', () => {
    const respuesta: Answer = {
      type: 'calculated',
      questionId: 'q1',
      questionText: 'Cuesta 200 pesos…',
      isCorrect: false,
      topic: 't',
      topicName: 'Precios',
      explanation: '',
      formula: CRUDA.formula,
      valores: { p: 200, x: 10 },
      correctAnswer: 220,
      tolerance: 0.01,
      selectedValue: 210.5,
      selectedText: '210,5',
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('210,5')
    expect(respuestaEnTexto(respuesta, 'correct')).toBe('220')
    expect(payloadDeRespuesta(respuesta)).toMatchObject({ tipo: 'calculated', valores: { p: 200, x: 10 }, correctAnswer: 220, selectedValue: 210.5 })
  })
})
