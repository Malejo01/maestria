import { describe, expect, it } from 'vitest'
import { renglonDelAlumno, resumenDeLaSemana, temaParaFrase, textoParaCopiar, type AlumnoDeLaSemana } from './esta-semana'

const alumno = (nombre: string, parcial: Partial<AlumnoDeLaSemana> = {}): AlumnoDeLaSemana => ({
  nombre,
  intentos: 0,
  ejercicios: 0,
  correctas: 0,
  calificadas: 0,
  temaMasFlojo: null,
  ...parcial,
})
const AHORA = new Date('2026-11-27T15:00:00')

describe('resumenDeLaSemana (AB5)', () => {
  it('sin alumnos: lo dice y no inventa nada', () => {
    const r = resumenDeLaSemana([])
    expect(r).toMatchObject({ total: 0, practicaron: 0, nadie: false })
    expect(r.frase).toBe('Todavía no tenés alumnos en tus grupos.')
    expect(textoParaCopiar(r, AHORA)).toBe('Esta semana en MaestrIA (del 20/11 al 27/11)\nTodavía no tenés alumnos en tus grupos.')
  })

  it('un alumno que practicó', () => {
    const r = resumenDeLaSemana([alumno('Juan Pérez', { intentos: 2, ejercicios: 12, correctas: 7, calificadas: 12, temaMasFlojo: 'Logaritmos: propiedades' })])
    expect(r.frase).toBe('Tu alumno practicó esta semana. A Juan le falta logaritmos.')
    expect(renglonDelAlumno(r.filas[0])).toBe('Juan: 12 ejercicios, 58 % bien. Le falta: logaritmos.')
  })

  it('un alumno que no practicó: nadie, y se ofrece reenviar el link', () => {
    const r = resumenDeLaSemana([alumno('Ana', { temaMasFlojo: 'Funciones' })])
    expect(r.nadie).toBe(true)
    expect(r.frase).toBe('Nadie practicó todavía. ¿Les reenviás el link?')
    expect(renglonDelAlumno(r.filas[0])).toBe('Ana: no practicó.')
  })

  it('un tema largo se corta sin dejar «….»', () => {
    const largo = 'Media aritmética, mediana y moda en datos agrupados y no agrupados con tablas de frecuencia'
    expect(temaParaFrase(largo).endsWith('…')).toBe(true)
    const r = resumenDeLaSemana([alumno('Ana', { intentos: 1, ejercicios: 3, temaMasFlojo: largo })])
    expect(r.frase).not.toMatch(/…\./)
    expect(renglonDelAlumno(r.filas[0])).not.toMatch(/…\./)
  })

  it('nombra a quien practicó y tiene un tema flojo antes que a quien no practicó', () => {
    const r = resumenDeLaSemana([
      alumno('Bruno', { temaMasFlojo: 'Fracciones' }),
      alumno('Sofía', { intentos: 2, ejercicios: 10, correctas: 2, calificadas: 10, temaMasFlojo: 'Ecuaciones' }),
    ])
    expect(r.frase).toBe('1 de tus 2 alumnos practicó esta semana. A Sofía le falta ecuaciones.')
  })

  it('varios, con alumnos sin intentos: «3 de tus 4» y nombra al de menor porcentaje con un tema flojo', () => {
    const r = resumenDeLaSemana([
      alumno('Juan', { intentos: 1, ejercicios: 5, correctas: 2, calificadas: 5, temaMasFlojo: 'Logaritmos' }),
      alumno('Ana', { intentos: 3, ejercicios: 20, correctas: 18, calificadas: 20, temaMasFlojo: 'Funciones' }),
      alumno('Pedro', { intentos: 1, ejercicios: 10, correctas: 10, calificadas: 10 }),
      alumno('Lucía'),
    ])
    expect(r.practicaron).toBe(3)
    expect(r.frase).toBe('3 de tus 4 alumnos practicaron esta semana. A Juan le falta logaritmos.')
    expect(textoParaCopiar(r, AHORA).split('\n')).toEqual([
      'Esta semana en MaestrIA (del 20/11 al 27/11)',
      '3 de tus 4 alumnos practicaron esta semana. A Juan le falta logaritmos.',
      '',
      'Juan: 5 ejercicios, 40 % bien. Le falta: logaritmos.',
      'Ana: 20 ejercicios, 90 % bien. Le falta: funciones.',
      'Pedro: 10 ejercicios, 100 % bien.',
      'Lucía: no practicó.',
    ])
  })

  it('el singular y el «todos» bien dichos', () => {
    expect(resumenDeLaSemana([alumno('A', { intentos: 1, ejercicios: 1 }), alumno('B')]).frase).toBe('1 de tus 2 alumnos practicó esta semana.')
    expect(resumenDeLaSemana([alumno('A', { intentos: 1 }), alumno('B', { intentos: 2 })]).frase).toBe('Tus 2 alumnos practicaron esta semana.')
  })

  it('no inventa: sin respuestas corregidas no hay porcentaje; sin tema flojo no se nombra a nadie', () => {
    const r = resumenDeLaSemana([alumno('Sofía', { intentos: 1, ejercicios: 1, correctas: 0, calificadas: 0 })])
    expect(r.frase).toBe('Tu alumno practicó esta semana.')
    expect(renglonDelAlumno(r.filas[0])).toBe('Sofía: 1 ejercicio.')
    expect(textoParaCopiar(r, AHORA)).not.toMatch(/%|undefined|null|NaN/)
  })
})
