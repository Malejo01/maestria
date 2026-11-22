import { describe, expect, it } from 'vitest'
import { accionDeLaBarraDocente, materiaInicialParaArmar } from './primer-uso-docente'

/** P5 · Las propuestas de O13 que son reglas. */
describe('propuesta 1: con una sola materia, armar entra directo', () => {
  const base = { materiaDeLaUrl: null, armando: true, yaElegida: false }

  it('una sola materia: ésa', () => {
    expect(materiaInicialParaArmar({ ...base, materias: [11] })).toBe(11)
  })

  it('con dos o ninguna, se elige (no se adivina)', () => {
    expect(materiaInicialParaArmar({ ...base, materias: [11, 12] })).toBeNull()
    expect(materiaInicialParaArmar({ ...base, materias: [] })).toBeNull()
  })

  it('la de la URL manda; fuera de "armar" o con una ya elegida, no se toca', () => {
    expect(materiaInicialParaArmar({ ...base, materiaDeLaUrl: 12, materias: [11] })).toBe(12)
    expect(materiaInicialParaArmar({ ...base, armando: false, materias: [11] })).toBeNull()
    expect(materiaInicialParaArmar({ ...base, yaElegida: true, materias: [11] })).toBeNull()
  })
})

describe('propuesta 2: "+ Alumno" recién con una materia', () => {
  it('sin materias, la barra ofrece crearla; con una o sin saber, "+ Alumno"', () => {
    expect(accionDeLaBarraDocente(0)).toBe('crearMateria')
    expect(accionDeLaBarraDocente(1)).toBe('agregarAlumno')
    expect(accionDeLaBarraDocente(null)).toBe('agregarAlumno')
  })
})
