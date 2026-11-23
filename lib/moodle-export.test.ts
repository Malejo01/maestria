import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { buildMoodleFileName, convertQuizToGift, exportQuizToMoodleGift } from './moodle-export'
import type { TeacherQuiz } from '@/lib/types'

function makeQuiz(overrides: Partial<TeacherQuiz> = {}): TeacherQuiz {
  return {
    id: 1,
    userId: 'teacher-1',
    teacherProgramId: 10,
    title: 'Cuestionario de prueba',
    subjectName: 'Análisis Matemático I',
    mode: 'teorico',
    status: 'saved',
    selectedTopics: [
      { id: '1', name: 'Límites' },
      { id: '2', name: 'Derivadas' },
      { id: '3', name: 'Integrales' },
      { id: '4', name: 'Series' },
      { id: '5', name: 'Sucesiones' },
      { id: '6', name: 'Extra no exportada' },
    ],
    questionCount: 1,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        topic: 'limites',
        topicName: 'Límites',
        question: '¿Qué vale 2:1? Usa {a,b} ~ = # y $x^2$ y $$\\frac{1}{2}$$.',
        options: [
          'Incorrecta con ~ y #',
          'Correcta con = y {texto}',
          'Otra opción',
          'Última opción',
        ],
        correctAnswer: 1,
        explanation: 'La respuesta correcta usa la razón $x^2$ y la fracción $$\\frac{1}{2}$$.',
      },
    ],
    pedagogyContext: 'Contexto docente',
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    ...overrides,
  }
}

function makeRealTeacherQuizFixture(): TeacherQuiz {
  return {
    id: 42,
    userId: 'teacher-99',
    teacherProgramId: 77,
    title: 'Cálculo I - Parcial integrador',
    subjectName: 'Cálculo I',
    mode: 'practico',
    status: 'saved',
    selectedTopics: [
      { id: 'lim-1', name: 'Límite y continuidad' },
      { id: 'der-1', name: 'Derivada como tasa de cambio' },
      { id: 'int-1', name: 'Integrales definidas' },
    ],
    questionCount: 3,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        topic: 'limites',
        topicName: 'Límite y continuidad',
        question: 'Si \\(f(x)=\\frac{x^2-1}{x-1}\\), entonces el límite cuando x tiende a 1 es:',
        options: ['0', '1', '2', 'No existe'],
        correctAnswer: 2,
        explanation: 'Factorizando se obtiene \\(x+1\\), por lo que el valor del límite es 2.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        topic: 'derivadas',
        topicName: 'Derivada como tasa de cambio',
        question: 'La derivada de \\(x^3\\) es:',
        options: ['\\(3x^2\\)', '\\(x^2\\)', '\\(3x\\)', '\\(x^3\\)'],
        correctAnswer: 0,
        explanation: 'Aplicando la regla de la potencia, \\(\\frac{d}{dx}(x^3)=3x^2\\).',
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        topic: 'integrales',
        topicName: 'Integrales definidas',
        question: 'Dada la función por tramos \\(f(x) = \\begin{cases} x^2+2 & \\text{si } x \\le 1 \\\\ 3x-1 & \\text{si } x > 1 \\end{cases}\\), calcule \\(f(-1) + f(2)\\).',
        options: ['\\(6\\)', '\\(8\\)', '\\(9\\)', '\\(7\\)'],
        correctAnswer: 1,
        explanation: 'Para \\(f(-1)\\), usamos la primera regla y obtenemos 3. Para \\(f(2)\\), usamos la segunda regla y obtenemos 5. Entonces, \\(f(-1)+f(2)=8\\).',
      },
      {
        id: 'q4',
        type: 'multiple_choice',
        topic: 'integrales',
        topicName: 'Integrales definidas',
        question: '¿Cuál es el resultado de \\(\\int_0^1 2x\\,dx\\)?',
        options: ['0', '1', '2', '\\(x^2\\)'],
        correctAnswer: 1,
        explanation: 'Una primitiva de \\(2x\\) es \\(x^2\\); evaluando en 0 y 1 resulta 1.',
      },
    ],
    pedagogyContext: 'Docente universitario con foco en resolución analítica y justificación algebraica.',
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
  }
}

describe('moodle export GIFT', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('escapes reserved GIFT characters and preserves mixed LaTeX formats', () => {
    const gift = convertQuizToGift(makeQuiz())

    expect(gift).toContain('$CATEGORY: $course$/Analisis Matematico I/Limites-Derivadas-Integrales-Series-Sucesiones')
    expect(gift).toContain('::Q1::¿Qué vale 2\\:1? Usa \\{a,b\\} \\~ \\= \\# y \\(x^2\\) y \\[\\frac\\{1\\}\\{2\\}\\]. {')
    expect(gift).toContain('=Correcta con \\= y \\{texto\\}')
    expect(gift).toContain('~Incorrecta con \\~ y \\#')
    expect(gift).toContain('####La respuesta correcta usa la razón \\(x^2\\) y la fracción \\[\\frac\\{1\\}\\{2\\}\\].')
  })

  it('limits the exported category to five selected topics and builds a safe file name', () => {
    const quiz = makeQuiz()

    expect(convertQuizToGift(quiz)).toContain('$CATEGORY: $course$/Analisis Matematico I/Limites-Derivadas-Integrales-Series-Sucesiones')
    expect(buildMoodleFileName(quiz)).toBe('analisis-matematico-i_limites-derivadas-integrales-series-sucesiones.txt')
  })

  it('falls back to the course category and general file name when topics are missing', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        subjectName: 'Probabilidad y Estadística',
        selectedTopics: [],
        questions: [
          {
            id: 'q1',
            type: 'multiple_choice',
            topic: '',
            topicName: '',
            question: 'Pregunta sin tema',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0,
            explanation: '',
          },
        ],
      })
    )

    expect(gift).toContain('$CATEGORY: $course$/Probabilidad y Estadistica')
    expect(buildMoodleFileName(makeQuiz({ subjectName: 'Probabilidad y Estadística', selectedTopics: [], questions: [] }))).toBe('probabilidad-y-estadistica_general.txt')
  })

  it('exports true_false, numeric and short_answer questions in native GIFT syntax', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          {
            id: 'q1',
            type: 'true_false',
            topic: 'limites',
            topicName: 'Límites',
            question: 'El límite de una función siempre existe.',
            correctAnswer: false,
            explanation: 'No todos los límites existen.',
          },
          {
            id: 'q2',
            type: 'numeric',
            topic: 'derivadas',
            topicName: 'Derivadas',
            question: '¿Cuánto vale la derivada de $x^2$ en $x=3$?',
            correctAnswer: 6,
            tolerance: 0.5,
            explanation: 'La derivada es $2x$, evaluada en 3 da 6.',
          },
          {
            id: 'q3',
            type: 'short_answer',
            topic: 'conceptos',
            topicName: 'Conceptos',
            question: '¿Cómo se llama la unidad estructural y funcional de los seres vivos?',
            acceptedAnswers: ['célula', 'la célula'],
            explanation: 'La célula es la unidad básica de la vida.',
          },
        ],
      })
    )

    // M5: la retroalimentación va ADENTRO de las llaves; antes iba después de
    // `}` y Moodle la mostraba como parte del enunciado.
    expect(gift).toContain('{FALSE####No todos los límites existen.}')
    expect(gift).toContain('{#6:0.5####La derivada es \\(2x\\), evaluada en 3 da 6.}')
    expect(gift).toContain('{=célula=la célula####La célula es la unidad básica de la vida.}')
    expect(gift).not.toMatch(/\}\n####/)
    expect((gift.match(/::Q\d+::/g) ?? []).length).toBe(3)
  })

  it('throws when a short_answer question has no accepted answers', () => {
    expect(() =>
      convertQuizToGift(
        makeQuiz({
          questions: [
            {
              id: 'q1',
              type: 'short_answer',
              topic: 'conceptos',
              topicName: 'Conceptos',
              question: 'Pregunta sin respuestas aceptadas',
              acceptedAnswers: [],
              explanation: '',
            },
          ],
        })
      )
    ).toThrow('no tiene respuestas aceptadas validas.')
  })

  it('throws when a question does not have a valid correct answer index', () => {
    expect(() =>
      convertQuizToGift(
        makeQuiz({
          questions: [
            {
              id: 'q1',
              type: 'multiple_choice',
              topic: 'limites',
              topicName: 'Límites',
              question: 'Pregunta inválida',
              options: ['A', 'B'],
              correctAnswer: 5,
              explanation: 'No debería exportarse',
            },
          ],
        })
      )
    ).toThrow('La pregunta 1 no tiene una respuesta correcta valida.')
  })

  it('downloads the generated file when exporting directly', () => {
    const appendChild = vi.fn()
    const removeChild = vi.fn()
    const click = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    const createElement = vi.fn(() => ({
      href: '',
      download: '',
      click,
    }))

    vi.stubGlobal('Blob', class MockBlob {
      readonly parts: BlobPart[]
      readonly options?: BlobPropertyBag
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        this.parts = parts
        this.options = options
      }
    })

    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    })

    vi.stubGlobal('document', {
      createElement,
      body: { appendChild, removeChild },
    })

    const fileName = exportQuizToMoodleGift(makeQuiz())

    expect(fileName).toBe('analisis-matematico-i_limites-derivadas-integrales-series-sucesiones.txt')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('exports a realistic teacher quiz fixture into a Moodle-friendly GIFT document', () => {
    const gift = convertQuizToGift(makeRealTeacherQuizFixture())

    expect(gift.startsWith('$CATEGORY: $course$/Calculo I/Limite y continuidad-Derivada como tasa de cambio-Integrales definidas')).toBe(true)
    expect((gift.match(/::Q\d+::/g) ?? []).length).toBe(4)
    expect(gift).toContain('}\n\n::Q2::')
    expect(gift).toContain('}\n\n::Q3::')
    expect(gift).toContain('\\frac\\{x^2-1\\}\\{x-1\\}')
    expect(gift).toContain('\\begin\\{cases\\}')
    expect(gift).toContain('\\end\\{cases\\}')
    expect(gift).toContain('=2')
    expect(gift).toContain('~0')
    expect(gift).toContain('####Factorizando se obtiene')
    expect(gift).toContain('####Aplicando la regla de la potencia')
    expect(gift).toContain('####Una primitiva de')
    expect(gift).not.toContain('$$')
  })

  it('keeps a Moodle regression case split into separate questions after LaTeX feedback', () => {
    const quiz = makeQuiz({
      subjectName: 'Funcion de variable real',
      selectedTopics: [
        { id: 'd1', name: 'Dominio e Imagen' },
        { id: 'g1', name: 'Grafica de funciones' },
      ],
      questions: [
        {
          id: 'q1',
          type: 'multiple_choice',
          topic: 'dominio',
          topicName: 'Dominio e Imagen',
          question: 'Determine el dominio de la función \\(f(x) = \\frac\{\\sqrt\{x+2\}\}\{\\ln(x-3)\}\\).',
          options: ['\\((-2, 3)\\)', '\\([3, \\infty)\\)', '\\((3, \\infty)\\)'],
          correctAnswer: 2,
          explanation: 'Para el logaritmo, necesitamos \\(x-3 > 0\\). Para la raíz, necesitamos \\(x+2 > 0\\).',
        },
        {
          id: 'q2',
          type: 'multiple_choice',
          topic: 'grafica',
          topicName: 'Grafica de funciones',
          question: 'Encuentre la ecuación de la recta que pasa por los puntos \\((1,4)\\) y \\((3,10)\\).',
          options: ['\\(y = 2x + 1\\)', '\\(y = 3x + 1\\)', '\\(y = 2x + 2\\)'],
          correctAnswer: 1,
          explanation: 'La pendiente es \\(m = \\frac\{10-4\}\{3-1\} = 3\\).',
        },
      ],
    })

    const gift = convertQuizToGift(quiz)

    expect((gift.match(/::Q\d+::/g) ?? []).length).toBe(2)
    expect(gift).toContain('\\frac\\{\\sqrt\\{x+2\\}\\}\\{\\ln(x-3)\\}')
    expect(gift).toContain('####Para el logaritmo, necesitamos \\(x-3 > 0\\).')
    expect(gift).toContain('}\n\n::Q2::Encuentre la ecuación de la recta')
  })

  // M5: este test fijaba el defecto. `\{3, …\}` con UN escape llega a Moodle
  // como `{3, …}`, que LaTeX lee como agrupación: el alumno veía "3, -5/3" sin
  // llaves. Las llaves de conjunto adentro de LaTeX van con `\\\{` (llega `\{`);
  // las de agrupación (`\frac{5}{3}`) siguen con uno.
  it('escapes LaTeX set braces so they reach Moodle as \\{ … \\}', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          {
            id: 'q9',
            type: 'multiple_choice',
            topic: 'ecuaciones',
            topicName: 'Ecuaciones con valor absoluto',
            question: 'Resuelva la ecuación \\(|3x - 2| = 7\\).',
            options: [
              '\\(\\{ \\frac{5}{3}, 7\\}\\)',
              '\\(\\{3, \\frac{5}{3}\\}\\)',
              '\\(\\{-3, -\\frac{5}{3}\\}\\)',
              '\\(\\{-3, \\frac{5}{3}\\}\\)',
              '\\(\\{3, -\\frac{5}{3}\\}\\)',
            ],
            correctAnswer: 4,
            explanation: 'Las soluciones son \\(\\{3, -\\frac{5}{3}\\}\\).',
          },
        ],
      })
    )

    expect(gift).toContain('=\\(\\\\\\{3, -\\frac\\{5\\}\\{3\\}\\\\\\}\\)')
    expect(gift).toContain('~\\(\\\\\\{ \\frac\\{5\\}\\{3\\}, 7\\\\\\}\\)')
  })
})

describe('Ronda T · F2: varias correctas en GIFT', () => {
  it('cada correcta con su parte (%50%) y cada incorrecta restando (%-50%)', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          { id: 'q1', type: 'multiple_response', topic: 't', topicName: 'T', question: '¿Cuáles son pares?', options: ['2', '3', '4', '5'], correctAnswers: [0, 2], explanation: 'Los pares.' },
        ],
      }),
    )
    expect(gift).toContain('::Q1::¿Cuáles son pares? {\n~%50%2\n~%-50%3\n~%50%4\n~%-50%5\n####Los pares.\n}')
  })
})

describe('Ronda T · F3: emparejamiento en GIFT', () => {
  it('cada par como =izquierda -> derecha (GIFT no lleva distractores)', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          {
            id: 'q1',
            type: 'matching',
            topic: 't',
            topicName: 'T',
            question: 'Uní cada autor con su concepto.',
            pairs: [
              { left: 'Geertz', right: 'Descripción densa' },
              { left: 'Lévi-Strauss', right: 'Estructuralismo' },
              { left: 'Malinowski', right: 'Observación participante' },
            ],
            distractors: ['Evolucionismo'],
            explanation: '',
          },
        ],
      }),
    )
    expect(gift).toContain('::Q1::Uní cada autor con su concepto. {\n=Geertz -> Descripción densa\n=Lévi-Strauss -> Estructuralismo\n=Malinowski -> Observación participante\n}')
    expect(gift).not.toContain('Evolucionismo')
  })
})

describe('Ronda T · F4: ordenamiento en GIFT', () => {
  it('GIFT no tiene ordenamiento: va como emparejamiento de cada lugar con su elemento', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          { id: 'q1', type: 'ordering', topic: 't', topicName: 'T', question: 'Ordená de la más antigua a la más reciente.', items: ['Paleolítico', 'Neolítico', 'Edad de los metales'], explanation: '' },
        ],
      }),
    )
    expect(gift).toContain('{\n=Lugar 1 -> Paleolítico\n=Lugar 2 -> Neolítico\n=Lugar 3 -> Edad de los metales\n}')
  })
})

describe('Ronda T · F5: huecos en GIFT', () => {
  it('GIFT no tiene huecos múltiples: el texto con (n) ___ y cada hueco emparejado con su palabra', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          { id: 'q1', type: 'gapselect', topic: 't', topicName: 'T', question: 'Completá el texto.', text: 'El [[1]] y la [[2]] y el [[3]].', choices: ['precio', 'cantidad', 'mercado', 'renta'], explanation: '' },
        ],
      }),
    )
    expect(gift).toContain('::Q1::Completá el texto.\nEl (1) ___ y la (2) ___ y el (3) ___. {\n=Hueco 1 -> precio\n=Hueco 2 -> cantidad\n=Hueco 3 -> mercado\n}')
    expect(gift).not.toContain('renta')
  })
})

describe('Ronda T · F6: la palabra faltante en GIFT', () => {
  it('las opciones entre llaves, en el lugar del hueco', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          { id: 'q1', type: 'missing_word', topic: 't', topicName: 'T', question: 'Elegí la palabra que falta.', text: 'Juzgar con los valores propios se llama [[1]] en antropología.', options: ['relativismo', 'etnocentrismo', 'evolucionismo'], correctAnswer: 1, explanation: 'Es etnocentrismo.' },
        ],
      }),
    )
    expect(gift).toContain('::Q1::Elegí la palabra que falta.\nJuzgar con los valores propios se llama {~relativismo =etnocentrismo ~evolucionismo####Es etnocentrismo.} en antropología.')
  })
})

describe('Ronda T · F7: la calculada en GIFT', () => {
  it('GIFT no tiene calculadas: va como numérica con los valores que tocaron y el margen', () => {
    const gift = convertQuizToGift(
      makeQuiz({
        questions: [
          {
            id: 'q1',
            type: 'calculated',
            topic: 't',
            topicName: 'T',
            question: 'Cuesta 200 pesos y sube un 10 %. ¿Cuánto cuesta ahora?',
            plantilla: 'Cuesta {p} pesos y sube un {x} %. ¿Cuánto cuesta ahora?',
            formula: '{p} * (1 + {x} / 100)',
            variables: [
              { name: 'p', min: 100, max: 500, decimals: 0 },
              { name: 'x', min: 5, max: 20, decimals: 0 },
            ],
            valores: { p: 200, x: 10 },
            correctAnswer: 220,
            tolerance: 0.01,
            explanation: '',
          },
        ],
      }),
    )
    expect(gift).toContain('::Q1::Cuesta 200 pesos y sube un 10 %. ¿Cuánto cuesta ahora? {#220:2.2}')
  })
})
