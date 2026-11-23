import { describe, expect, it } from 'vitest'
import { buildMoodleXmlFileName, convertQuizToMoodleXml } from './moodle-xml'
import { fraccionValida, leerXml, validarMoodleXml } from './moodle-xml-validar'
import type { Question, TeacherQuiz } from '@/lib/types'

const base = { topic: 't', topicName: 'Límites', explanation: '' }
const PREGUNTAS: Question[] = [
  {
    ...base,
    id: 'q1',
    type: 'multiple_choice',
    question: 'Si $x < 3$ y $y > 1$, ¿qué vale {a,b} ~ = # : & "comillas"?\nSegunda línea.',
    options: ['$\\frac{1}{2}$', 'Uno & dos', 'Tres <b>', 'Fin con ]]> adentro'],
    correctAnswer: 0,
    explanation: 'Porque $\\frac{1}{2} \\neq 1$.',
  },
  { ...base, id: 'q2', type: 'true_false', question: 'El conjunto $\\{1, 2\\}$ tiene dos elementos.', correctAnswer: true, explanation: 'Sí.' },
  { ...base, id: 'q3', type: 'numeric', question: '¿Cuánto es 3/4?', correctAnswer: 0.75, tolerance: 0.01, explanation: '' },
  { ...base, id: 'q4', type: 'numeric', question: '¿Cuánto es 11/12?', correctAnswer: 11 / 12, fraccion: { numerador: 11, denominador: 12 }, explanation: '' },
  { ...base, id: 'q5', type: 'short_answer', question: '¿Capital de Francia?', acceptedAnswers: ['París', 'Paris'], explanation: '' },
  { ...base, id: 'q6', type: 'multiple_response', question: '¿Cuáles son pares?', options: ['2', '3', '4', '5'], correctAnswers: [0, 2], explanation: '' },
  {
    ...base,
    id: 'q7',
    type: 'matching',
    question: 'Uní cada autor con su concepto.',
    pairs: [
      { left: 'Geertz & la cultura', right: 'Descripción densa' },
      { left: 'Lévi-Strauss', right: 'Estructuralismo' },
      { left: 'Malinowski', right: 'Observación <participante>' },
    ],
    distractors: ['Evolucionismo'],
    explanation: '',
  },
  { ...base, id: 'q8', type: 'ordering', question: 'Ordená de la más antigua a la más reciente.', items: ['Paleolítico', 'Neolítico', 'Edad de los metales'], explanation: '' },
]

function quiz(questions: Question[] = PREGUNTAS): TeacherQuiz {
  return {
    id: 1,
    userId: 'd',
    teacherProgramId: 10,
    title: 'Prueba',
    subjectName: 'Análisis Matemático I',
    mode: 'mixto',
    status: 'saved',
    selectedTopics: [{ id: '1', name: 'Límites' }],
    questionCount: questions.length,
    questions,
    createdAt: '2026-11-22T00:00:00Z',
    updatedAt: '2026-11-22T00:00:00Z',
  } as TeacherQuiz
}

describe('F1 · convertQuizToMoodleXml', () => {
  const xml = convertQuizToMoodleXml(quiz())

  it('Moodle lo importa: el validador no encuentra problemas', () => {
    expect(validarMoodleXml(xml)).toEqual([])
  })

  it('la categoría es la misma que en GIFT', () => {
    expect(xml).toContain('<question type="category">')
    expect(xml).toContain('<text>$course$/Analisis Matematico I/Limites</text>')
  })

  it('cada tipo va con el suyo de Moodle', () => {
    const tipos = [...xml.matchAll(/<question type="(\w+)">/g)].map((m) => m[1])
    expect(tipos).toEqual(['category', 'multichoice', 'truefalse', 'numerical', 'numerical', 'shortanswer', 'multichoice', 'matching', 'ordering'])
    // F4: cada elemento en el orden correcto, con su lugar como fracción.
    expect(xml).toContain('<answer fraction="2.0000000" format="html"><text><![CDATA[<p>Neolítico</p>]]></text>')
    // F3: cada par un subquestion; el distractor, uno sin texto; la respuesta en texto plano escapado.
    expect(xml.match(/<subquestion format="html">/g)).toHaveLength(4)
    expect(xml).toContain('<p>Geertz &amp; la cultura</p>')
    expect(xml).toContain('<answer><text>Observación &lt;participante&gt;</text></answer>')
    expect(xml).toContain('<subquestion format="html"><text></text><answer><text>Evolucionismo</text></answer></subquestion>')
  })

  it('el texto va como HTML: "<" escapado, la matemática en \\( \\), los saltos como <br>, y "]]>" queda escapado adentro del CDATA', () => {
    expect(xml).toContain('Si \\(x &lt; 3\\) y \\(y &gt; 1\\), ¿qué vale {a,b} ~ = # : &amp; &quot;comillas&quot;?<br>Segunda línea.')
    expect(xml).toContain('\\(\\frac{1}{2}\\)')
    expect(xml).toContain('Fin con ]]&gt; adentro')
    const { raiz } = leerXml(xml)
    const opcion = raiz?.hijos[1].hijos.filter((h) => h.nombre === 'answer')[3]
    expect(opcion?.hijos[0].texto).toBe('<p>Fin con ]]&gt; adentro</p>')
    expect(convertQuizToMoodleXml(quiz()).match(/<!\[CDATA\[/g)?.length).toBeGreaterThan(5)
  })

  it('la correcta vale 100 y las demás 0; verdadero o falso con true y false', () => {
    expect(xml.match(/<answer fraction="100" format="html">/g)).toHaveLength(1)
    // F2: varias correctas, con single = false y las correctas sumando 100.
    expect(xml).toContain('<single>false</single>')
    expect(xml.match(/<answer fraction="50" format="html">/g)).toHaveLength(2)
    expect(xml.match(/<answer fraction="-50" format="html">/g)).toHaveLength(2)
    expect(xml).toContain('<answer fraction="100" format="moodle_auto_format"><text>true</text>')
    expect(xml).toContain('<answer fraction="0" format="moodle_auto_format"><text>false</text>')
  })

  it('la numérica con punto decimal y su tolerancia; una fracción periódica, con cuatro decimales', () => {
    expect(xml).toContain('<text>0.75</text><feedback format="html"><text></text></feedback><tolerance>0.01</tolerance>')
    expect(xml).toContain('<text>0.9167</text><feedback format="html"><text></text></feedback><tolerance>0.0001</tolerance>')
  })

  it('el nombre del archivo termina en .xml', () => {
    expect(buildMoodleXmlFileName(quiz())).toBe('analisis-matematico-i_limites.xml')
  })

  it('sin preguntas o sin correcta, no exporta', () => {
    expect(() => convertQuizToMoodleXml(quiz([]))).toThrow('no tiene preguntas')
    expect(() => convertQuizToMoodleXml(quiz([{ ...(PREGUNTAS[0] as Extract<Question, { type: 'multiple_choice' }>), correctAnswer: 9 }]))).toThrow('respuesta correcta')
  })
})

describe('F1 · validarMoodleXml', () => {
  const envolver = (preguntas: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>${preguntas}</quiz>`
  const comun = '<name><text>P</text></name><questiontext format="html"><text><![CDATA[<p>¿Algo?</p>]]></text></questiontext>'

  it('XML mal formado', () => {
    expect(validarMoodleXml('<quiz><question type="truefalse"></quiz>')[0]).toMatch(/Se cierra <\/quiz> pero estaba abierta <question>/)
    expect(validarMoodleXml('<quiz>x & y</quiz>')[0]).toMatch(/"&" suelto/)
    expect(validarMoodleXml('<quiz><![CDATA[abc</quiz>')[0]).toMatch(/CDATA no se cierra/)
    expect(validarMoodleXml('<otro></otro>')).toEqual(['El elemento raíz tiene que ser <quiz>.'])
  })

  it('un tipo que Moodle no conoce', () => {
    expect(validarMoodleXml(envolver(`<question type="inventado">${comun}</question>`))).toEqual(['Pregunta 1: tipo desconocido para Moodle: "inventado".'])
  })

  it('opción múltiple: sin correcta, fracción inválida y varias correctas que no suman 100', () => {
    const op = (f: string) => `<answer fraction="${f}" format="html"><text>a</text></answer>`
    expect(validarMoodleXml(envolver(`<question type="multichoice">${comun}<single>true</single>${op('0')}${op('0')}</question>`))).toContain('Pregunta 1: ninguna opción vale 100 %.')
    expect(validarMoodleXml(envolver(`<question type="multichoice">${comun}<single>true</single>${op('100')}${op('45')}</question>`))[0]).toMatch(/fracción que Moodle no acepta \(45\)/)
    expect(validarMoodleXml(envolver(`<question type="multichoice">${comun}<single>false</single>${op('50')}${op('33.33333')}${op('-50')}</question>`))[0]).toMatch(/sumar 100 \(suman 83.33\)/)
    expect(validarMoodleXml(envolver(`<question type="multichoice">${comun}<single>false</single>${op('50')}${op('50')}${op('-100')}</question>`))).toEqual([])
  })

  it('verdadero o falso y numérica', () => {
    const r = (f: number, t: string, extra = '') => `<answer fraction="${f}"><text>${t}</text>${extra}</answer>`
    expect(validarMoodleXml(envolver(`<question type="truefalse">${comun}${r(100, 'true')}${r(100, 'false')}</question>`))).toContain('Pregunta 1: verdadero o falso necesita exactamente una respuesta con 100.')
    expect(validarMoodleXml(envolver(`<question type="numerical">${comun}${r(100, '0,75')}</question>`))[0]).toMatch(/no es un número con punto decimal \("0,75"\)/)
  })

  it('emparejamiento, seleccionar o arrastrar, ordenamiento y calculada', () => {
    const par = (q: string, a: string) => `<subquestion format="html"><text>${q}</text><answer><text>${a}</text></answer></subquestion>`
    expect(validarMoodleXml(envolver(`<question type="matching">${comun}${par('A', '1')}${par('', '2')}</question>`))).toEqual([
      'Pregunta 1: el emparejamiento necesita al menos dos pares.',
      'Pregunta 1: el emparejamiento necesita al menos tres respuestas (pares o distractores).',
    ])
    const hueco = '<name><text>P</text></name><questiontext format="html"><text>El [[1]] y el [[3]].</text></questiontext>'
    const opcion = (t: string) => `<selectoption><text>${t}</text><group>1</group></selectoption>`
    expect(validarMoodleXml(envolver(`<question type="gapselect">${hueco}${opcion('sol')}${opcion('mar')}</question>`))).toEqual(['Pregunta 1: el hueco [[3]] no tiene su opción.'])
    expect(validarMoodleXml(envolver(`<question type="ordering">${comun}<answer fraction="1"><text>uno</text></answer></question>`))).toEqual(['Pregunta 1: el ordenamiento necesita al menos dos elementos.'])
    const calc = '<name><text>P</text></name><questiontext format="html"><text>¿{a} + {b}?</text></questiontext><answer fraction="100"><text>{a} + {b}</text></answer>'
    const def = '<dataset_definitions><dataset_definition><name><text>a</text></name><dataset_items><dataset_item><number>1</number><value>2</value></dataset_item></dataset_items></dataset_definition></dataset_definitions>'
    expect(validarMoodleXml(envolver(`<question type="calculated">${calc}${def}</question>`))).toEqual([
      'Pregunta 1: el comodín {b} no tiene su conjunto de datos.',
      'Pregunta 1: la fórmula usa {b} sin definirlo.',
    ])
  })

  it('las fracciones de Moodle', () => {
    expect(fraccionValida(33.33333)).toBe(true)
    expect(fraccionValida(-50)).toBe(true)
    expect(fraccionValida(45)).toBe(false)
  })
})
