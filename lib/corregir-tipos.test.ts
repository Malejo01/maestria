import { describe, expect, it } from 'vitest'
import {
  aplicarPropuestas,
  contarMarcadas,
  correccionPorRegla,
  objetivoDe,
  preguntasMarcadas,
  promptDeReescritura,
  verificarReescritura,
  type PropuestaDeCorreccion,
} from './corregir-tipos'
import type { Question } from './types'

/** Casos reales del 20/11 (producción, `scripts/qa/tipos-incoherentes.ts`). */
const siNo: Question = {
  id: 'q1',
  type: 'true_false',
  topic: 'divisibilidad',
  topicName: 'Divisibilidad',
  question: 'Aplicando el criterio de divisibilidad, ¿es el número 1.242 divisible por 9?',
  correctAnswer: true,
  explanation: '1 + 2 + 4 + 2 = 9, que es múltiplo de 9.',
}

const abierta: Question = {
  id: 'q2',
  type: 'true_false',
  topic: 'inecuaciones',
  topicName: 'Inecuaciones',
  question: 'Al multiplicar ambos miembros de una inecuación por un número negativo, ¿qué sucede con el sentido de la desigualdad?',
  correctAnswer: true,
  explanation: 'El sentido de la desigualdad se invierte.',
}

const comoValor: Question = {
  id: 'q3',
  type: 'short_answer',
  topic: 'inecuaciones',
  topicName: 'Inecuaciones',
  question: 'Determiná el valor de x que satisface 3x + 4 ≤ 10.',
  acceptedAnswers: ['x <= 2'],
  explanation: '3x ≤ 6, x ≤ 2.',
}

const bien: Question = {
  id: 'q4',
  type: 'true_false',
  topic: 'divisibilidad',
  topicName: 'Divisibilidad',
  question: 'El número 1.242 es divisible por 9.',
  correctAnswer: true,
  explanation: '',
}

describe('N2 · qué está marcado', () => {
  it('cuenta lo mismo que el aviso de Revisar y editar', () => {
    expect(preguntasMarcadas([bien, siNo, abierta, comoValor])).toEqual([
      { indice: 1, problema: 'vf-pregunta-si-no' },
      { indice: 2, problema: 'vf-pregunta-abierta' },
      { indice: 3, problema: 'inecuacion-como-valor' },
    ])
    expect(contarMarcadas([bien])).toBe(0)
    expect(contarMarcadas(null)).toBe(0)
  })

  it('a qué se convierte cada problema', () => {
    expect(objetivoDe('vf-pregunta-si-no')).toBe('afirmacion')
    expect(objetivoDe('vf-pregunta-abierta')).toBe('opcion_multiple')
    expect(objetivoDe('numerica-conceptual')).toBe('opcion_multiple')
    expect(objetivoDe('inecuacion-como-valor')).toBeNull()
  })

  it('la regla arregla sola el conjunto solución, sin IA; el sí/no en orden verbo-sujeto no', () => {
    const arreglada = correccionPorRegla(comoValor)
    expect(arreglada?.question).toBe('Determiná el conjunto solución de 3x + 4 ≤ 10.')
    expect(arreglada?.type === 'short_answer' && arreglada.acceptedAnswers).toContain('(-∞; 2]')
    expect(correccionPorRegla(siNo)).toBeNull()
  })

  it('el pedido al modelo dice el valor de verdad que hay que conservar', () => {
    expect(promptDeReescritura(siNo, 'afirmacion')).toContain('tiene que ser VERDADERA')
    expect(promptDeReescritura(siNo, 'afirmacion')).toContain('divisibilidad')
  })
})

describe('N2 · verificar lo que devuelve el modelo', () => {
  it('sí/no → afirmación con el mismo valor de verdad', () => {
    const v = verificarReescritura(siNo, 'afirmacion', {
      afirmacion: 'El número 1.242 es divisible por 9.',
      valorDeVerdad: true,
      topic: 'divisibilidad',
    })
    expect(v).toEqual({ ok: true, pregunta: { ...siNo, question: 'El número 1.242 es divisible por 9.', origin: 'ai_regenerada' } })
  })

  it('una respuesta que cambia el valor de verdad se rechaza', () => {
    const v = verificarReescritura(siNo, 'afirmacion', {
      afirmacion: 'El número 1.242 no es divisible por 9.',
      valorDeVerdad: false,
      topic: 'divisibilidad',
    })
    expect(v.ok).toBe(false)
    expect(!v.ok && v.motivo).toMatch(/valor de verdad/)
  })

  it('cambiar el tema o seguir siendo una pregunta también se rechaza', () => {
    expect(verificarReescritura(siNo, 'afirmacion', { afirmacion: 'El 1.242 es divisible por 9.', valorDeVerdad: true, topic: 'otro' }).ok).toBe(false)
    expect(verificarReescritura(siNo, 'afirmacion', { afirmacion: '¿Es 1.242 divisible por 9?', valorDeVerdad: true, topic: 'divisibilidad' }).ok).toBe(false)
    expect(verificarReescritura(siNo, 'afirmacion', { nada: 1 }).ok).toBe(false)
  })

  it('abierta → opción múltiple con 4 opciones y la correcta', () => {
    const v = verificarReescritura(abierta, 'opcion_multiple', {
      question: 'Al multiplicar ambos miembros de una inecuación por un número negativo, ¿qué pasa con el sentido de la desigualdad?',
      options: ['Se invierte', 'Se mantiene', 'Pasa a ser una igualdad', 'Depende del número'],
      correctAnswer: 0,
      explanation: 'El sentido de la desigualdad se invierte.',
      topic: 'inecuaciones',
    })
    expect(v.ok).toBe(true)
    expect(v.ok && v.pregunta).toMatchObject({ id: 'q2', type: 'multiple_choice', correctAnswer: 0, topicName: 'Inecuaciones' })
  })

  it('opción múltiple sin 4 opciones distintas, o con la correcta fuera de rango, se rechaza', () => {
    const base = { question: '¿Qué pasa con el sentido?', explanation: '', topic: 'inecuaciones' }
    expect(verificarReescritura(abierta, 'opcion_multiple', { ...base, options: ['a', 'b', 'c'], correctAnswer: 0 }).ok).toBe(false)
    expect(verificarReescritura(abierta, 'opcion_multiple', { ...base, options: ['a', 'b', 'c', 'A'], correctAnswer: 0 }).ok).toBe(false)
    expect(verificarReescritura(abierta, 'opcion_multiple', { ...base, options: ['a', 'b', 'c', 'd'], correctAnswer: 4 }).ok).toBe(false)
  })
})

describe('N2 · aplicar lo elegido', () => {
  it('sólo las tildadas y con "después"; no muta la entrada', () => {
    const preguntas = [bien, siNo, abierta]
    const corregida = { ...siNo, question: 'El número 1.242 es divisible por 9.' } as Question
    const propuestas: PropuestaDeCorreccion[] = [
      { indice: 1, problema: 'vf-pregunta-si-no', antes: siNo, despues: corregida, via: 'ia' },
      { indice: 2, problema: 'vf-pregunta-abierta', antes: abierta, despues: null, via: 'ia', motivo: 'x' },
    ]
    expect(aplicarPropuestas(preguntas, propuestas, new Set([1, 2]))).toEqual([bien, corregida, abierta])
    expect(aplicarPropuestas(preguntas, propuestas, new Set())).toEqual(preguntas)
    expect(preguntas[1]).toBe(siNo)
  })
})
