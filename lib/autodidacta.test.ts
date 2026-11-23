import { describe, expect, it } from 'vitest'
import { accesoALaMateria, diasHastaElExamen, fechaDeExamenValida, paseAlCambiarLaFecha, estadoPorTema, paseHastaPara, paseVigente, planHastaElExamen, preguntasDelDiagnostico, puedeGenerar, resultadoPorTema } from './autodidacta'

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

describe('E2 · el pase por materia', () => {
  it('vale hasta el examen + 7; si el examen ya pasó, hasta hoy + 7', () => {
    expect(paseHastaPara('2027-02-20', HOY)).toBe('2027-02-27')
    expect(paseHastaPara('2027-01-10', HOY)).toBe('2027-02-08')
    expect(paseHastaPara(null, HOY)).toBe('2027-02-08')
  })

  it('está vigente hasta ese día inclusive, en hora argentina', () => {
    expect(paseVigente('2027-02-01', HOY)).toBe(true)
    expect(paseVigente('2027-01-31', HOY)).toBe(false)
    expect(paseVigente(null, HOY)).toBe(false)
    // 23:30 del 1/2 en Argentina ya es 2/2 en UTC: sigue valiendo.
    expect(paseVigente('2027-02-01', new Date('2027-02-01T23:30:00-03:00'))).toBe(true)
  })

  it('gratis: el diagnóstico (dos intentos) y dos prácticas; ningún simulacro', () => {
    const nuevo = accesoALaMateria({ paseHasta: null, usos: {}, hoy: HOY })
    expect(nuevo).toEqual({ pase: null, quedan: { diagnostico: 2, practica: 2, simulacro: 0 } })
    expect(puedeGenerar(nuevo, 'practica')).toBe(true)
    expect(puedeGenerar(nuevo, 'simulacro')).toBe(false)
    const usado = accesoALaMateria({ paseHasta: null, usos: { diagnostico: 1, practica: 2 }, hoy: HOY })
    expect(usado.quedan).toEqual({ diagnostico: 1, practica: 0, simulacro: 0 })
    expect(puedeGenerar(usado, 'practica')).toBe(false)
  })

  it('con el pase vigente, todo; vencido, vuelve a lo gratis', () => {
    const conPase = accesoALaMateria({ paseHasta: '2027-02-27', usos: { practica: 9, simulacro: 3 }, hoy: HOY })
    expect(conPase.pase).toBe('2027-02-27')
    expect(puedeGenerar(conPase, 'simulacro')).toBe(true)
    expect(puedeGenerar(conPase, 'practica')).toBe(true)
    const vencido = accesoALaMateria({ paseHasta: '2027-01-20', usos: { practica: 9 }, hoy: HOY })
    expect(vencido.pase).toBeNull()
    expect(puedeGenerar(vencido, 'practica')).toBe(false)
  })
})

describe('paseAlCambiarLaFecha (U2)', () => {
  // 23/11 a las 12 en Argentina.
  const hoy = new Date('2026-11-23T15:00:00Z')

  it('corre el pase para adelante: fecha nueva + 7 días', () => {
    expect(paseAlCambiarLaFecha({ paseHasta: '2026-12-17', corridoEl: null, fechaNueva: '2026-12-20', hoy })).toEqual({
      paseHasta: '2026-12-27',
      resultado: 'corrido',
    })
  })

  it('nunca lo acorta: si la fecha nueva es antes, queda como estaba y la vez no se gasta', () => {
    expect(paseAlCambiarLaFecha({ paseHasta: '2026-12-17', corridoEl: null, fechaNueva: '2026-12-01', hoy })).toEqual({
      paseHasta: '2026-12-17',
      resultado: 'no-acorta',
    })
    // Con la misma fecha, igual.
    expect(paseAlCambiarLaFecha({ paseHasta: '2026-12-17', corridoEl: null, fechaNueva: '2026-12-10', hoy }).resultado).toBe('no-acorta')
  })

  it('una sola vez por pase: el segundo cambio no lo mueve', () => {
    expect(
      paseAlCambiarLaFecha({ paseHasta: '2026-12-27', corridoEl: '2026-11-23T15:00:00Z', fechaNueva: '2027-01-15', hoy }),
    ).toEqual({ paseHasta: '2026-12-27', resultado: 'ya-corrido' })
  })

  it('sin pase vigente no hay nada que correr', () => {
    expect(paseAlCambiarLaFecha({ paseHasta: null, corridoEl: null, fechaNueva: '2026-12-20', hoy }).resultado).toBe('sin-pase')
    expect(paseAlCambiarLaFecha({ paseHasta: '2026-11-20', corridoEl: null, fechaNueva: '2026-12-20', hoy })).toEqual({
      paseHasta: '2026-11-20',
      resultado: 'sin-pase',
    })
  })
})

describe('fechaDeExamenValida (U2)', () => {
  const hoy = new Date('2026-11-23T15:00:00Z')
  it('acepta de hoy en adelante, hasta dos años', () => {
    expect(fechaDeExamenValida('2026-11-23', hoy)).toBe(true)
    expect(fechaDeExamenValida('2027-03-01', hoy)).toBe(true)
  })
  it('rechaza el pasado, fechas que no existen, formatos raros y lo muy lejano', () => {
    expect(fechaDeExamenValida('2026-11-22', hoy)).toBe(false)
    expect(fechaDeExamenValida('2026-02-30', hoy)).toBe(false)
    expect(fechaDeExamenValida('23/12/2026', hoy)).toBe(false)
    expect(fechaDeExamenValida('2029-01-01', hoy)).toBe(false)
    expect(fechaDeExamenValida(null, hoy)).toBe(false)
  })
})
