/**
 * Ronda U · U5 — Las dos versiones difíciles del archivo de muestra de Moodle:
 * una pregunta de cada tipo con LaTeX (fracciones, raíces, conjuntos `\{…\}`)
 * y otra con los caracteres que rompieron el GIFT del 20/11 (`&`, `<`,
 * comillas, tildes, `~`, `=`, `#`, `:`, llaves).
 *
 * Sin dependencias de la base ni de la IA: lo usan el script de la muestra y
 * los tests del validador.
 */
import { aleatorioConSemilla, instanciarCalculada } from '../../../lib/calculada'
import type { Question } from '../../../lib/types'

const latex = { topic: 'latex', topicName: 'Con LaTeX' }
const raros = { topic: 'caracteres', topicName: 'Caracteres difíciles' }

export const PREGUNTAS_CON_LATEX: Question[] = [
  {
    ...latex,
    id: 'l1',
    type: 'multiple_choice',
    question: '¿Cuánto vale $\\frac{3}{4} + \\frac{1}{8}$?',
    options: ['$\\frac{7}{8}$', '$\\frac{4}{12}$', '$\\frac{1}{2}$', '$\\frac{5}{8}$'],
    correctAnswer: 0,
    explanation: '$\\frac{3}{4} = \\frac{6}{8}$, y $\\frac{6}{8} + \\frac{1}{8} = \\frac{7}{8}$.',
  },
  {
    ...latex,
    id: 'l2',
    type: 'true_false',
    question: '$\\sqrt{2} \\in \\mathbb{Q}$',
    correctAnswer: false,
    explanation: '$\\sqrt{2}$ es irracional: no se escribe como $\\frac{p}{q}$.',
  },
  {
    ...latex,
    id: 'l3',
    type: 'numeric',
    question: '¿Cuánto vale $\\sqrt{49} + \\frac{1}{2}$?',
    correctAnswer: 7.5,
    tolerance: 0.01,
    explanation: '$\\sqrt{49} = 7$ y $7 + \\frac{1}{2} = 7{,}5$.',
  },
  {
    ...latex,
    id: 'l4',
    type: 'short_answer',
    question: 'Si $A = \\{1, 2, 3\\}$ y $B = \\{2, 3, 4\\}$, ¿cuántos elementos tiene $A \\cap B$? Escribilo con palabras.',
    acceptedAnswers: ['dos', '2'],
    explanation: '$A \\cap B = \\{2, 3\\}$: dos elementos.',
  },
  {
    ...latex,
    id: 'l5',
    type: 'multiple_response',
    question: '¿Cuáles pertenecen a $\\{x \\in \\mathbb{Z} : x^2 < 5\\}$? Marcá todas las que correspondan.',
    options: ['$-2$', '$0$', '$\\sqrt{5}$', '$2$', '$3$'],
    correctAnswers: [0, 1, 3],
    explanation: 'Los enteros con cuadrado menor que 5: $-2, -1, 0, 1, 2$.',
  },
  {
    ...latex,
    id: 'l6',
    type: 'matching',
    question: 'Uní cada expresión con su valor.',
    pairs: [
      { left: '$\\frac{1}{2}$', right: '$0{,}5$' },
      { left: '$\\sqrt{9}$', right: '$3$' },
      { left: '$\\{1, 2\\} \\cup \\{3\\}$', right: '$\\{1, 2, 3\\}$' },
      { left: '$\\sqrt[3]{8}$', right: '$2$' },
    ],
    distractors: ['$\\emptyset$'],
    explanation: 'Cada expresión con lo que vale.',
  },
  {
    ...latex,
    id: 'l7',
    type: 'ordering',
    question: 'Ordená de menor a mayor.',
    items: ['$\\frac{1}{3}$', '$\\frac{1}{2}$', '$\\sqrt{2}$', '$\\frac{5}{2}$'],
    explanation: '$0{,}33 < 0{,}5 < 1{,}41 < 2{,}5$.',
  },
  {
    ...latex,
    id: 'l8',
    type: 'gapselect',
    question: 'Completá con el valor que corresponde.',
    text: 'Si $x = \\frac{1}{2}$, entonces $2x =$ [[1]], $x^2 =$ [[2]] y $\\sqrt{x^2} =$ [[3]].',
    choices: ['$1$', '$\\frac{1}{4}$', '$\\frac{1}{2}$', '$2$'],
    explanation: '$2 \\cdot \\frac{1}{2} = 1$, $\\left(\\frac{1}{2}\\right)^2 = \\frac{1}{4}$ y $\\sqrt{\\frac{1}{4}} = \\frac{1}{2}$.',
  },
  {
    ...latex,
    id: 'l9',
    type: 'ddwtos',
    question: 'Poné cada palabra en su hueco.',
    text: 'En $\\{x \\in \\mathbb{R} : x > 0\\}$ los números son [[1]]; $\\sqrt{-1}$ no es un número [[2]]; $\\frac{0}{5}$ es [[3]].',
    choices: ['positivos', 'real', 'cero', 'negativos', 'entero'],
    explanation: 'El conjunto de los positivos, la unidad imaginaria y el cero.',
  },
  {
    ...latex,
    id: 'l10',
    type: 'missing_word',
    question: 'Elegí la fracción que falta.',
    text: 'La fracción $\\frac{6}{8}$ simplificada es [[1]].',
    options: ['$\\frac{3}{4}$', '$\\frac{2}{3}$', '$\\frac{6}{4}$'],
    correctAnswer: 0,
    explanation: 'Se dividen numerador y denominador por 2.',
  },
  instanciarCalculada(
    {
      ...latex,
      id: 'l11',
      type: 'calculated' as const,
      question: 'Un rectángulo mide {a} cm por {b} cm. ¿Cuánto mide su diagonal, $\\sqrt{a^2 + b^2}$, en cm?',
      formula: 'sqrt({a} * {a} + {b} * {b})',
      variables: [
        { name: 'a', min: 3, max: 12, decimals: 0 },
        { name: 'b', min: 4, max: 15, decimals: 0 },
      ],
      tolerance: 0.01,
      explanation: 'Por Pitágoras, $d = \\sqrt{a^2 + b^2}$.',
    },
    aleatorioConSemilla('muestra-l11'),
  )!,
]

export const PREGUNTAS_CON_CARACTERES_DIFICILES: Question[] = [
  {
    ...raros,
    id: 'c1',
    type: 'multiple_choice',
    question: 'En C, ¿qué devuelve "a && b" si a = 1 y b = 0?',
    options: ['0: falso', '1: verdadero', 'a < b & b > a', 'Depende de ~a'],
    correctAnswer: 0,
    explanation: '&& es "y": con b = 0, el resultado es 0.',
  },
  {
    ...raros,
    id: 'c2',
    type: 'true_false',
    question: 'En HTML, el carácter < se escribe &lt; y el & se escribe &amp;.',
    correctAnswer: true,
    explanation: 'Son las entidades de "menor que" y del ampersand.',
  },
  {
    ...raros,
    id: 'c3',
    type: 'numeric',
    question: 'Con a = 2 y b = 5 (a < b), ¿cuánto vale "a + b"?',
    correctAnswer: 7,
    tolerance: 0,
    explanation: '2 + 5 = 7.',
  },
  {
    ...raros,
    id: 'c4',
    type: 'short_answer',
    question: '¿Qué operador significa "distinto de" en JavaScript? Escribilo tal cual.',
    acceptedAnswers: ['!=', '!=='],
    explanation: '!= compara sin el tipo; !== también compara el tipo.',
  },
  {
    ...raros,
    id: 'c5',
    type: 'multiple_response',
    question: '¿Cuáles de estos símbolos tienen un uso especial en GIFT? Marcá todas las que correspondan.',
    options: ['~ (virgulilla)', '= (igual)', '# (numeral)', 'ñ (eñe)', ': (dos puntos)'],
    correctAnswers: [0, 1, 2, 4],
    explanation: '~ = # : y las llaves se escapan con \\ en GIFT.',
  },
  {
    ...raros,
    id: 'c6',
    type: 'matching',
    question: 'Uní cada texto con lo que es.',
    pairs: [
      { left: 'AT&T', right: 'Una empresa "Bell"' },
      { left: '#ética', right: 'Una etiqueta: tema' },
      { left: '~/año', right: 'Una carpeta personal' },
      { left: 'x <= 3', right: 'Una desigualdad' },
    ],
    distractors: ['Una ecuación = 0'],
    explanation: 'Cada texto con lo que representa.',
  },
  {
    ...raros,
    id: 'c7',
    type: 'ordering',
    question: 'Ordená los pasos para escribir una página HTML mínima.',
    items: ['Abrir <html>', 'Escribir el <body> con "Hola & chau"', 'Cerrar </html>'],
    explanation: 'Se abre, se escribe el cuerpo y se cierra.',
  },
  {
    ...raros,
    id: 'c8',
    type: 'gapselect',
    question: 'Completá con la entidad HTML que corresponde.',
    text: 'En HTML, & se escribe [[1]], < se escribe [[2]] y " se escribe [[3]].',
    choices: ['&amp;', '&lt;', '&quot;', '&gt;'],
    explanation: '&amp;, &lt; y &quot;.',
  },
  {
    ...raros,
    id: 'c9',
    type: 'ddwtos',
    question: 'Poné cada nombre en su símbolo.',
    text: 'El "~" se llama [[1]], el "#" se llama [[2]] y el ":" se llama [[3]].',
    choices: ['virgulilla', 'numeral', 'dos puntos', 'arroba'],
    explanation: 'Virgulilla, numeral y dos puntos.',
  },
  {
    ...raros,
    id: 'c10',
    type: 'missing_word',
    question: 'Elegí el símbolo que falta.',
    text: 'En una planilla de cálculo, una fórmula empieza con [[1]].',
    options: ['=', '#', ':'],
    correctAnswer: 0,
    explanation: 'Las fórmulas empiezan con "=".',
  },
  instanciarCalculada(
    {
      ...raros,
      id: 'c11',
      type: 'calculated' as const,
      question: 'Un "combo" de {n} empanadas & {g} gaseosas: cada empanada cuesta 1200 pesos y cada gaseosa, 1500. ¿Cuánto se paga en total?',
      formula: '{n} * 1200 + {g} * 1500',
      variables: [
        { name: 'n', min: 2, max: 12, decimals: 0 },
        { name: 'g', min: 1, max: 4, decimals: 0 },
      ],
      tolerance: 0.01,
      explanation: 'Empanadas por su precio más gaseosas por el suyo.',
    },
    aleatorioConSemilla('muestra-c11'),
  )!,
]
