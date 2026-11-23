import { describe, expect, it } from 'vitest'
import { armarBanco, cuantasGenerar, facetasDelBanco, sumarDelBanco, unidadesDelPrograma, type FilaDelBanco } from './banco'

const units = [
  { name: 'Unidad 1: Mercados', topics: [{ id: 'u1t1', name: 'Oferta y demanda' }, { id: 'u1t2', name: 'Elasticidad' }] },
  { name: 'Unidad 2: Macro', topics: [{ id: 'u2t1', name: 'Inflación' }] },
]
const fila = (quizId: number, indice: number, pregunta: Record<string, unknown>, extra: Partial<FilaDelBanco> = {}): FilaDelBanco => ({
  quizId,
  indice,
  titulo: `Cuestionario ${quizId}`,
  materiaId: 7,
  materia: 'Economía',
  creadoEl: `2026-11-${10 + quizId}T10:00:00Z`,
  pregunta,
  valor: null,
  ...extra,
})
const mc = (texto: string, topic = 'u1t1', topicName = 'Oferta y demanda') => ({ type: 'multiple_choice', question: texto, options: ['a', 'b'], correctAnswer: 0, topic, topicName })

const FILAS: FilaDelBanco[] = [
  fila(1, 0, mc('¿Qué pasa con la demanda si sube el precio?')),
  fila(1, 1, mc('¿Qué mide la inflación?', 'u2t1', 'Inflación'), { valor: -1 }),
  fila(2, 0, mc('¿Qué pasa con la demanda si sube el precio?'), { valor: 1 }),
  fila(2, 1, { type: 'true_false', question: 'La elasticidad mide la sensibilidad.', correctAnswer: true, topic: 'u1t2', topicName: 'Elasticidad' }),
  fila(3, 0, { type: 'matching', question: 'Uní cada concepto.', pairs: [{ left: 'A', right: '1' }], topicName: 'Elasticidad' }, { materiaId: null, materia: 'Sin materia' }),
  fila(3, 1, { nada: true }),
]
const unidades = new Map([[7, unidadesDelPrograma(units)]])

describe('el banco de preguntas (W1)', () => {
  it('una sola vez cada pregunta (la más nueva), con su unidad, tema, tipo y pulgar', () => {
    const banco = armarBanco(FILAS, unidades)
    expect(banco.map((b) => b.clave)).toEqual(['3:0', '2:0', '2:1', '1:1'])
    expect(banco.find((b) => b.clave === '2:0')).toMatchObject({ unidad: 'Unidad 1: Mercados', tema: 'Oferta y demanda', valoracion: 'arriba' })
    expect(banco.find((b) => b.clave === '1:1')).toMatchObject({ unidad: 'Unidad 2: Macro', valoracion: 'abajo' })
    expect(banco.find((b) => b.clave === '3:0')?.unidad).toBeNull()
  })

  it('filtra por texto (sin tildes), materia, unidad, tema, tipo y valoración', () => {
    expect(armarBanco(FILAS, unidades, { texto: 'inflacion' }).map((b) => b.clave)).toEqual(['1:1'])
    expect(armarBanco(FILAS, unidades, { materiaId: 7 }).length).toBe(3)
    expect(armarBanco(FILAS, unidades, { unidad: 'Unidad 2: Macro' }).map((b) => b.clave)).toEqual(['1:1'])
    expect(armarBanco(FILAS, unidades, { tema: 'Elasticidad' }).map((b) => b.clave)).toEqual(['3:0', '2:1'])
    expect(armarBanco(FILAS, unidades, { tipo: 'true_false' }).map((b) => b.clave)).toEqual(['2:1'])
    expect(armarBanco(FILAS, unidades, { valoracion: 'abajo' }).map((b) => b.clave)).toEqual(['1:1'])
    // El texto busca también en los pares del emparejamiento.
    expect(armarBanco(FILAS, unidades, { texto: 'unI cada' }).map((b) => b.clave)).toEqual(['3:0'])
  })

  it('las facetas salen del banco', () => {
    const f = facetasDelBanco(armarBanco(FILAS, unidades))
    expect(f.materias).toEqual([{ id: 7, nombre: 'Economía' }])
    expect(f.unidades).toEqual(['Unidad 1: Mercados', 'Unidad 2: Macro'])
    expect(f.tipos.sort()).toEqual(['matching', 'multiple_choice', 'true_false'])
  })

  it('sumar del banco: las elegidas primero, ids nuevos, y la IA completa el resto', () => {
    expect(cuantasGenerar(10, 3)).toBe(7)
    expect(cuantasGenerar(2, 5)).toBe(0)
    const final = sumarDelBanco([{ id: 'q9', question: 'del banco' }], [{ id: 'q1', question: 'nueva' }])
    expect(final.map((q) => q.id)).toEqual(['q1', 'q2'])
    expect(final[0]).toMatchObject({ question: 'del banco' })
  })
})
