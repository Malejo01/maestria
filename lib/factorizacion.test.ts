import { describe, expect, it } from 'vitest'
import {
  CONSIGNA_DE_FACTORIZACION,
  corregirFactorizacion,
  esFactorizacion,
  factorizacionEnLatex,
  leerProducto,
  productoEscrito,
} from './factorizacion'
import { corregirNumerica } from './fraccion'

describe('L3 · leerProducto', () => {
  it.each(['2x2x3x5', '2.2.3.5', '2^2*3*5', '2²·3·5', '5·3·2^2', '2 2 3 5', '2×2×3×5', '2**2·3·5', '(2^2)(3)(5)', '2^(2)·3·5', '$2^{2} \\cdot 3 \\cdot 5$'])(
    '%s da 60',
    (texto) => {
      expect(leerProducto(texto)?.valor).toBe(60)
    },
  )

  it('conserva los factores como se escribieron', () => {
    expect(leerProducto('5·3·2^2')?.factores).toEqual([
      { base: 5, exponente: 1 },
      { base: 3, exponente: 1 },
      { base: 2, exponente: 2 },
    ])
    expect(leerProducto('(2·3)^2')?.factores).toEqual([
      { base: 2, exponente: 2 },
      { base: 3, exponente: 2 },
    ])
  })

  it('un número solo es un producto de un factor', () => {
    expect(leerProducto('60')).toEqual({ factores: [{ base: 60, exponente: 1 }], valor: 60 })
  })

  it.each(['', 'sesenta', '2··3', '2^', '2·', '(2·3', '2,5·3', '2^x'])('%s no es un producto', (texto) => {
    expect(leerProducto(texto)).toBeNull()
  })
})

describe('L3 · corregir una factorización de 60', () => {
  it.each(['2x2x3x5', '2.2.3.5', '2^2*3*5', '2²·3·5', '5·3·2^2'])('%s está bien', (texto) => {
    expect(corregirFactorizacion(texto, 60)).toEqual({ correcta: true })
  })

  it('4·15: hay un factor que no es primo', () => {
    expect(corregirFactorizacion('4·15', 60)).toEqual({ correcta: false, motivo: 'no_primo' })
  })

  it('2·3·5: el producto no da 60', () => {
    expect(corregirFactorizacion('2·3·5', 60)).toEqual({ correcta: false, motivo: 'producto_distinto' })
  })

  it('60: escribió el número, no la factorización', () => {
    expect(corregirFactorizacion('60', 60)).toEqual({ correcta: false, motivo: 'sin_factorizar' })
  })

  it('una sola potencia de un primo sí es factorización (8 = 2^3)', () => {
    expect(corregirFactorizacion('2^3', 8)).toEqual({ correcta: true })
  })

  it('el 1 no es primo', () => {
    expect(corregirFactorizacion('1·2^2·3·5', 60)).toEqual({ correcta: false, motivo: 'no_primo' })
  })
})

describe('L3 · qué preguntas son factorizaciones', () => {
  it.each([
    'Realizá la factorización en números primos del número 120 y expresala como producto de potencias.',
    'Descomponé 84 en factores primos.',
    'Descomposición en primos de 90',
    'Escribí 72 como producto de potencias de primos.',
    'Expresá 30 como producto de primos.',
    'Escribí 45 como producto de factores primos.',
  ])('la consigna "%s"', (consigna) => {
    expect(CONSIGNA_DE_FACTORIZACION.test(consigna)).toBe(true)
  })

  it.each(['Calculá 2^3 · 5', '¿Cuál es el MCD entre 12 y 18?', 'Calculá el producto de 4 y 15.'])('no: "%s"', (consigna) => {
    expect(CONSIGNA_DE_FACTORIZACION.test(consigna)).toBe(false)
  })

  it('con forma manda la forma; sin forma, el enunciado', () => {
    expect(esFactorizacion({ forma: 'factorizacion', question: 'Calculá 60' })).toBe(true)
    expect(esFactorizacion({ question: 'Descomponé 60 en factores primos.' })).toBe(true)
    expect(esFactorizacion({ question: 'Calculá 3·20' })).toBe(false)
  })
})

describe('L3 · la pregunta 8 del cuestionario 32 de producción, tal cual está guardada', () => {
  // Así quedó en teacher_quizzes.questions: `numeric`, sin `forma`, y la
  // respuesta es el número mismo. Antes no se podía responder bien.
  const pregunta8 = {
    id: 'q8',
    type: 'numeric' as const,
    question: 'Realizá la factorización en números primos del número 120 y expresala como producto de potencias.',
    correctAnswer: 120,
    topicName: 'Números naturales',
    explanation: '',
  }

  it('se corrige como factorización', () => {
    expect(esFactorizacion(pregunta8)).toBe(true)
    expect(corregirNumerica(pregunta8, 120, '2^3·3·5').correcta).toBe(true)
    expect(corregirNumerica(pregunta8, 120, '2x2x2x3x5').correcta).toBe(true)
    expect(corregirNumerica(pregunta8, 120, '120')).toEqual({ correcta: false, motivo: 'sin_factorizar' })
    expect(corregirNumerica(pregunta8, 120, '8·15')).toEqual({ correcta: false, motivo: 'no_primo' })
  })

  it('la correcta se muestra como producto de potencias', () => {
    expect(factorizacionEnLatex(120)).toBe('$2^{3} \\cdot 3 \\cdot 5$')
    expect(factorizacionEnLatex(60)).toBe('$2^{2} \\cdot 3 \\cdot 5$')
  })

  it('lo que escribió el alumno se muestra prolijo', async () => {
    expect(productoEscrito('2x2x3x5')).toBe('$2 \\cdot 2 \\cdot 3 \\cdot 5$')
    const { respuestaEscrita } = await import('./numeros')
    expect(respuestaEscrita(60, '2.2.3.5')).toBe('$2 \\cdot 2 \\cdot 3 \\cdot 5$')
    // Primero el número: `0.75` es 0,75, no 0·75.
    expect(respuestaEscrita(0.75, '0.75')).toBe('0,75')
  })
})

describe('L3 · generación y exportación', () => {
  it('una numérica que pide factorizar queda con forma, y correctAnswer es el número', async () => {
    const { normalizarFraccionGenerada } = await import('./fraccion')
    const generada = normalizarFraccionGenerada({ question: 'Descomponé 60 en factores primos.', correctAnswer: 60 })
    expect(generada).toMatchObject({ forma: 'factorizacion', correctAnswer: 60 })
    const otra = normalizarFraccionGenerada({ question: 'Calculá 3·20', correctAnswer: 60 })
    expect('forma' in otra).toBe(false)
  })

  it('a Moodle va como respuesta corta con las formas del producto', async () => {
    const { convertQuizToGift } = await import('./moodle-export')
    const gift = convertQuizToGift({
      id: 1,
      userId: 'd',
      teacherProgramId: 1,
      title: 'T',
      subjectName: 'Matemática',
      mode: 'practico',
      status: 'saved',
      selectedTopics: [],
      questionCount: 1,
      questions: [{ id: 'q', type: 'numeric', topic: 't', question: 'Descomponé 60 en factores primos.', correctAnswer: 60, forma: 'factorizacion', topicName: 'Primos', explanation: '' }],
      createdAt: '',
      updatedAt: '',
    })
    expect(gift).toContain('=2^2*3*5')
    expect(gift).toContain('=2x2x3x5')
    expect(gift).not.toContain('{#60')
  })
})
