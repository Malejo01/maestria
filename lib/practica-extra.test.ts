import { describe, expect, it } from 'vitest'
import {
  configDeLaTarea,
  consignasDe,
  estadoDePracticaExtra,
  muestraLaPracticaExtra,
  resumenDePracticasExtra,
  TOPE_PRACTICAS_EXTRA,
  tiposDeLaTarea,
} from './practica-extra'

/** P4 · "Practicar otra vez con preguntas nuevas" (puro). */
const BASE = { hayMigracion: true, esDelAlumno: true, esDiagnostico: false, planVencido: false, hechasHoy: 0 }

describe('el botón', () => {
  it('disponible, con lo que queda del día', () => {
    expect(estadoDePracticaExtra(BASE)).toEqual({ disponible: true, motivo: null, restantes: 3 })
    expect(estadoDePracticaExtra({ ...BASE, hechasHoy: 2 })).toEqual({ disponible: true, motivo: null, restantes: 1 })
  })

  it('el tope: 3 por alumno, por tarea y por día; en lugar del botón, el texto', () => {
    expect(TOPE_PRACTICAS_EXTRA).toBe(3)
    const tope = estadoDePracticaExtra({ ...BASE, hechasHoy: 3 })
    expect(tope).toEqual({ disponible: false, motivo: 'tope', restantes: 0 })
    expect(muestraLaPracticaExtra(tope)).toBe(true)
  })

  it('no aparece con el plan del docente vencido, en un diagnóstico, en una tarea ajena o sin la 036', () => {
    for (const cambio of [{ planVencido: true }, { esDiagnostico: true }, { esDelAlumno: false }, { hayMigracion: false }]) {
      const estado = estadoDePracticaExtra({ ...BASE, ...cambio })
      expect(estado.disponible).toBe(false)
      expect(muestraLaPracticaExtra(estado)).toBe(false)
    }
    expect(muestraLaPracticaExtra(null)).toBe(false)
  })
})

describe('la misma configuración que la tarea', () => {
  const tarea = {
    subjectName: 'Análisis Matemático I',
    mode: 'practico',
    questionCount: 10,
    selectedTopics: [{ id: 'u1-t1', name: 'Límites' }, { id: 'u1-t2', name: 'Continuidad' }],
    questions: [{ type: 'numeric', question: '¿Cuánto vale lím x→2 de x²?' }, { question: 'Elegí la opción.' }, { type: 'true_false', question: 'f es continua.' }],
    pedagogyContext: 'Nivel: Superior | Carrera: Análisis de Sistemas',
  }

  it('temas, modo, cantidad (las preguntas que tiene), tipos y la materia del grupo', () => {
    expect(configDeLaTarea(tarea, { id: 7, nivel: 'Superior', grado: '1er Año', carrera: 'Análisis de Sistemas' })).toEqual({
      subject: 'Análisis Matemático I',
      subjectName: 'Análisis Matemático I',
      topics: [{ id: 'u1-t1', name: 'Límites' }, { id: 'u1-t2', name: 'Continuidad' }],
      mode: 'practico',
      questionCount: 3,
      questionTypes: ['numeric', 'multiple_choice', 'true_false'],
      nivel: 'Superior',
      grado: '1er Año',
      carrera: 'Análisis de Sistemas',
      pedagogyContext: 'Nivel: Superior | Carrera: Análisis de Sistemas',
      teacherProgramId: 7,
    })
  })

  it('"No aplica" no es carrera; sin nivel no va el año', () => {
    const c = configDeLaTarea(tarea, { id: 7, nivel: null, grado: '1er Año', carrera: 'No aplica' })
    expect(c).not.toHaveProperty('carrera')
    expect(c).not.toHaveProperty('nivel')
    expect(c).not.toHaveProperty('grado')
  })

  it('las consignas de la tarea van a la dedup para no repetirlas', () => {
    expect(consignasDe(tarea.questions)).toEqual([
      { question: '¿Cuánto vale lím x→2 de x²?' },
      { question: 'Elegí la opción.' },
      { question: 'f es continua.' },
    ])
  })
})

describe('Prácticas extra en el informe', () => {
  it('cantidad y promedio', () => {
    expect(resumenDePracticasExtra([])).toEqual({ cantidad: 0, promedio: null })
    expect(resumenDePracticasExtra([6, 7.5, 9])).toEqual({ cantidad: 3, promedio: 7.5 })
  })
})

describe('W5 · la práctica extra no repite ensayos', () => {
  it('saca el ensayo de los tipos de la tarea', () => {
    expect(tiposDeLaTarea([{ type: 'essay' }, { type: 'true_false' }])).toEqual(['true_false'])
    expect(tiposDeLaTarea([{ type: 'essay' }])).toEqual(['multiple_choice'])
  })
})
