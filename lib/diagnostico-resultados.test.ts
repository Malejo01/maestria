import { describe, expect, it } from 'vitest'
import {
  elegirFuente,
  marcasDeLaApp,
  marcasDelImpreso,
  preguntasDelCuestionario,
  resultadoPorTema,
  resumenPorUnidad,
  temaDePregunta,
  temasFallados,
} from './diagnostico-resultados'
import { FICHA_VACIA, sumarTemasDificiles } from './fichas'
import type { ProgramUnit } from './types'

const UNIDADES: ProgramUnit[] = [
  { id: 'u1', name: 'Unidad II · Ecuaciones', topics: [{ id: 't1', name: 'Ecuación lineal' }, { id: 't2', name: 'Inecuaciones' }] },
  { id: 'u2', name: 'Unidad III · Funciones', topics: [{ id: 't3', name: 'Función lineal' }] },
]
const TEMAS = UNIDADES.flatMap((u) => u.topics.map((t) => ({ id: t.id, name: t.name })))
const unidadDe = (temaId: string) => UNIDADES.find((u) => u.topics.some((t) => t.id === temaId))?.id ?? null

describe('temaDePregunta — la IA escribe el nombre del tema, a veces el id', () => {
  it('por nombre, sin importar tildes ni mayúsculas', () => {
    expect(temaDePregunta({ topic: 'ecuacion LINEAL' }, TEMAS)).toEqual({ id: 't1', nombre: 'Ecuación lineal' })
  })
  it('por id', () => {
    expect(temaDePregunta({ topic: 't3', topicName: 'otra cosa' }, TEMAS)).toEqual({ id: 't3', nombre: 'Función lineal' })
  })
  it('si no está, queda el nombre que escribió (no se pierde la pregunta)', () => {
    expect(temaDePregunta({ topic: 'Logaritmos' }, TEMAS).nombre).toBe('Logaritmos')
  })
})

describe('resultado tema por tema (no usa los umbrales de la planilla)', () => {
  const preguntas = preguntasDelCuestionario(
    [
      { id: 'q1', topic: 'Ecuación lineal' },
      { id: 'q2', topic: 'Ecuación lineal' },
      { id: 'q3', topic: 'Inecuaciones' },
      { id: 'q4', topic: 'Inecuaciones' },
      { id: 'q5', topic: 'Función lineal' },
    ],
    TEMAS,
  )

  it('con 1 o 2 preguntas por tema ya hay un estado: acertó, falló o no respondió', () => {
    const temas = resultadoPorTema(preguntas, ['bien', 'bien', 'bien', 'mal', 'sin_responder'], unidadDe)
    expect(temas.map((t) => [t.temaId, t.estado, t.bien, t.total])).toEqual([
      ['t1', 'acerto', 2, 2],
      ['t2', 'fallo', 1, 2],
      ['t3', 'no_respondio', 0, 1],
    ])
  })

  it('por unidad: "Unidad II · Ecuaciones — 3 de 4", en el orden del programa', () => {
    const temas = resultadoPorTema(preguntas, ['bien', 'bien', 'bien', 'mal', 'sin_responder'], unidadDe)
    expect(resumenPorUnidad(temas, UNIDADES)).toEqual([
      { unidadId: 'u1', nombre: 'Unidad II · Ecuaciones', bien: 3, total: 4 },
      { unidadId: 'u2', nombre: 'Unidad III · Funciones', bien: 0, total: 1 },
    ])
  })

  it('los temas para marcar son sólo los que falló', () => {
    const temas = resultadoPorTema(preguntas, ['mal', 'bien', 'bien', 'bien', 'mal'], unidadDe)
    expect(temasFallados(temas).map((t) => t.temaId)).toEqual(['t1', 't3'])
  })

  it('las respuestas de la app se cruzan por id de pregunta; la que no está, no respondió', () => {
    const marcas = marcasDeLaApp(preguntas, [
      { questionId: 'q2', questionIndex: 1, isCorrect: true },
      { questionId: 'q1', questionIndex: 0, isCorrect: false },
    ])
    expect(marcas).toEqual(['mal', 'bien', 'sin_responder', 'sin_responder', 'sin_responder'])
  })

  it('el impreso viene por índice; lo que no es bien ni mal es sin responder', () => {
    expect(marcasDelImpreso(preguntas, { '0': 'bien', '1': 'mal', '4': 'cualquiera' })).toEqual([
      'bien',
      'mal',
      'sin_responder',
      'sin_responder',
      'sin_responder',
    ])
  })
})

describe('elegirFuente — si rindió en la app y también hay impreso, lo más reciente', () => {
  const app = { fecha: '2026-11-19T10:00:00.000Z' }
  const impreso = { fecha: '2026-11-20T10:00:00.000Z' }
  it('gana el impreso cargado después', () => {
    expect(elegirFuente(app, impreso)?.fuente).toBe('impreso')
  })
  it('gana la app si rindió después de la carga', () => {
    expect(elegirFuente({ fecha: '2026-11-21T00:00:00.000Z' }, impreso)?.fuente).toBe('app')
  })
  it('sin nada, null', () => {
    expect(elegirFuente(null, null)).toBeNull()
  })
})

describe('sumarTemasDificiles — "Marcar los N temas que falló"', () => {
  it('se suman a los que ya tenía, sin repetir', () => {
    const ficha = { ...FICHA_VACIA, materiaId: 4, temasDificiles: ['t1'] }
    expect(sumarTemasDificiles(ficha, 4, ['t1', 't3']).temasDificiles).toEqual(['t1', 't3'])
  })
  it('si la ficha era de otra materia, pasa a la del diagnóstico', () => {
    const ficha = { ...FICHA_VACIA, materiaId: 9, temasDificiles: ['x'] }
    expect(sumarTemasDificiles(ficha, 4, ['t1'])).toMatchObject({ materiaId: 4, temasDificiles: ['t1'] })
  })
})
