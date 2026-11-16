import { describe, expect, it } from 'vitest'
import { entradaActiva, inicioDe, resolverCaparazon } from './navegacion'

const visitante = null
const invitado = { rol: 'ALUMNO' as const, esInvitado: true }
const alumno = { rol: 'ALUMNO' as const, esInvitado: false }
const docente = { rol: 'DOCENTE' as const, esInvitado: false }

const etiquetas = (quien: Parameters<typeof resolverCaparazon>[0], pathname: string) =>
  resolverCaparazon(quien, pathname).entradas.map((entrada) => entrada.etiqueta)

describe('resolverCaparazon — cada quien ve su navegación y nada más', () => {
  it('el visitante no tiene navegación', () => {
    expect(resolverCaparazon(visitante, '/aulas')).toEqual({ contexto: 'visitante', entradas: [], vistaPrevia: false })
  })

  it('el invitado ve su grupo y nada más: sin pestañas, aunque su rol sea ALUMNO', () => {
    expect(resolverCaparazon(invitado, '/aulas')).toEqual({ contexto: 'invitado', entradas: [], vistaPrevia: false })
  })

  it('el alumno ve Mis tareas, Practicar y Mi progreso', () => {
    expect(etiquetas(alumno, '/aulas')).toEqual(['Mis tareas', 'Practicar', 'Mi progreso'])
  })

  it('el docente ve Mis alumnos, Mis materias y Mis tareas, con alumnos primero', () => {
    expect(etiquetas(docente, '/teacher')).toEqual(['Mis alumnos', 'Mis materias', 'Mis tareas'])
    expect(resolverCaparazon(docente, '/teacher/diagnostico').contexto).toBe('docente')
  })

  it('el docente NO ve la navegación de alumno en su panel', () => {
    expect(etiquetas(docente, '/teacher')).not.toContain('Practicar')
    expect(etiquetas(docente, '/teacher')).not.toContain('Mi progreso')
  })

  it('un docente en una pantalla de alumno está en vista previa: barra de alumno, rol intacto', () => {
    for (const ruta of ['/aulas', '/history', '/tips']) {
      const caparazon = resolverCaparazon(docente, ruta)
      expect(caparazon.contexto).toBe('alumno')
      expect(caparazon.vistaPrevia).toBe(true)
    }
  })

  it('un alumno nunca está en vista previa', () => {
    expect(resolverCaparazon(alumno, '/aulas').vistaPrevia).toBe(false)
    expect(resolverCaparazon(alumno, '/history').vistaPrevia).toBe(false)
  })

  it('las pantallas legales no sacan al docente de su barra', () => {
    expect(resolverCaparazon(docente, '/terminos')).toMatchObject({ contexto: 'docente', vistaPrevia: false })
    expect(resolverCaparazon(docente, '/privacidad')).toMatchObject({ contexto: 'docente', vistaPrevia: false })
  })

  it('/teacherx no es una ruta de docente: el prefijo se compara por segmento', () => {
    expect(resolverCaparazon(docente, '/teacherx').vistaPrevia).toBe(true)
  })
})

describe('entradaActiva', () => {
  it('sin ?seccion=, el inicio del docente es Mis alumnos', () => {
    expect(entradaActiva('docente', '/teacher', null)).toBe('alumnos')
  })

  it('la sección del docente la manda la URL', () => {
    expect(entradaActiva('docente', '/teacher', 'materias')).toBe('materias')
    expect(entradaActiva('docente', '/teacher', 'tareas')).toBe('tareas')
  })

  it('una sección desconocida cae en Mis alumnos en vez de no marcar nada', () => {
    expect(entradaActiva('docente', '/teacher', 'cualquiera')).toBe('alumnos')
  })

  it('el diagnóstico cuelga de Mis alumnos, diga lo que diga ?seccion=', () => {
    expect(entradaActiva('docente', '/teacher/diagnostico', 'tareas')).toBe('alumnos')
  })

  it('historial y tips son los dos "Mi progreso"', () => {
    expect(entradaActiva('alumno', '/history', null)).toBe('progreso')
    expect(entradaActiva('alumno', '/tips', null)).toBe('progreso')
  })

  it('marca Mis tareas y Practicar', () => {
    expect(entradaActiva('alumno', '/aulas', null)).toBe('tareas')
    expect(entradaActiva('alumno', '/practicar', null)).toBe('practicar')
  })

  it('en una pantalla legal no hay entrada activa', () => {
    expect(entradaActiva('docente', '/terminos', null)).toBeNull()
    expect(entradaActiva('alumno', '/privacidad', null)).toBeNull()
  })

  it('visitante e invitado no tienen entradas que marcar', () => {
    expect(entradaActiva('visitante', '/aulas', null)).toBeNull()
    expect(entradaActiva('invitado', '/aulas', null)).toBeNull()
  })
})

describe('inicioDe — a dónde va cada quien desde la raíz', () => {
  it('el visitante se queda en la entrada', () => {
    expect(inicioDe(visitante)).toBeNull()
  })

  it('el docente va a su panel, que abre en Mis alumnos', () => {
    expect(inicioDe(docente)).toBe('/teacher')
  })

  it('alumno e invitado van a Mis tareas', () => {
    expect(inicioDe(alumno)).toBe('/aulas')
    expect(inicioDe(invitado)).toBe('/aulas')
  })

  it('una cuenta sin rol se queda en la raíz, que le muestra la bienvenida', () => {
    expect(inicioDe({ rol: null, esInvitado: false })).toBeNull()
  })
})
