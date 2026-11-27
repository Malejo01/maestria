import { describe, expect, it } from 'vitest'
import { normalizarNombreDeUnidad, separarTituloDeUnidad } from './nombre-de-unidad'
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

describe('O11 · el título de la unidad y los temas en la misma línea', () => {
  it('el caso de la tanda I: "Unidad 2: Funciones. Dominio, imagen, …"', () => {
    expect(separarTituloDeUnidad('Unidad 2: Funciones. Dominio, imagen, ceros y signo…', [])).toEqual({
      nombre: 'Unidad 2: Funciones',
      temas: ['Dominio', 'Imagen', 'Ceros y signo'],
    })
  })

  it('los temas de la línea van adelante de los que ya tenía', () => {
    expect(separarTituloDeUnidad('UNIDAD III. Números racionales. Fracciones; decimales', ['Porcentaje'])).toEqual({
      nombre: 'UNIDAD III: Números racionales',
      temas: ['Fracciones', 'Decimales', 'Porcentaje'],
    })
  })

  it('nombre pelado y el título pegado al primer tema (lo que devolvía la IA)', () => {
    expect(separarTituloDeUnidad('Unidad 2', ['Funciones. Dominio, imagen', 'Función lineal'])).toEqual({
      nombre: 'Unidad 2: Funciones',
      temas: ['Dominio', 'Imagen', 'Función lineal'],
    })
  })

  it('lo que no se toca', () => {
    expect(separarTituloDeUnidad('Unidad 1: Álgebra', ['Ecuaciones'])).toEqual({ nombre: 'Unidad 1: Álgebra', temas: ['Ecuaciones'] })
    expect(separarTituloDeUnidad('Unidad 3 — Álgebra y Ecuaciones para Sistemas de Información', [])).toEqual({
      nombre: 'Unidad 3 — Álgebra y Ecuaciones para Sistemas de Información',
      temas: [],
    })
    // Un tema con punto en una unidad que ya tiene título.
    expect(separarTituloDeUnidad('Unidad 1: Números', ['Números reales. Propiedades'])).toEqual({ nombre: 'Unidad 1: Números', temas: ['Números reales. Propiedades'] })
    // Un primer tema largo con punto no es un título.
    const largo = 'El conjunto de los números reales y sus propiedades principales. Ejemplos'
    expect(separarTituloDeUnidad('Unidad 1', [largo]).temas).toEqual([largo])
    // Un decimal o "Nº." no cortan.
    expect(separarTituloDeUnidad('Unidad Nº. 4: Estadística 1.5', []).nombre).toBe('Unidad Nº. 4: Estadística 1.5')
    expect(separarTituloDeUnidad('Introducción. Repaso', []).nombre).toBe('Introducción. Repaso')
  })
})

describe('sinPrefijoDeUnidad (AA4)', () => {
  it('saca el «Unidad N:» de adelante, con números o romanos', async () => {
    const { sinPrefijoDeUnidad } = await import('./nombre-de-unidad')
    expect(sinPrefijoDeUnidad('Unidad 1: Sistema de numeración y aritmética')).toBe('Sistema de numeración y aritmética')
    expect(sinPrefijoDeUnidad('Unidad II: Ecuaciones')).toBe('Ecuaciones')
    expect(sinPrefijoDeUnidad('UNIDAD Nº 3 – Geometría')).toBe('Geometría')
    expect(sinPrefijoDeUnidad('Unidad 4. Vectores')).toBe('Vectores')
  })
  it('sin prefijo, o con sólo el prefijo, queda como estaba', async () => {
    const { sinPrefijoDeUnidad } = await import('./nombre-de-unidad')
    expect(sinPrefijoDeUnidad('Lógica proposicional')).toBe('Lógica proposicional')
    expect(sinPrefijoDeUnidad('Unidad 1')).toBe('Unidad 1')
    expect(sinPrefijoDeUnidad('Unidades de medida')).toBe('Unidades de medida')
  })
})
