import { describe, expect, it } from 'vitest'
import { corregirNumerica } from './fraccion'
import { fraccionSimple, respuestaCorrectaNumerica, respuestaNumerica } from './numeros'

/**
 * O5 · Los cuestionarios de antes de K2 (sin `fraccion`) muestran la fracción
 * además del decimal. El cuestionario 34 mostraba `0,75` donde la respuesta
 * es `3/4`. Sólo al mostrar: el dato no se reescribe.
 */
describe('O5 · fracción simple de un decimal guardado', () => {
  it('exacta', () => {
    expect(fraccionSimple(0.75)).toEqual({ numerador: 3, denominador: 4 })
    expect(fraccionSimple(-0.5)).toEqual({ numerador: -1, denominador: 2 })
    expect(fraccionSimple(0.05)).toEqual({ numerador: 1, denominador: 20 })
  })

  it('periódica, como la guarda la máquina', () => {
    expect(fraccionSimple(0.3333333333333333)).toEqual({ numerador: 1, denominador: 3 })
    expect(fraccionSimple(0.9166666666666666)).toEqual({ numerador: 11, denominador: 12 })
  })

  it('no lo es: enteros, denominador mayor que 20, decimales largos', () => {
    expect(fraccionSimple(3)).toBeNull()
    expect(fraccionSimple(1 / 21)).toBeNull()
    expect(fraccionSimple(3.14159)).toBeNull()
    expect(fraccionSimple(0.333)).toBeNull()
  })
})

describe('O5 · cómo se muestra', () => {
  it('el caso del cuestionario 34: "3/4 (0,75)"', () => {
    expect(respuestaNumerica(0.75)).toBe('$\\frac{3}{4}$ (0,75)')
    expect(respuestaCorrectaNumerica({ correctAnswer: 0.75 })).toBe('$\\frac{3}{4}$ (0,75)')
  })

  it('un entero o un decimal que no es fracción simple, como siempre', () => {
    expect(respuestaNumerica(12)).toBe('12')
    expect(respuestaNumerica(3.14159)).toBe('3,1416')
  })

  it('con margen: la fracción y, entre paréntesis, el decimal con su margen', () => {
    expect(respuestaNumerica(0.4166666666666667, 0.001)).toBe('$\\frac{5}{12}$ (0,4167 ± 0,001)')
    expect(respuestaNumerica(3.14159, 0.01)).toBe('3,1416 (± 0,01)')
    // Una medida con margen (decimal que termina) queda como está.
    expect(respuestaNumerica(3.5, 0.1)).toBe('3,5 (± 0,1)')
  })

  it('una pregunta nueva con `fraccion` sigue como K2', () => {
    expect(respuestaNumerica(0.75, null, { numerador: 3, denominador: 4 })).toBe('$\\frac{3}{4}$')
  })
})

describe('O5 · la corrección acepta las dos formas', () => {
  const vieja = { correctAnswer: 0.75 }
  it('3/4 y 0,75 valen para una pregunta vieja de 0,75', () => {
    expect(corregirNumerica(vieja, 3 / 4, '3/4').correcta).toBe(true)
    expect(corregirNumerica(vieja, 0.75, '0,75').correcta).toBe(true)
    expect(corregirNumerica(vieja, 6 / 8, '6/8').correcta).toBe(true)
    expect(corregirNumerica(vieja, 2 / 3, '2/3').correcta).toBe(false)
  })

  it('11/12 vale para la periódica guardada', () => {
    expect(corregirNumerica({ correctAnswer: 0.9166666666666666 }, 11 / 12, '11/12').correcta).toBe(true)
  })
})
