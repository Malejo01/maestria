import { describe, expect, it } from 'vitest'
import { limpiarPista, pistaPermitida, pistaRevelaLaRespuesta } from './pista'
import type { Question } from './types'

const base = { id: 'q1', topic: 't', topicName: 'Tema', explanation: '' }

describe('pistaPermitida', () => {
  it('sí en la práctica libre, la práctica extra y la práctica del día', () => {
    expect(pistaPermitida(undefined)).toBe(true)
    expect(pistaPermitida({})).toBe(true)
    expect(pistaPermitida({ practicaExtraId: 3, practicaDeTarea: 9 })).toBe(true)
    expect(pistaPermitida({ autodidacta: { tipo: 'practica' } })).toBe(true)
  })
  it('nunca en tareas, diagnósticos, simulacros ni en la vista previa', () => {
    expect(pistaPermitida({ assignmentId: 1 })).toBe(false)
    expect(pistaPermitida({ devolucion: 'al_final' })).toBe(false)
    expect(pistaPermitida({ limiteMinutos: 40 })).toBe(false)
    expect(pistaPermitida({ autodidacta: { tipo: 'diagnostico' } })).toBe(false)
    expect(pistaPermitida({ autodidacta: { tipo: 'simulacro' } })).toBe(false)
    expect(pistaPermitida({ previewOnly: true })).toBe(false)
  })
})

describe('pistaRevelaLaRespuesta', () => {
  const mc = { ...base, type: 'multiple_choice', question: '¿Qué tipo de texto busca convencer?', options: ['Argumentativo', 'Narrativo', 'Descriptivo', 'Instructivo'], correctAnswer: 0 } as Question
  it('la opción correcta, con o sin tildes ni mayúsculas', () => {
    expect(pistaRevelaLaRespuesta('Pensá en el texto ARGUMENTATIVO.', mc)).toBe(true)
    expect(pistaRevelaLaRespuesta('Pensá en qué busca el autor: ¿contar, describir o convencer?', mc)).toBe(false)
  })
  const num = { ...base, type: 'numeric', question: '¿Cuánto es 12 × 3?', correctAnswer: 36 } as Question
  it('el número de la numérica, salvo que ya esté en el enunciado', () => {
    expect(pistaRevelaLaRespuesta('Da 36.', num)).toBe(true)
    expect(pistaRevelaLaRespuesta('Podés pensarlo como 12 + 12 + 12.', num)).toBe(false)
    expect(pistaRevelaLaRespuesta('Es 36,0', num)).toBe(true)
  })
  it('una respuesta corta numérica se mira como número', () => {
    const corta = { ...base, type: 'short_answer', question: 'Resolvé 2x = 8', acceptedAnswers: ['4', 'x = 4'] } as Question
    expect(pistaRevelaLaRespuesta('Dividí los dos lados por 2.', corta)).toBe(false)
    expect(pistaRevelaLaRespuesta('x vale 4.', corta)).toBe(true)
  })
  it('verdadero o falso dicho de frente', () => {
    const vf = { ...base, type: 'true_false', question: 'El sol es una estrella.', correctAnswer: true } as Question
    expect(pistaRevelaLaRespuesta('La afirmación es verdadera.', vf)).toBe(true)
    expect(pistaRevelaLaRespuesta('Pensá en qué produce luz propia.', vf)).toBe(false)
  })
})

describe('limpiarPista', () => {
  it('saca el markdown y pone tope', () => {
    expect(limpiarPista('**Ojo**  con\nel signo')).toBe('Ojo con el signo')
    expect(limpiarPista('a'.repeat(500))).toHaveLength(280)
    expect(limpiarPista('Usá la tabla del ocho. 🔢')).toBe('Usá la tabla del ocho.')
  })
})
