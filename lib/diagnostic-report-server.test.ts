import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O6 · Caracterización del reporte del 10/08 ANTES de parametrizarlo por
 * programa: `/teacher/diagnostico` tiene que seguir mostrándose igual. Fija
 * qué unidades salen, en qué orden, con qué vínculo al programa y qué totales,
 * a partir de filas como las que devuelve la base.
 */
const { consultas } = vi.hoisted(() => ({ consultas: [] as { texto: string; valores: unknown[] }[] }))

const TALLIES = [
  { unit: 'Geometría y Medida', question_type: 'multiple_choice', total: 40, correct: 10 },
  { unit: 'Números y Operaciones', question_type: 'multiple_choice', total: 60, correct: 33 },
  { unit: 'Números y Operaciones', question_type: 'numeric', total: 20, correct: 7 },
  { unit: 'Números y Operaciones', question_type: 'short_answer', total: 12, correct: 0 },
  { unit: 'Álgebra y Funciones', question_type: 'true_false', total: 30, correct: 21 },
  { unit: 'Probabilidad y Estadística', question_type: 'multiple_choice', total: 25, correct: 6 },
]
const POR_ALUMNO = [
  { unit: 'Números y Operaciones', user_id: 'a', total: 10, correct: 6 },
  { unit: 'Números y Operaciones', user_id: 'b', total: 10, correct: 4 },
  { unit: 'Álgebra y Funciones', user_id: 'a', total: 6, correct: 5 },
]
const TEMAS_DEL_10_08 = [
  { eje: 'Números y Operaciones', temas: ['Números reales: propiedades', 'Intervalos en la recta real'] },
  { eje: 'Álgebra y Funciones', temas: ['Función lineal', 'Función cuadrática'] },
  { eje: 'Geometría y Medida', temas: ['Cónicas', 'Distancia entre puntos'] },
  { eje: 'Probabilidad y Estadística', temas: ['Combinatoria'] },
]
const TOTALES = [{ students: 31, attempts: 84, unattributed_attempts: 7, short_answers: 235, short_answers_wrong: 224 }]

vi.mock('@/lib/db', () => ({
  sql: Object.assign(() => Promise.resolve([]), {
    query: (texto: string, valores: unknown[]) => {
      consultas.push({ texto, valores })
      if (texto.includes('GROUP BY cu.eje, ans.question_type')) return Promise.resolve(TALLIES)
      if (texto.includes('GROUP BY cu.eje, a.user_id')) return Promise.resolve(POR_ALUMNO)
      if (texto.includes('unattributed_attempts')) return Promise.resolve(TOTALES)
      if (texto.includes('SELECT eje, temas FROM curriculum')) return Promise.resolve(TEMAS_DEL_10_08)
      return Promise.resolve([])
    },
  }),
}))

import { loadCourseDiagnostic } from './diagnostic-report-server'

beforeEach(() => {
  consultas.length = 0
})

describe('el reporte del 10/08, como se muestra hoy', () => {
  it('unidades, orden (lo del programa primero), vínculos y totales', async () => {
    const r = await loadCourseDiagnostic()
    expect(r.date).toBe('2026-08-10')
    expect({ students: r.students, attempts: r.attempts, unattributedAttempts: r.unattributedAttempts, shortAnswerTotal: r.shortAnswerTotal, shortAnswerMarkedWrong: r.shortAnswerMarkedWrong }).toEqual({
      students: 31,
      attempts: 84,
      unattributedAttempts: 7,
      shortAnswerTotal: 235,
      shortAnswerMarkedWrong: 224,
    })
    expect(r.units.map((u) => [u.unit, u.programLink.programUnit])).toEqual([
      ['Álgebra y Funciones', 'Unidad 5 — Funciones y Modelización Matemática'],
      ['Números y Operaciones', 'Unidad 3 — Álgebra y Ecuaciones para Sistemas de Información'],
      ['Geometría y Medida', null],
      ['Probabilidad y Estadística', null],
    ])
    const numeros = r.units.find((u) => u.unit === 'Números y Operaciones')!
    expect(numeros.byType).toEqual({ multiple_choice: { total: 60, correct: 33 }, true_false: { total: 0, correct: 0 }, numeric: { total: 20, correct: 7 } })
    expect(numeros.excludedShortAnswers).toBe(12)
    expect(numeros.students).toBe(2)
    expect(r.units.find((u) => u.unit === 'Geometría y Medida')!.programLink.rationale).toBe(
      'Cónicas y geometría analítica no forman parte del programa de la carrera. No se va a dictar.',
    )
  })

  it('todas las consultas son del 10/08', async () => {
    await loadCourseDiagnostic()
    expect(consultas.every((c) => c.valores[0] === '2026-08-10')).toBe(true)
  })
})

describe('O6 · el mismo diagnóstico, contra otro programa', () => {
  it('cada unidad se vincula con las unidades y temas del programa elegido', async () => {
    const r = await loadCourseDiagnostic({
      programa: {
        materia: 'Matemática y su Didáctica',
        unidades: [
          { nombre: 'Unidad I: Números y operaciones', temas: ['Números reales: propiedades', 'Divisibilidad'] },
          { nombre: 'Unidad IV: Geometría y Medida', temas: ['Figuras planas'] },
        ],
      },
    })
    expect(r.programa).toBe('Matemática y su Didáctica')
    const vinculo = Object.fromEntries(r.units.map((u) => [u.unit, u.programLink.programUnit]))
    expect(vinculo).toEqual({
      'Números y Operaciones': 'Unidad I: Números y operaciones',
      'Geometría y Medida': 'Unidad IV: Geometría y Medida',
      'Álgebra y Funciones': null,
      'Probabilidad y Estadística': null,
    })
    // Lo que está en el programa va primero, como siempre.
    expect(r.units.slice(0, 2).every((u) => u.programLink.programUnit)).toBe(true)
  })
})
