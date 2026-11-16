import { describe, expect, it } from 'vitest'
import { calcularOnboarding, contarTemas, type DatosOnboarding } from './onboarding-docente'

const nada: DatosOnboarding = { materias: 0, temas: 0, alumnos: 0, tareasArmadas: 0, tareasMandadas: 0 }
const con = (parcial: Partial<DatosOnboarding>) => calcularOnboarding({ ...nada, ...parcial })

describe('calcularOnboarding', () => {
  it('un docente recién llegado no tiene ningún hito y empieza por su materia', () => {
    const estado = con({})
    expect(estado.cantidadHechos).toBe(0)
    expect(estado.siguiente).toBe('materia')
    expect(estado.completo).toBe(false)
  })

  it('una materia sin temas todavía no tiene temario', () => {
    const estado = con({ materias: 1 })
    expect(estado.hechos).toMatchObject({ materia: true, temario: false })
    expect(estado.siguiente).toBe('temario')
  })

  it('con temario, lo que sigue es el primer alumno', () => {
    const estado = con({ materias: 1, temas: 12 })
    expect(estado.siguiente).toBe('alumno')
    expect(estado.cantidadHechos).toBe(2)
  })

  it('NO termina con el alumno adentro: falta la tarea', () => {
    const estado = con({ materias: 1, temas: 12, alumnos: 1 })
    expect(estado.siguiente).toBe('tarea')
    expect(estado.completo).toBe(false)
  })

  it('una tarea armada pero sin mandar no completa el hito, y lo dice', () => {
    const estado = con({ materias: 1, temas: 12, alumnos: 1, tareasArmadas: 2 })
    expect(estado.hechos.tarea).toBe(false)
    expect(estado.faltaSoloMandar).toBe(true)
  })

  it('termina cuando hay un alumno y una tarea mandada', () => {
    const estado = con({ materias: 1, temas: 12, alumnos: 3, tareasArmadas: 1, tareasMandadas: 1 })
    expect(estado.completo).toBe(true)
    expect(estado.siguiente).toBeNull()
    expect(estado.cantidadHechos).toBe(4)
    expect(estado.faltaSoloMandar).toBe(false)
  })

  it('mandó la tarea antes de que entrara nadie: el pendiente es el alumno, no la tarea', () => {
    const estado = con({ materias: 1, temas: 12, tareasArmadas: 1, tareasMandadas: 1 })
    expect(estado.hechos.tarea).toBe(true)
    expect(estado.siguiente).toBe('alumno')
    expect(estado.completo).toBe(false)
  })

  it('mientras espera al alumno puede ir armando la tarea, pero sólo si todavía no armó ninguna', () => {
    expect(con({ materias: 1, temas: 12 }).puedeAdelantarLaTarea).toBe(true)
    expect(con({ materias: 1, temas: 12, tareasArmadas: 1 }).puedeAdelantarLaTarea).toBe(false)
    expect(con({ materias: 1 }).puedeAdelantarLaTarea).toBe(false)
  })

  it('si borra su única materia, los hitos se desmarcan solos', () => {
    const estado = con({ materias: 0, temas: 12, alumnos: 2, tareasMandadas: 1 })
    expect(estado.hechos.materia).toBe(false)
    expect(estado.hechos.temario).toBe(false)
    expect(estado.siguiente).toBe('materia')
  })
})

describe('contarTemas', () => {
  it('suma los temas de todas las unidades', () => {
    expect(contarTemas([{ topics: [{}, {}] }, { topics: [{}] }])).toBe(3)
  })

  it('una unidad sin temas no suma ni rompe', () => {
    expect(contarTemas([{ name: 'Unidad 1' }, { topics: [] }, { topics: null }])).toBe(0)
  })

  it('aguanta un JSONB con otra forma', () => {
    expect(contarTemas(null)).toBe(0)
    expect(contarTemas('[]')).toBe(0)
    expect(contarTemas({ topics: [{}] })).toBe(0)
    expect(contarTemas([null, 3, 'x'])).toBe(0)
  })
})
