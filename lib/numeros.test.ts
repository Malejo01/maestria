import { describe, expect, it } from 'vitest'
import { comaDecimal, formatearNumero } from './numeros'
import { parseNumericAnswer } from './numeric-answer'

describe('formatearNumero (K1)', () => {
  it('los cuatro ejemplos del encargo', () => {
    expect(formatearNumero(0.9166666666666666)).toBe('0,9167')
    expect(formatearNumero(3.14)).toBe('3,14')
    expect(formatearNumero(680)).toBe('680')
    expect(formatearNumero(12500)).toBe('12.500')
  })

  it('negativos, enteros y ceros sobrantes', () => {
    expect(formatearNumero(-0.75)).toBe('-0,75')
    expect(formatearNumero(-12500.5)).toBe('-12.500,5')
    expect(formatearNumero(13)).toBe('13')
    expect(formatearNumero(-7)).toBe('-7')
    expect(formatearNumero(0)).toBe('0')
    expect(formatearNumero(2.5)).toBe('2,5')
    expect(formatearNumero(0.1 + 0.2)).toBe('0,3')
    expect(formatearNumero(1500)).toBe('1.500')
  })

  it('un valor muy chico no se muestra como 0', () => {
    expect(formatearNumero(0.00001)).toBe('0,00001')
    expect(formatearNumero(-0.000012345)).toBe('-0,00001235')
  })

  it('con decimales fijos, para una nota', () => {
    expect(formatearNumero(7, { decimales: 1 })).toBe('7,0')
    expect(formatearNumero(6.66666, { decimales: 2 })).toBe('6,67')
  })

  it('lo que no es un número queda vacío', () => {
    expect(formatearNumero(NaN)).toBe('')
    expect(formatearNumero(Infinity)).toBe('')
  })

  it('lo que mostramos vuelve a entrar igual por el campo del alumno', () => {
    for (const valor of [3.5, -1.75, 0.1, 13, 0.25, 1234.5, 12500, 1500, -0.75]) {
      expect(parseNumericAnswer(formatearNumero(valor))).toBe(valor)
    }
  })
})

describe('comaDecimal: los números de un texto generado (K1)', () => {
  it('pasa el punto decimal a coma en el texto', () => {
    expect(comaDecimal('El resultado es 0.75 y no 3.14.')).toBe('El resultado es 0,75 y no 3,14.')
    expect(comaDecimal('Vale -2.5')).toBe('Vale -2,5')
  })

  it('dentro de una fórmula la coma va como {,}', () => {
    expect(comaDecimal('Calculá $3.14 \\cdot 2$')).toBe('Calculá $3{,}14 \\cdot 2$')
  })

  it('redondea un decimal de máquina', () => {
    expect(comaDecimal('0.9166666666666666')).toBe('0,9167')
  })

  it('no toca lo ambiguo ni lo que no es un decimal', () => {
    // Tres cifras después del punto: en español es mil quinientos.
    expect(comaDecimal('Hay 1.500 alumnos')).toBe('Hay 1.500 alumnos')
    expect(comaDecimal('El 19.11.2026')).toBe('El 19.11.2026')
    expect(comaDecimal('Versión 1.2.3')).toBe('Versión 1.2.3')
    expect(comaDecimal('Terminó. 5 personas')).toBe('Terminó. 5 personas')
    expect(comaDecimal('Ya tiene coma: 0,75')).toBe('Ya tiene coma: 0,75')
  })

  it('respeta el código entre comillas invertidas', () => {
    expect(comaDecimal('En Python, `x = 3.14` guarda 3.14')).toBe('En Python, `x = 3.14` guarda 3,14')
  })
})
