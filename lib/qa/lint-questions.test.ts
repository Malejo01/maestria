import { describe, expect, it } from 'vitest'
import {
  countMathDelimiters,
  equivalentOptionPairs,
  isLatexOnly,
  lintQuestions,
  looksLikeProse,
  mathSegments,
} from './lint-questions'
import type { Question } from '@/lib/types'

const SUPERIOR = { nivel: 'Superior', grado: '1er Año', materia: 'Matemática' }
const PRIMARIO = { nivel: 'Primario', grado: '1er Año', materia: 'Matemática' }

function mc(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    topic: 't',
    topicName: 'Tema',
    question: '¿Cuánto es $2 + 2$?',
    explanation: 'Sumamos dos y dos.',
    type: 'multiple_choice',
    options: ['3', '4', '5', '6'],
    correctAnswer: 1,
    ...overrides,
  } as Question
}

describe('countMathDelimiters', () => {
  it('cuenta delimitadores reales e ignora los escapados', () => {
    expect(countMathDelimiters('$x$')).toBe(2)
    expect(countMathDelimiters('sin matemática')).toBe(0)
    expect(countMathDelimiters('cuesta \\$5')).toBe(0)
    expect(countMathDelimiters('$x$ y $y$')).toBe(4)
  })
})

describe('mathSegments', () => {
  it('extrae el contenido entre delimitadores', () => {
    expect(mathSegments('sea $x + 1$ y $y$')).toEqual(['x + 1', 'y'])
    expect(mathSegments('sin nada')).toEqual([])
  })
})

describe('looksLikeProse', () => {
  it('reconoce una oración metida en modo matemático', () => {
    expect(looksLikeProse('el resultado de la suma')).toBe(true)
  })

  it('no confunde matemática legítima con prosa', () => {
    expect(looksLikeProse('x + 1')).toBe(false)
    expect(looksLikeProse('\\frac{a}{b}')).toBe(false)
    expect(looksLikeProse('f(x) = 5x')).toBe(false)
    // Dos palabras no alcanzan: "sea x" es notación, no una oración.
    expect(looksLikeProse('sea x')).toBe(false)
  })
})

describe('isLatexOnly', () => {
  it('detecta respuestas que dependen de LaTeX para leerse', () => {
    expect(isLatexOnly('$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$')).toBe(true)
    expect(isLatexOnly('\\frac{7}{4}')).toBe(true)
    expect(isLatexOnly('El cociente de dos polinomios')).toBe(false)
    expect(isLatexOnly('1.75')).toBe(false)
  })
})

describe('lintQuestions — una pregunta sana no produce hallazgos', () => {
  it('queda en silencio', () => {
    expect(lintQuestions([mc()], SUPERIOR)).toEqual([])
  })
})

describe('lintQuestions — LaTeX y delimitadores', () => {
  it('marca delimitadores sin cerrar', () => {
    const findings = lintQuestions([mc({ question: '¿Cuál es el valor de $x + 1?' })], SUPERIOR)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ dimension: 'higiene_formato', severity: 'critical', source: 'lint' })
    expect(findings[0].justification).toContain('sin cerrar')
  })

  it('marca prosa envuelta en $...$', () => {
    const findings = lintQuestions([mc({ question: 'Calculá $el resultado de la suma$ pedido.' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('prosa dentro de'))).toBe(true)
  })

  it('marca un comando LaTeX que perdió la barra', () => {
    const findings = lintQuestions([mc({ question: 'Resolvé frac{7}{4} y explicá.' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('frac{'))).toBe(true)
  })

  it('no marca el comando cuando la barra está', () => {
    expect(lintQuestions([mc({ question: 'Resolvé $\\frac{7}{4}$ y explicá.' })], SUPERIOR)).toEqual([])
  })

  it('marca el fósil "eg" de un \\neg mal escapado', () => {
    const findings = lintQuestions([mc({ question: 'Si egp es verdadero, ¿qué vale p?' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('fósil "eg"'))).toBe(true)
  })

  it('no confunde palabras castellanas con operadores perdidos', () => {
    // "cap." de capítulo y "vengo" no deben disparar: la precisión del lint es
    // lo que sostiene el umbral de 0,9 sobre casos buenos.
    const findings = lintQuestions(
      [mc({ question: 'Según el cap. 3, ¿cuánto vale $x$?', explanation: 'Ver el capítulo.' })],
      SUPERIOR
    )
    expect(findings).toEqual([])
  })

  it('marca un operador lógico que perdió la barra', () => {
    const findings = lintQuestions([mc({ question: 'Evaluá p wedge q para p verdadero.' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('wedge'))).toBe(true)
  })
})

describe('lintQuestions — estructura de multiple_choice', () => {
  it('marca correctAnswer fuera de rango', () => {
    const findings = lintQuestions([mc({ correctAnswer: 7 } as Partial<Question>)], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('no apunta a ninguna opción'))).toBe(true)
  })

  it('marca opciones repetidas', () => {
    const findings = lintQuestions([mc({ options: ['4', '4', '5', '6'] } as Partial<Question>)], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('opciones repetidas'))).toBe(true)
  })

  it('marca la opción correcta delatada por su largo', () => {
    const findings = lintQuestions(
      [
        mc({
          options: [
            '4',
            'La suma de dos y dos da cuatro porque agregamos dos unidades a las dos que ya teníamos',
            '5',
            '6',
          ],
          correctAnswer: 1,
        } as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings.some((f) => f.dimension === 'calidad_distractores' && f.severity === 'minor')).toBe(true)
  })

  it('no marca largo desparejo cuando la diferencia es moderada', () => {
    const findings = lintQuestions(
      [mc({ options: ['cuatro', 'cuatro unidades', 'cinco', 'seis'], correctAnswer: 1 } as Partial<Question>)],
      SUPERIOR
    )
    expect(findings.filter((f) => f.dimension === 'calidad_distractores')).toEqual([])
  })

  it('marca opciones que exceden el tope de palabras del nivel', () => {
    // Primario 1er Año admite ~10 palabras por opción (education-context).
    const findings = lintQuestions(
      [
        mc({
          options: [
            'uno dos tres cuatro cinco seis siete ocho nueve diez once doce',
            'dos',
            'tres',
            'cuatro',
          ],
          correctAnswer: 1,
        } as Partial<Question>),
      ],
      PRIMARIO
    )
    expect(findings.some((f) => f.dimension === 'adecuacion_nivel' && f.justification.includes('palabras'))).toBe(true)
  })
})

describe('equivalentOptionPairs', () => {
  it('colapsa fracción y decimal al mismo valor', () => {
    expect(equivalentOptionPairs(['$\\frac{3}{4}$', '$\\sqrt{5}$', '$\\sqrt{16}$', '$0.75$'])).toEqual([[0, 3]])
  })

  it('no marca opciones que son números distintos', () => {
    expect(equivalentOptionPairs(['$\\frac{3}{4}$', '$0.5$', '$\\sqrt{7}$', '$2$'])).toEqual([])
  })

  it('ignora las opciones que no parsean como número', () => {
    expect(equivalentOptionPairs(['La parábola', 'La elipse', 'La hipérbola', 'La circunferencia'])).toEqual([])
  })

  it('tolera la diferencia de último bit entre formas del mismo número', () => {
    // 1/3 no es exactamente 0.3333333333, pero son la misma respuesta.
    expect(equivalentOptionPairs(['1/3', '0.3333333333333333', '2', '5'])).toEqual([[0, 1]])
  })

  it('encuentra más de un par cuando los hay', () => {
    expect(equivalentOptionPairs(['0.5', '1/2', '0.25', '1/4'])).toEqual([
      [0, 1],
      [2, 3],
    ])
  })
})

describe('lintQuestions — distractores equivalentes (casos reales del 10/08)', () => {
  it('marca major cuando el par duplicado son distractores (id 771)', () => {
    // "¿Cuál de los siguientes números es un número irracional?"
    // La correcta es $\sqrt{7}$; 3/4 y 0.75 son dos distractores idénticos.
    const findings = lintQuestions(
      [
        mc({
          question: '¿Cuál de los siguientes números es un número irracional?',
          options: ['$\\frac{3}{4}$', '$0.333...$', '$0.75$', '$\\sqrt{7}$'],
          correctAnswer: 3,
        } as Partial<Question>),
      ],
      SUPERIOR
    )

    const dup = findings.filter((f) => f.dimension === 'calidad_distractores')
    expect(dup).toHaveLength(1)
    expect(dup[0].severity).toBe('major')
    expect(dup[0].justification).toContain('descartar uno descarta el otro')
  })

  it('marca major cuando el par duplicado son distractores (id 1351)', () => {
    // "¿Cuál de los siguientes números es irracional?" — correcta $\sqrt{5}$.
    const findings = lintQuestions(
      [
        mc({
          question: '¿Cuál de los siguientes números es irracional?',
          options: ['$\\frac{3}{4}$', '$\\sqrt{5}$', '$\\sqrt{16}$', '$0.75$'],
          correctAnswer: 1,
        } as Partial<Question>),
      ],
      SUPERIOR
    )

    const dup = findings.filter((f) => f.dimension === 'calidad_distractores')
    expect(dup).toHaveLength(1)
    expect(dup[0].severity).toBe('major')
  })

  it('marca critical cuando el par duplicado toca la opción correcta', () => {
    // Rama SIN caso real en los datos del 10/08: cubierta sólo por este test.
    const findings = lintQuestions(
      [
        mc({
          question: '¿Cuánto vale la mitad de uno?',
          options: ['$0.5$', '$\\frac{1}{2}$', '$2$', '$3$'],
          correctAnswer: 0,
        } as Partial<Question>),
      ],
      SUPERIOR
    )

    const dup = findings.filter((f) => f.dimension === 'calidad_distractores')
    expect(dup).toHaveLength(1)
    expect(dup[0].severity).toBe('critical')
    expect(dup[0].justification).toContain('dos respuestas correctas')
  })

  it('no marca una pregunta de opciones no numéricas', () => {
    const findings = lintQuestions(
      [
        mc({
          question: '¿Qué cónica describe el conjunto de puntos equidistantes de un foco y una recta?',
          options: ['La parábola', 'La elipse', 'La hipérbola', 'La circunferencia'],
          correctAnswer: 0,
        } as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings.filter((f) => f.dimension === 'calidad_distractores')).toEqual([])
  })
})

describe('lintQuestions — short_answer', () => {
  it('marca acceptedAnswers enteramente en LaTeX (caso real id 1502)', () => {
    const findings = lintQuestions(
      [
        mc({
          type: 'short_answer',
          question: '¿Cómo se expresa $P(A|B)$?',
          acceptedAnswers: ['$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$'],
          options: undefined,
          correctAnswer: undefined,
        } as unknown as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings.some((f) => f.severity === 'critical' && f.justification.includes('LaTeX'))).toBe(true)
  })

  it('no marca cuando hay al menos una variante en texto plano', () => {
    const findings = lintQuestions(
      [
        mc({
          type: 'short_answer',
          question: '¿Cómo se expresa $P(A|B)$?',
          acceptedAnswers: ['$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$', 'P(A y B) / P(B)'],
          options: undefined,
          correctAnswer: undefined,
        } as unknown as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings).toEqual([])
  })

  it('marca un porcentaje cargado en una sola forma', () => {
    const findings = lintQuestions(
      [
        mc({
          type: 'short_answer',
          question: '¿Qué porcentaje representa?',
          acceptedAnswers: ['33%'],
          options: undefined,
          correctAnswer: undefined,
        } as unknown as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings.some((f) => f.justification.includes('forma decimal'))).toBe(true)
  })
})

describe('lintQuestions — numeric', () => {
  it('marca respuesta no entera sin tolerancia (las 255 del 10/08)', () => {
    const findings = lintQuestions(
      [
        mc({
          type: 'numeric',
          question: '¿Cuánto vale la excentricidad?',
          correctAnswer: 0.5,
          tolerance: undefined,
          options: undefined,
        } as unknown as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings.some((f) => f.severity === 'critical' && f.justification.includes('ingandable'))).toBe(true)
  })

  it('no marca una respuesta entera sin tolerancia: la igualdad exacta funciona', () => {
    const findings = lintQuestions(
      [
        mc({
          type: 'numeric',
          question: '¿Cuál es el radio?',
          correctAnswer: 6,
          tolerance: undefined,
          options: undefined,
        } as unknown as Partial<Question>),
      ],
      SUPERIOR
    )
    expect(findings).toEqual([])
  })
})

describe('lintQuestions — explicación', () => {
  it('marca la ausencia de explicación', () => {
    const findings = lintQuestions([mc({ explanation: '' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('Sin explicación'))).toBe(true)
  })
})

describe('lintQuestions — índices', () => {
  it('apunta al índice correcto en un lote', () => {
    const findings = lintQuestions([mc(), mc({ question: '$x + 1' }), mc()], SUPERIOR)
    expect(findings).toHaveLength(1)
    expect(findings[0].questionIndex).toBe(1)
  })
})

describe('lintQuestions — escapes unicode crudos', () => {
  // Caso real del 10/08: ids 1430..1448, diez respuestas seguidas de un mismo
  // intento con todo el contenido escapado sin decodificar.
  it('marca el enunciado corrompido tal como llegó a los alumnos', () => {
    const findings = lintQuestions(
      [mc({ question: 'Es cierto que la par\\u00e1bola es el lugar geom\\u00e9trico de los puntos' })],
      SUPERIOR
    )
    expect(findings.some((f) => f.justification.includes('sin decodificar'))).toBe(true)
    expect(findings.find((f) => f.justification.includes('sin decodificar'))?.severity).toBe('critical')
  })

  it('también lo detecta en opciones y en la explicación', () => {
    expect(
      lintQuestions([mc({ options: ['bien', 'as\\u00edntota', 'x', 'y'] })], SUPERIOR).some((f) =>
        f.justification.includes('sin decodificar')
      )
    ).toBe(true)
    expect(
      lintQuestions([mc({ explanation: 'La ecuaci\\u00f3n queda as\\u00ed.' })], SUPERIOR).some((f) =>
        f.justification.includes('sin decodificar')
      )
    ).toBe(true)
  })

  // El recorte a Latin-1 existe para esto: una pregunta de sistemas sobre
  // codificación de caracteres menciona escapes ASCII a propósito.
  it('no marca un escape fuera de Latin-1, que puede ser el tema de la pregunta', () => {
    const findings = lintQuestions(
      [mc({ question: '¿Qué carácter representa el escape \\u0041 en Unicode?' })],
      SUPERIOR
    )
    expect(findings.some((f) => f.justification.includes('sin decodificar'))).toBe(false)
  })

  it('no marca texto normal con tildes', () => {
    const findings = lintQuestions([mc({ question: '¿Cuál es la ecuación de la parábola?' })], SUPERIOR)
    expect(findings.some((f) => f.justification.includes('sin decodificar'))).toBe(false)
  })
})

describe('lintQuestions — referencia a un visual inexistente', () => {
  // Caso real id 750. El alumno respondió y erró una pregunta que no se podía
  // responder: no hay ningún gráfico en el cuestionario.
  it('marca "Observa el siguiente gráfico"', () => {
    const findings = lintQuestions(
      [mc({ question: 'Observa el siguiente gráfico. ¿Representa una función matemática?' })],
      SUPERIOR
    )
    const hit = findings.find((f) => f.justification.includes('nunca muestra'))
    expect(hit).toBeDefined()
    expect(hit?.severity).toBe('critical')
  })

  // Falso positivo medido sobre los datos reales (id 1071): menciona una
  // gráfica pero después describe el comportamiento en palabras. Es
  // respondible, y por eso la regla es estrecha.
  it('NO marca un enunciado que menciona una gráfica pero se explica solo', () => {
    const findings = lintQuestions(
      [
        mc({
          question:
            'Considera una función $f(x)$ cuya gráfica se muestra en un plano cartesiano. Si los valores de $y$ disminuyen mientras $x$ aumenta en $(-\\infty, 2)$ y luego aumentan, ¿qué pasa en $x=2$?',
        }),
      ],
      SUPERIOR
    )
    expect(findings.some((f) => f.justification.includes('nunca muestra'))).toBe(false)
  })

  it('NO marca la mención suelta de una figura', () => {
    const findings = lintQuestions(
      [mc({ question: 'Si los semiejes son iguales, la figura resultante es una circunferencia. ¿Cuál es su radio?' })],
      SUPERIOR
    )
    expect(findings.some((f) => f.justification.includes('nunca muestra'))).toBe(false)
  })
})

describe('lintQuestions — true_false que adelanta su respuesta', () => {
  function tf(question: string, correctAnswer = true): Question {
    return {
      id: 'q1',
      topic: 't',
      topicName: 'Tema',
      question,
      explanation: 'Porque sí.',
      type: 'true_false',
      correctAnswer,
    } as unknown as Question
  }

  // Casos reales 693 y 1432; los dos con correctAnswer true, que es lo que el
  // enunciado adelanta.
  it('marca "Es verdadero que..." y "Es cierto que..."', () => {
    expect(
      lintQuestions([tf('Es verdadero que la parábola $x^2 = 8y$ se abre hacia arriba.')], SUPERIOR).some((f) =>
        f.justification.includes('adelanta la respuesta')
      )
    ).toBe(true)
    expect(
      lintQuestions([tf('Es cierto que la parábola equidista del foco y la directriz.')], SUPERIOR).some((f) =>
        f.justification.includes('adelanta la respuesta')
      )
    ).toBe(true)
  })

  // 12 casos reales del 10/08 tienen esta forma y ninguno es un defecto.
  it('NO marca la forma interrogativa, que es legítima', () => {
    expect(
      lintQuestions([tf('¿Es verdadero que una función polinómica de grado 3 tiene una raíz real?')], SUPERIOR).some(
        (f) => f.justification.includes('adelanta la respuesta')
      )
    ).toBe(false)
  })

  it('NO marca una afirmación común que no se auto-califica', () => {
    expect(
      lintQuestions([tf('La directriz de una parábola es perpendicular al eje focal.')], SUPERIOR).some((f) =>
        f.justification.includes('adelanta la respuesta')
      )
    ).toBe(false)
  })

  it('sólo aplica a true_false, no a multiple_choice', () => {
    expect(
      lintQuestions([mc({ question: 'Es verdadero que $2+2=4$. ¿Cuál es el resultado?' })], SUPERIOR).some((f) =>
        f.justification.includes('adelanta la respuesta')
      )
    ).toBe(false)
  })
})
