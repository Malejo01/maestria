import { describe, expect, it } from 'vitest'
import { motivoConsignaMultiple, pideMasDeUnValor } from './consigna-multiple'

describe('K3 · una consigna, una respuesta', () => {
  it('la consigna real de la Unidad V: media y mediana', () => {
    const real =
      'Dada la serie de datos sobre la cantidad de libros leídos por un grupo de alumnos: 2, 3, 3, 5, 7. Calcule la media aritmética y la mediana de este conjunto de datos.'
    expect(motivoConsignaMultiple(real)).toBe('dos_medidas')
    expect(pideMasDeUnValor({ type: 'numeric', question: real })).toBe(true)
  })

  it('dos medidas unidas por "y"', () => {
    expect(motivoConsignaMultiple('Calculá el perímetro y el área de un rectángulo de 3 cm por 4 cm.')).toBe('dos_medidas')
    expect(motivoConsignaMultiple('Determiná el MCD y el MCM de 12 y 18.')).toBe('dos_medidas')
    expect(motivoConsignaMultiple('¿Cuál es la moda y la mediana de 1, 2, 2, 3?')).toBe('dos_medidas')
    expect(motivoConsignaMultiple('Hallá la media de los datos y también la moda.')).toBe('dos_medidas')
  })

  it('dos preguntas en una', () => {
    expect(motivoConsignaMultiple('Juan tiene 12 figuritas y regala 5. ¿Cuántas le quedan? ¿Y cuántas tendría si comprara 3 más?')).toBe('dos_preguntas')
  })

  it('una enumeración de lo que hay que calcular', () => {
    expect(motivoConsignaMultiple('Dado el triángulo de lados 3, 4 y 5, calcule a) el perímetro b) el área.')).toBe('enumeracion')
    expect(motivoConsignaMultiple('Resolvé: 1) 2 + 3 2) 4 · 5')).toBe('enumeracion')
  })

  it('no toca consignas que piden un solo valor', () => {
    expect(motivoConsignaMultiple('Calculá la media de 2, 3, 5 y 6.')).toBeNull()
    expect(motivoConsignaMultiple('Calculá el área sabiendo que la base y la altura miden 3 cm y 4 cm.')).toBeNull()
    expect(motivoConsignaMultiple('¿Cuál es el área de un rectángulo de base 3 y altura 4?')).toBeNull()
    expect(motivoConsignaMultiple('Si $x + y = 5$ y $x - y = 1$, ¿cuánto vale $x$?')).toBeNull()
    expect(motivoConsignaMultiple('Calculá la suma de 3/4 y 1/2.')).toBeNull()
    expect(motivoConsignaMultiple('Simplifique la fracción 42/56 hasta su expresión irreducible.')).toBeNull()
  })

  it('sólo aplica a las de un casillero', () => {
    const doble = 'Calculá el perímetro y el área de un cuadrado de lado 2.'
    expect(pideMasDeUnValor({ type: 'short_answer', question: doble })).toBe(true)
    expect(pideMasDeUnValor({ type: 'multiple_choice', question: doble })).toBe(false)
    expect(pideMasDeUnValor({ type: 'true_false', question: doble })).toBe(false)
  })
})
