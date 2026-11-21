import { describe, expect, it } from 'vitest'
import { contextoDesdeElCuerpo, estadoDeReporte, numeroDePregunta, siguienteEstado, valoresDeEstado } from './reportes'
import { REPORTAR } from './textos'

describe('estados del buzón', () => {
  it('nuevo → visto → resuelto', () => {
    expect(siguienteEstado('nuevo')).toBe('visto')
    expect(siguienteEstado('visto')).toBe('resuelto')
    expect(siguienteEstado('resuelto')).toBe('resuelto')
  })

  it('lee los nombres de la 019 (revisado, descartado) y cualquier otra cosa como nuevo', () => {
    expect(estadoDeReporte('revisado')).toBe('visto')
    expect(estadoDeReporte('descartado')).toBe('resuelto')
    expect(estadoDeReporte('raro')).toBe('nuevo')
    expect(valoresDeEstado('visto')).toEqual(['visto', 'revisado'])
  })
})

describe('contexto del reporte', () => {
  it('sólo enteros válidos; el índice de pregunta puede ser 0', () => {
    expect(contextoDesdeElCuerpo({ teacherQuizId: 41, assignmentId: '7', classroomId: -1, questionIndex: 0 })).toEqual({
      teacherQuizId: 41,
      assignmentId: 7,
      classroomId: null,
      questionIndex: 0,
    })
    expect(contextoDesdeElCuerpo(null)).toEqual({ teacherQuizId: null, assignmentId: null, classroomId: null, questionIndex: null })
  })

  it('"Sobre la pregunta 3 de «…»"', () => {
    expect(numeroDePregunta(2)).toBe(3)
    expect(REPORTAR.sobreLaPregunta(3, 'Matemática - Mixto - 20/11/2026')).toBe('Sobre la pregunta 3 de «Matemática - Mixto - 20/11/2026»')
    expect(REPORTAR.sobreLaPregunta(1)).toBe('Sobre la pregunta 1 de este cuestionario')
  })
})
