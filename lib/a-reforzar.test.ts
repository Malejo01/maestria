import { describe, expect, it } from 'vitest'
import { normalizarTema, separarDominados, temaDelPrograma, temasSuperados, ubicarRespuesta, type RespuestaParaRacha, type TemaAReforzar } from './a-reforzar'

/** Nombres reales de temas (staging, copiados de producción y de los programas de cátedra). */
const INTENTO_GEOMETRIA = [
  'Distancia. Semejanza.',
  'Lugar geométrico: ecuación de la recta (Bisectriz y mediatriz) y de la parábola.',
  'Números Reales: concepto, representación. Operaciones.',
  'Función: concepto y lectura de gráficos. Operaciones con funciones.',
]
const INTENTO_FRACCIONES = [
  'Fracciones equivalentes y simplificación hasta la expresión irreducible',
  'Suma y resta de fracciones de distinto denominador',
  'Multiplicación y división de fracciones',
]

describe('O2 · el puente respuesta → tema del programa', () => {
  it('normaliza tildes, mayúsculas y signos', () => {
    expect(normalizarTema('Números Reales: concepto, representación.')).toBe('numeros reales concepto representacion')
  })

  it('igual, normalizado', () => {
    expect(ubicarRespuesta('numeros reales: concepto, representacion. operaciones', INTENTO_GEOMETRIA)).toBe(
      'Números Reales: concepto, representación. Operaciones.',
    )
  })

  it('contenido con sentido y único', () => {
    expect(temaDelPrograma('Suma y resta de fracciones', INTENTO_FRACCIONES)).toBe('Suma y resta de fracciones de distinto denominador')
  })

  it('lo que escribe la IA suelto ("Tema de prueba", "Fracciones") no cuenta en un intento de varios temas', () => {
    expect(ubicarRespuesta('Tema de prueba', INTENTO_FRACCIONES)).toBeNull()
    // "fracciones" es una palabra sola: no alcanza para decidir entre tres.
    expect(ubicarRespuesta('Fracciones', INTENTO_FRACCIONES)).toBeNull()
    expect(ubicarRespuesta('Operaciones', INTENTO_GEOMETRIA)).toBeNull()
  })

  it('con un solo tema en el intento, la respuesta es de ese tema', () => {
    expect(ubicarRespuesta('Conjugación en pasado', ['El verbo'])).toBe('El verbo')
  })

  it('ambiguo (contenido en dos) no cuenta', () => {
    expect(temaDelPrograma('de fracciones', ['Suma de fracciones', 'Resta de fracciones'])).toBeNull()
  })
})

const ERROR: TemaAReforzar = {
  id: 7,
  materia: 'Matemática',
  tema: 'Suma y resta de fracciones de distinto denominador',
  desde: '2026-11-20T15:00:00.000Z',
}

function respuesta(terminadoEl: string, indice: number, correcta: boolean | null, topicName = 'Suma y resta de fracciones de distinto denominador'): RespuestaParaRacha {
  return { materia: 'Matemática', temasDelIntento: INTENTO_FRACCIONES, topicName, correcta, empezadoEl: terminadoEl, terminadoEl, indice }
}

describe('O2 · 3 aciertos seguidos en ese tema, después del error', () => {
  it('tres seguidos lo resuelven', () => {
    expect(
      temasSuperados([ERROR], [
        respuesta('2026-11-21T10:00:00.000Z', 0, true),
        respuesta('2026-11-21T10:00:00.000Z', 1, true),
        respuesta('2026-11-22T10:00:00.000Z', 0, true),
      ]),
    ).toEqual([7])
  })

  it('un error en el medio corta la racha', () => {
    expect(
      temasSuperados([ERROR], [
        respuesta('2026-11-21T10:00:00.000Z', 0, true),
        respuesta('2026-11-21T10:00:00.000Z', 1, false),
        respuesta('2026-11-21T10:00:00.000Z', 2, true),
        respuesta('2026-11-22T10:00:00.000Z', 0, true),
      ]),
    ).toEqual([])
  })

  it('los aciertos de antes del error no cuentan', () => {
    expect(
      temasSuperados([ERROR], [
        respuesta('2026-11-19T10:00:00.000Z', 0, true),
        respuesta('2026-11-19T10:00:00.000Z', 1, true),
        respuesta('2026-11-19T10:00:00.000Z', 2, true),
      ]),
    ).toEqual([])
  })

  it('el intento donde se cometió el error no cuenta, aunque termine después', () => {
    const mismo = (i: number) => ({ ...respuesta('2026-11-20T15:20:00.000Z', i, true), empezadoEl: '2026-11-20T14:50:00.000Z' })
    expect(temasSuperados([ERROR], [mismo(3), mismo(4), mismo(5)])).toEqual([])
  })

  it('otros temas, o lo que no se ubica, no cortan ni suman', () => {
    expect(
      temasSuperados([ERROR], [
        respuesta('2026-11-21T10:00:00.000Z', 0, true),
        respuesta('2026-11-21T10:00:00.000Z', 1, false, 'Multiplicación y división de fracciones'),
        respuesta('2026-11-21T10:00:00.000Z', 2, false, 'Tema de prueba'),
        respuesta('2026-11-21T10:00:00.000Z', 3, null),
        respuesta('2026-11-21T10:00:00.000Z', 4, true),
        respuesta('2026-11-21T10:00:00.000Z', 5, true),
      ]),
    ).toEqual([7])
  })

  it('otra materia no cuenta, aunque el tema se llame igual', () => {
    const otra = (i: number) => ({ ...respuesta('2026-11-21T10:00:00.000Z', i, true), materia: 'Didáctica de la Matemática' })
    expect(temasSuperados([ERROR], [otra(0), otra(1), otra(2)])).toEqual([])
  })

  it('un error cuyo tema no está en el programa no se resuelve solo', () => {
    const suelto = { ...ERROR, tema: 'Operaciones combinadas con fracciones mixtas' }
    expect(temasSuperados([suelto], [respuesta('2026-11-21T10:00:00.000Z', 0, true), respuesta('2026-11-21T10:00:00.000Z', 1, true), respuesta('2026-11-21T10:00:00.000Z', 2, true)])).toEqual([])
  })
})

describe('O2 · Ya lo dominás', () => {
  it('saca de "A reforzar" lo que el servidor ya dio por superado, de la misma materia', () => {
    const debiles = [
      { subject: 'Matemática', topicName: 'Suma y resta de fracciones de distinto denominador' },
      { subject: 'Matemática', topicName: 'Multiplicación y división de fracciones' },
      { subject: 'Lengua', topicName: 'Suma y resta de fracciones de distinto denominador' },
    ]
    const r = separarDominados(debiles, [{ materia: 'matematica', tema: 'Suma y resta de fracciones de distinto denominador', superadoEl: null }])
    expect(r.pendientes.map((d) => `${d.subject}: ${d.topicName}`)).toEqual([
      'Matemática: Multiplicación y división de fracciones',
      'Lengua: Suma y resta de fracciones de distinto denominador',
    ])
  })
})
