import { describe, expect, it } from 'vitest'
import { comoLlegaAMoodle, marcarEscapes, validarGift } from './gift-validar'
import { convertQuizToGift, MAX_TRAMO_DE_CATEGORIA } from './moodle-export'
import type { Question, TeacherQuiz } from './types'

/**
 * M5. Lo que exporta lib/moodle-export.ts se tiene que importar en Moodle sin
 * tocarlo. El 20/11 fueron 27 errores sobre 30 preguntas.
 */

const temasLargos = Array.from({ length: 30 }, (_, i) => ({
  id: `t${i}`,
  name: `Funciones reales de variable real: dominio, imagen, ceros, positividad y negatividad, tema ${i + 1}`,
}))

function quiz(questions: Question[], extra: Partial<TeacherQuiz> = {}): TeacherQuiz {
  return {
    id: 1,
    userId: 'u',
    teacherProgramId: 1,
    title: 'Matemática - Mixto - 20/11/2026',
    subjectName: 'Matemática 1 Virtual - Análisis de Sistemas',
    mode: 'mixto',
    status: 'saved',
    selectedTopics: temasLargos,
    questionCount: questions.length,
    questions,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    ...extra,
  }
}

/** Una de cada tipo, con lo que rompió el 20/11. */
const muestra: Question[] = [
  {
    id: 'q1',
    type: 'true_false',
    topic: 't1',
    topicName: 'Inecuaciones',
    question: 'Si multiplicamos ambos miembros de una inecuación por un número negativo, el sentido de la desigualdad se invierte.',
    correctAnswer: true,
    explanation: 'Por ejemplo, $2 < 3$ pero $-2 > -3$: el sentido cambia.',
  },
  {
    id: 'q2',
    type: 'multiple_choice',
    topic: 't2',
    topicName: 'Ecuaciones',
    question: '¿Cuál es el conjunto solución de $x^2 = 16$?',
    options: ['$\\{4\\}$', '$\\{-4, 4\\}$', '$\\{16\\}$', '$\\emptyset$'],
    correctAnswer: 1,
    explanation: 'Las dos raíces: $\\{-4, 4\\}$.',
  },
  {
    id: 'q3',
    type: 'short_answer',
    topic: 't3',
    topicName: 'Dominio',
    question: '¿Cuál es el dominio de $f(x) = \\frac{1}{x - 2}$?',
    acceptedAnswers: ['$\\mathbb{R} - \\{2\\}$', 'R - {2}', 'x ≠ 2'],
    explanation: 'Se excluye el $2$, que anula el denominador: $\\mathbb{R} - \\{2\\}$.',
  },
  {
    id: 'q4',
    type: 'numeric',
    topic: 't4',
    topicName: 'Funciones',
    question: 'Calculá $f(3)$ si $f(x) = x^2 - 5$.',
    correctAnswer: 4,
    explanation: '$3^2 - 5 = 4$.',
  },
  {
    id: 'q5',
    type: 'numeric',
    topic: 't5',
    topicName: 'Divisibilidad',
    question: 'Descomponé 60 en factores primos.',
    correctAnswer: 60,
    forma: 'factorizacion',
    explanation: '$60 = 2^2 \\cdot 3 \\cdot 5$.',
  },
  {
    id: 'q6',
    type: 'multiple_choice',
    topic: 't6',
    topicName: 'Lógica',
    question: '¿Cuál es la negación de $p \\wedge q$? ¿Y si $a \\neq b$?',
    options: ['$\\neg p \\vee \\neg q$', '$\\neg p \\wedge \\neg q$', '$p \\vee q$', '$\\neg (p \\vee q)$'],
    correctAnswer: 0,
    explanation: 'Por De Morgan.\n\nSe niega cada una y se cambia el conectivo.',
  },
]

describe('el validador reconoce los errores del 20/11', () => {
  it('retroalimentación después de la llave', () => {
    const errores = validarGift('::Q1::El límite existe. {TRUE}\n#### No siempre.')
    expect(errores).toHaveLength(1)
    expect(errores[0].mensaje).toMatch(/texto después de "\}"/)
  })

  it('un tramo de categoría de más de 255 caracteres', () => {
    expect(validarGift(`$CATEGORY: $course$/Mat/${'a'.repeat(300)}\n\n::Q1::Bien. {TRUE}`)).toEqual([
      { donde: 'categoría', mensaje: 'un tramo tiene 300 caracteres; Moodle admite 255' },
    ])
  })

  it('dos respuestas correctas en opción múltiple, y llaves de más', () => {
    expect(validarGift('::Q1::¿Cuál? {\n=a\n=b\n~c\n}')[0].mensaje).toMatch(/2 respuestas correctas/)
    expect(validarGift('::Q1::Usa {a,b} acá {TRUE}')[0].mensaje).toMatch(/2 llaves/)
  })

  it('LaTeX con llaves desbalanceadas', () => {
    expect(validarGift('::Q1::Calculá \\(\\frac\\{1\\}\\{2\\) {#1}')[0].mensaje).toMatch(/desbalanceadas/)
  })

  it('los escapes se resuelven como en Moodle', () => {
    expect(comoLlegaAMoodle(marcarEscapes('\\\\\\{4\\\\\\}'))).toBe('\\{4\\}')
    expect(comoLlegaAMoodle(marcarEscapes('\\\\neq'))).toBe('\\neq')
    expect(comoLlegaAMoodle(marcarEscapes('\\frac\\{1\\}\\{2\\}'))).toBe('\\frac{1}{2}')
  })
})

describe('el cuestionario de muestra se exporta con 0 errores', () => {
  const gift = convertQuizToGift(quiz(muestra))

  it('el validador no encuentra nada', () => {
    expect(validarGift(gift)).toEqual([])
  })

  it('la retroalimentación queda adentro de las llaves en todos los tipos', () => {
    expect(gift).toContain('{TRUE####Por ejemplo')
    expect(gift).toContain('{#4####')
    expect(gift).toMatch(/\{=2\^2\*3\*5[^}]*####/)
    expect(gift).toMatch(/=x ≠ 2####Se excluye/)
  })

  it('las llaves de conjunto llegan como \\{ y las de agrupación como {', () => {
    const bloque = gift.split('\n\n').find((b) => b.startsWith('::Q3::'))!
    const llega = comoLlegaAMoodle(marcarEscapes(bloque))
    expect(llega).toContain('\\mathbb{R} - \\{2\\}')
    expect(llega).toContain('\\frac{1}{x - 2}')
    const q2 = comoLlegaAMoodle(marcarEscapes(gift.split('\n\n').find((b) => b.startsWith('::Q2::'))!))
    expect(q2).toContain('\\(\\{-4, 4\\}\\)')
  })

  it('\\neq no se vuelve un salto de línea, y la lógica sigue en Unicode', () => {
    const q6 = comoLlegaAMoodle(marcarEscapes(gift.split('\n\n').find((b) => b.startsWith('::Q6::'))!))
    expect(q6).toContain('a \\neq b')
    expect(q6).toContain('¬p ∨ ¬q')
  })

  it('una línea en blanco de la explicación no parte la pregunta', () => {
    expect((gift.match(/::Q\d+::/g) ?? []).length).toBe(6)
    expect(validarGift(gift).filter((e) => e.donde.startsWith('pregunta'))).toEqual([])
  })

  it('con 30 temas largos, la categoría queda en "Varios temas" y ningún tramo pasa de 120', () => {
    const categoria = gift.split('\n')[0]
    expect(categoria).toBe('$CATEGORY: $course$/Matematica 1 Virtual - Analisis de Sistemas/Varios temas')
    for (const tramo of categoria.replace('$CATEGORY: ', '').split('/')) expect(tramo.length).toBeLessThanOrEqual(MAX_TRAMO_DE_CATEGORIA)
  })

  it('un solo tema largo se corta en palabra', () => {
    const uno = convertQuizToGift(quiz(muestra, { selectedTopics: [{ id: 'x', name: 'palabra '.repeat(40) }] }))
    const tramo = uno.split('\n')[0].split('/').at(-1)!
    expect(tramo.length).toBeLessThanOrEqual(MAX_TRAMO_DE_CATEGORIA)
    expect(tramo.endsWith('palabra')).toBe(true)
  })
})

describe('U5 · lo que el validador marcaba de más', () => {
  it('varias correctas con pesos que suman 100 es GIFT válido', () => {
    expect(validarGift('::Q1::¿Cuáles? {\n~%50%a\n~%50%b\n~%-100%c\n}')).toEqual([])
    expect(validarGift('::Q1::¿Cuáles? {\n~%50%a\n~%40%b\n~%-100%c\n}')[0]?.mensaje).toMatch(/suman 90/)
  })
  it('la palabra faltante lleva texto después de la llave', () => {
    expect(validarGift('::Q1::La fórmula empieza con {=\\= ~\\#}.')).toEqual([])
  })
  it('la retroalimentación afuera de las llaves sigue siendo un error (lo del 20/11)', () => {
    expect(validarGift('::Q1::¿Es así? {TRUE} ####porque sí')).not.toEqual([])
  })
})
