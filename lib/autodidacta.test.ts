import { describe, expect, it } from 'vitest'
import { diasHastaElExamen, estadoPorTema, planHastaElExamen, preguntasDelDiagnostico, resultadoPorTema } from './autodidacta'

const HOY = new Date('2027-02-01T15:00:00-03:00')

describe('E1 · lo que ya sabés y lo que tenés que reforzar', () => {
  it('suma diagnóstico, prácticas y simulacros, tema por tema', () => {
    const estados = estadoPorTema(
      ['Cultura', 'Etnocentrismo', 'Rituales', 'Parentesco'],
      [
        { por_tema: [{ tema: 'Cultura', correctas: 1, total: 1 }, { tema: 'Etnocentrismo', correctas: 0, total: 1 }, { tema: 'Rituales', correctas: 1, total: 1 }] },
        { por_tema: [{ tema: 'cultura', correctas: 2, total: 2 }, { tema: 'Etnocentrismo', correctas: 1, total: 2 }] },
      ],
    )
    expect(estados.map((e) => [e.tema, e.estado])).toEqual([
      ['Cultura', 'sabido'],
      ['Etnocentrismo', 'reforzar'],
      ['Rituales', 'sin_datos'], // una sola respuesta bien: todavía no alcanza para "sabido"
      ['Parentesco', 'sin_datos'],
    ])
  })

  it('de las respuestas de un cuestionario, por tema', () => {
    expect(
      resultadoPorTema([
        { topicName: 'Cultura', isCorrect: true },
        { topicName: 'Cultura', isCorrect: false },
        { topicName: 'Rituales', isCorrect: true },
        { topicName: 'Rituales', isCorrect: null },
      ]),
    ).toEqual([
      { tema: 'Cultura', correctas: 1, total: 2 },
      { tema: 'Rituales', correctas: 1, total: 1 },
    ])
  })
})

describe('E1 · el plan hasta el examen (reparto de temas en los días)', () => {
  const temas = [
    { tema: 'A', estado: 'reforzar' as const },
    { tema: 'B', estado: 'reforzar' as const },
    { tema: 'C', estado: 'sin_datos' as const },
    { tema: 'D', estado: 'sabido' as const },
    { tema: 'E', estado: 'reforzar' as const },
  ]

  it('días hasta el examen, en Argentina', () => {
    expect(diasHastaElExamen(HOY, '2027-02-24')).toBe(23)
    expect(diasHastaElExamen(new Date('2027-02-01T23:30:00-03:00'), '2027-02-02')).toBe(1)
    expect(diasHastaElExamen(HOY, '2027-01-30')).toBe(-2)
  })

  it('con 6 días: primero lo flojo, después lo sin datos, y los dos últimos días simulacro', () => {
    const plan = planHastaElExamen({ temas, hoy: HOY, fechaExamen: '2027-02-07' })
    expect(plan).toHaveLength(6)
    // 4 días de estudio para 4 temas: uno por día, lo flojo (A, B, E) antes que lo sin datos (C).
    expect(plan[0]).toEqual({ fecha: '2027-02-01', temas: ['A'], simulacro: false })
    expect(plan.slice(0, 4).map((d) => d.temas[0])).toEqual(['A', 'B', 'E', 'C'])
    expect(plan.slice(-2).every((d) => d.simulacro)).toBe(true)
    // Todo lo flojo y lo sin datos aparece antes de los simulacros; lo sabido, no.
    const estudiados = plan.filter((d) => !d.simulacro).flatMap((d) => d.temas)
    for (const t of ['A', 'B', 'C', 'E']) expect(estudiados).toContain(t)
    expect(estudiados).not.toContain('D')
  })

  it('con todo sabido, se repasa todo; sin días, no hay plan', () => {
    const plan = planHastaElExamen({ temas: [{ tema: 'X', estado: 'sabido' }], hoy: HOY, fechaExamen: '2027-02-03' })
    expect(plan.flatMap((d) => d.temas)).toContain('X')
    expect(planHastaElExamen({ temas, hoy: HOY, fechaExamen: '2027-02-01' })).toEqual([])
  })

  it('el diagnóstico: una pregunta por tema, entre 5 y 20', () => {
    expect(preguntasDelDiagnostico(3)).toBe(5)
    expect(preguntasDelDiagnostico(12)).toBe(12)
    expect(preguntasDelDiagnostico(40)).toBe(20)
  })
})
