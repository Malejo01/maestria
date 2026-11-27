import { describe, expect, it } from 'vitest'
import { estadoDelArranque, pasoActual, type DatosDelArranque } from './arranque-docente'

const AHORA = new Date('2026-11-27T15:00:00Z')
const haceDias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000).toISOString()
const datos = (parcial: Partial<DatosDelArranque> = {}): DatosDelArranque => ({
  materias: 0,
  tareasArmadas: 0,
  tareasMandadas: 0,
  primerasPracticas: [],
  ...parcial,
})

describe('estadoDelArranque (AB4)', () => {
  it('paso 0: no hizo nada; toca subir el programa', () => {
    const e = estadoDelArranque(datos(), AHORA)
    expect(e.paso).toBe(0)
    expect(e.mostrar).toBe('lista')
    expect(pasoActual(e)).toBe(1)
  })

  it('paso 1: tiene el programa; toca revisar y aprobar el primer cuestionario', () => {
    const e = estadoDelArranque(datos({ materias: 1 }), AHORA)
    expect(e.paso).toBe(1)
    expect(e.hechos).toEqual({ programa: true, aprobado: false, mandado: false })
    expect(pasoActual(e)).toBe(2)
  })

  it('paso 2: aprobó un cuestionario; toca mandárselo a 2 alumnos', () => {
    const e = estadoDelArranque(datos({ materias: 1, tareasArmadas: 1 }), AHORA)
    expect(e.paso).toBe(2)
    expect(pasoActual(e)).toBe(3)
  })

  it('paso 3: lo mandó, pero todavía no practicaron 2 (la lista sigue, con los tres tildados)', () => {
    const e = estadoDelArranque(datos({ materias: 1, tareasArmadas: 1, tareasMandadas: 1, primerasPracticas: [haceDias(1)] }), AHORA)
    expect(e.paso).toBe(3)
    expect(e.practicaron).toBe(1)
    expect(e.mostrar).toBe('lista')
    expect(pasoActual(e)).toBeNull()
  })

  it('completo: practicaron 2 alumnos; muestra el «Listo» y no la lista', () => {
    const e = estadoDelArranque(
      datos({ materias: 1, tareasArmadas: 1, tareasMandadas: 1, primerasPracticas: [haceDias(2), haceDias(1)] }),
      AHORA,
    )
    expect(e.paso).toBe('completo')
    expect(e.mostrar).toBe('listo')
  })

  it('el «Listo» dura 7 días desde que practicó el segundo; después, nada', () => {
    const viejo = estadoDelArranque(datos({ materias: 1, tareasMandadas: 1, primerasPracticas: [haceDias(30), haceDias(8)] }), AHORA)
    expect(viejo.paso).toBe('completo')
    expect(viejo.mostrar).toBeNull()
  })

  it('mandar una tarea cuenta como haberla aprobado; el paso es el primero que falta, en orden', () => {
    expect(estadoDelArranque(datos({ materias: 1, tareasMandadas: 1 }), AHORA).paso).toBe(3)
    // Una tarea sin materia propia (dato huérfano): el programa sigue faltando.
    expect(estadoDelArranque(datos({ tareasArmadas: 2 }), AHORA).paso).toBe(0)
  })

  it('fechas rotas no cuentan como prácticas', () => {
    expect(estadoDelArranque(datos({ materias: 1, primerasPracticas: ['basura', haceDias(1)] }), AHORA).practicaron).toBe(1)
  })
})
