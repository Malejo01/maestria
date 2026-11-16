import { describe, expect, it } from 'vitest'
import { normalizarNombreDeUnidad } from './nombre-de-unidad'
import { textoDeHtmlDeWord } from './html-de-word'

describe('normalizarNombreDeUnidad (I3)', () => {
  it('sólo un número o un romano: "Unidad N"', () => {
    expect(normalizarNombreDeUnidad('1')).toBe('Unidad 1')
    expect(normalizarNombreDeUnidad('12.')).toBe('Unidad 12')
    expect(normalizarNombreDeUnidad('IV')).toBe('Unidad 4')
    expect(normalizarNombreDeUnidad('IX.')).toBe('Unidad 9')
    expect(normalizarNombreDeUnidad(' II ')).toBe('Unidad 2')
  })

  it('todo en mayúsculas: mayúscula inicial, con romanos y siglas como estaban', () => {
    expect(normalizarNombreDeUnidad('UNIDAD I: LÓGICA PROPOSICIONAL')).toBe('Unidad I: Lógica proposicional')
    expect(normalizarNombreDeUnidad('UNIDAD III: MATRICES Y SISTEMAS DE ECUACIONES LINEALES')).toBe(
      'Unidad III: Matrices y sistemas de ecuaciones lineales',
    )
    expect(normalizarNombreDeUnidad('LAS TIC EN EL AULA')).toBe('Las TIC en el aula')
    expect(normalizarNombreDeUnidad('MCM Y MCD')).toBe('MCM y MCD')
    expect(normalizarNombreDeUnidad('VECTORES EN R2 Y R3')).toBe('Vectores en R2 y R3')
    expect(normalizarNombreDeUnidad('UNIDAD 2 – NÚMEROS RACIONALES')).toBe('Unidad 2 – Números racionales')
  })

  it('el resto no se toca: no inventamos títulos', () => {
    for (const nombre of [
      'Unidad I – Números y operaciones',
      'Unidad Nº 1: Fundamentos de Lógica y Razonamiento Matemático',
      'Fundamentos de lógica',
      'Unidad Nº1',
      'Eje 2: Geometría',
    ]) {
      expect(normalizarNombreDeUnidad(nombre)).toBe(nombre)
    }
  })

  it('un "UNIDAD" en mayúsculas al principio, y nada más', () => {
    expect(normalizarNombreDeUnidad('UNIDAD I: Función de variable real')).toBe('Unidad I: Función de variable real')
  })

  it('no confunde una palabra con un romano', () => {
    expect(normalizarNombreDeUnidad('DIVISIBILIDAD')).toBe('Divisibilidad')
    expect(normalizarNombreDeUnidad('Mix')).toBe('Mix')
  })
})

describe('textoDeHtmlDeWord (I3)', () => {
  it('una tabla de dos columnas: una línea por fila, con sus celdas', () => {
    const html =
      '<p>Contenidos</p><table><tr><td><p>1</p></td><td><p>Números naturales.</p><p>Divisibilidad.</p></td></tr>' +
      '<tr><td><p>2</p></td><td><p>Fracciones &amp; decimales</p></td></tr></table><p>Bibliografía</p>'
    expect(textoDeHtmlDeWord(html)).toBe(
      ['Contenidos', '1 | Números naturales. Divisibilidad.', '2 | Fracciones & decimales', 'Bibliografía'].join('\n'),
    )
  })

  it('una tabla de cuatro columnas no se mezcla', () => {
    const html =
      '<table><tr><th>Unidad</th><th>Contenidos</th><th>Bibliografía</th><th>Semanas</th></tr>' +
      '<tr><td>1</td><td>Lógica proposicional</td><td>Rojo, Álgebra I</td><td>1 a 4</td></tr></table>'
    expect(textoDeHtmlDeWord(html).split('\n')).toEqual([
      'Unidad | Contenidos | Bibliografía | Semanas',
      '1 | Lógica proposicional | Rojo, Álgebra I | 1 a 4',
    ])
  })

  it('párrafos, títulos y listas, una línea por bloque', () => {
    expect(textoDeHtmlDeWord('<h1>Programa</h1><p>Unidad 1</p><ul><li>Conjuntos</li><li>Relaciones</li></ul>')).toBe(
      'Programa\nUnidad 1\n- Conjuntos\n- Relaciones',
    )
  })

  it('una fila vacía no deja una línea de barras', () => {
    expect(textoDeHtmlDeWord('<table><tr><td></td><td> </td></tr><tr><td>A</td><td>B</td></tr></table>')).toBe('A | B')
  })
})
