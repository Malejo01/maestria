import { describe, expect, it } from 'vitest'
import { computeHistoryStats } from './history-stats'
import type { ReinforceTopic, SubjectModeTotals } from '@/lib/types'

const fila = (over: Partial<SubjectModeTotals> = {}): SubjectModeTotals => ({
  subject: 'Álgebra I',
  mode: 'practico',
  attempts: 1,
  correct: 8,
  graded: 10,
  ...over,
})

describe('computeHistoryStats — el promedio', () => {
  /**
   * El caso que justifica todo el módulo. Dos intentos:
   *   - 2 de 2 correctas → nota 10
   *   - 5 de 20 correctas → nota 2,5
   *
   * Promediar las NOTAS da 6,25 y le da el mismo peso a un intento de 2
   * preguntas que a uno de 20. SUM/SUM da 7/22 → 3,18, que es la proporción
   * real de respuestas acertadas.
   */
  it('pesa cada respuesta una vez, no cada intento', () => {
    const stats = computeHistoryStats(
      [
        fila({ attempts: 1, correct: 2, graded: 2 }),
        fila({ attempts: 1, correct: 5, graded: 20 }),
      ],
      [],
      'Álgebra I',
      'all',
    )

    expect(stats.promedio).toBeCloseTo(3.18, 2)
    // El promedio de promedios, que es lo que hacía antes:
    expect(stats.promedio).not.toBeCloseTo(6.25, 2)
  })

  it('devuelve null —y no 0— cuando no hay nada calificado', () => {
    // Un 0 se dibuja como "0.0" y se lee como "te fue pésimo"; null apaga la
    // tarjeta. Pasa con un intento entero sin calificar (migración 021).
    const stats = computeHistoryStats([fila({ correct: 0, graded: 0 })], [], 'Álgebra I', 'all')
    expect(stats.promedio).toBeNull()
  })

  it('devuelve null cuando los filtros no dejan ninguna fila', () => {
    const stats = computeHistoryStats([fila()], [], 'Historia', 'all')
    expect(stats.promedio).toBeNull()
    expect(stats.total).toBe(0)
  })

  it('está en escala 0-10, la misma que la nota de cada intento', () => {
    const stats = computeHistoryStats([fila({ correct: 10, graded: 10 })], [], 'Álgebra I', 'all')
    expect(stats.promedio).toBe(10)
  })
})

describe('computeHistoryStats — los filtros', () => {
  const totales = [
    fila({ subject: 'Álgebra I', mode: 'practico', attempts: 2, correct: 8, graded: 10 }),
    fila({ subject: 'Álgebra I', mode: 'teorico', attempts: 1, correct: 2, graded: 10 }),
    fila({ subject: 'Historia', mode: 'practico', attempts: 3, correct: 30, graded: 30 }),
  ]

  it('"todas" agrega todo el historial', () => {
    const stats = computeHistoryStats(totales, [], 'all', 'all')
    expect(stats.total).toBe(6)
    expect(stats.promedio).toBeCloseTo(8, 2) // 40/50
  })

  /**
   * La regresión que motivó el cambio: las tarjetas se calculaban sobre la
   * lista completa mientras el listado usaba la filtrada, así que filtrar por
   * una materia dejaba el promedio de todas.
   */
  it('el filtro de materia cambia el promedio', () => {
    const stats = computeHistoryStats(totales, [], 'Álgebra I', 'all')
    expect(stats.total).toBe(3)
    expect(stats.promedio).toBeCloseTo(5, 2) // 10/20, y NO 40/50
  })

  it('el filtro de modo también acota', () => {
    const stats = computeHistoryStats(totales, [], 'Álgebra I', 'teorico')
    expect(stats.total).toBe(1)
    expect(stats.promedio).toBeCloseTo(2, 2) // 2/10
  })
})

describe('computeHistoryStats — temas a reforzar', () => {
  const temas: ReinforceTopic[] = [
    { subject: 'Álgebra I', topicId: 'factoreo' },
    { subject: 'Álgebra I', topicId: 'factoreo' }, // repetido: un solo tema
    { subject: 'Álgebra I', topicId: 'logaritmos' },
    { subject: 'Historia', topicId: 'factoreo' }, // mismo id, otra materia
  ]

  it('cuenta temas distintos, no filas', () => {
    expect(computeHistoryStats([], temas, 'Álgebra I', 'all').temasAReforzar).toBe(2)
  })

  it('no fusiona dos materias que comparten topic_id', () => {
    // `topic_id` se deriva del nombre del tema, así que la colisión entre
    // materias es posible y contarla como un solo tema subestima lo que falta.
    expect(computeHistoryStats([], temas, 'all', 'all').temasAReforzar).toBe(3)
  })

  it('ignora el filtro de modo: una confusión conceptual no es teórica ni práctica', () => {
    const conModo = computeHistoryStats([], temas, 'Álgebra I', 'teorico').temasAReforzar
    const sinModo = computeHistoryStats([], temas, 'Álgebra I', 'all').temasAReforzar
    expect(conModo).toBe(sinModo)
  })
})
