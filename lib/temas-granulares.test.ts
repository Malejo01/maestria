import { describe, expect, it } from 'vitest'
import { LARGO_MAXIMO_DE_TEMA, REGLAS_DE_TEMAS, granularizarUnidades, partirTema } from './temas-granulares'

/** Un párrafo sintético con la forma de los programas universitarios de la 07, 08 y 09. */
const PARRAFO =
  'Sistemas de m ecuaciones lineales con n incógnitas. Reducción a la forma escalonada (Método de Gauss): discusión y resolución de sistemas homogéneos y no homogéneos. Solución general. Interpretación geométrica en R2 y R3. Forma matricial de un sistema. Rango de una matriz. Teorema de Rouché-Frobenius. Problemas de aplicación'

describe('partirTema (I2)', () => {
  it('un párrafo de conceptos encadenados por punto se parte en temas', () => {
    const temas = partirTema(PARRAFO)
    expect(temas).toEqual([
      'Sistemas de m ecuaciones lineales con n incógnitas',
      'Reducción a la forma escalonada (Método de Gauss): discusión y resolución de sistemas homogéneos y no homogéneos',
      'Solución general',
      'Interpretación geométrica en R2 y R3',
      'Forma matricial de un sistema',
      'Rango de una matriz',
      'Teorema de Rouché-Frobenius',
      'Problemas de aplicación',
    ])
    // Nada inventado: cada tema es texto del párrafo.
    for (const tema of temas) expect(PARRAFO).toContain(tema)
  })

  it('también por punto y coma', () => {
    expect(partirTema('Conjuntos numéricos y sus propiedades en la recta real; operaciones con intervalos; valor absoluto y distancia entre dos puntos')).toEqual([
      'Conjuntos numéricos y sus propiedades en la recta real',
      'operaciones con intervalos',
      'valor absoluto y distancia entre dos puntos',
    ])
  })

  it('un tema corto no se toca, aunque tenga comas o puntos', () => {
    expect(partirTema('Figuras geométricas planas, perímetro, área')).toEqual(['Figuras geométricas planas, perímetro, área'])
    expect(partirTema('Números reales. Intervalos.')).toEqual(['Números reales. Intervalos.'])
  })

  it('no corta en decimales ni en notación como R2.3', () => {
    const largo = 'Aproximación de 3.14 y de 2.71 como números irracionales en la recta numérica y su error relativo porcentual'
    expect(largo.length).toBeGreaterThan(LARGO_MAXIMO_DE_TEMA)
    expect(partirTema(largo)).toEqual([largo])
  })
})

describe('granularizarUnidades', () => {
  it('parte los temas de cada unidad y no repite dentro de la misma', () => {
    const [unidad] = granularizarUnidades([
      { name: 'Unidad III', topics: [{ name: PARRAFO }, { name: 'Rango de una matriz' }] },
    ])
    expect(unidad.topics.length).toBeGreaterThanOrEqual(4)
    expect(unidad.topics.filter((t) => t.name === 'Rango de una matriz')).toHaveLength(1)
    expect(Math.max(...unidad.topics.map((t) => t.name.length))).toBeLessThanOrEqual(120)
  })
})

describe('REGLAS_DE_TEMAS', () => {
  it('pide conceptos separados, el largo máximo y no inventar', () => {
    expect(REGLAS_DE_TEMAS).toContain('enseñar y evaluar por separado')
    expect(REGLAS_DE_TEMAS).toContain(`${LARGO_MAXIMO_DE_TEMA} caracteres`)
    expect(REGLAS_DE_TEMAS).toContain('No inventes')
  })
})
