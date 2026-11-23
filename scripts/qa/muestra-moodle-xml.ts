/**
 * Ronda T · F1 — El archivo Moodle XML de muestra: un cuestionario con cada
 * tipo de pregunta que exporta MaestrIA, para importarlo en un Moodle de
 * prueba (Banco de preguntas > Importar > Formato Moodle XML).
 *
 *   npx tsx scripts/qa/muestra-moodle-xml.ts
 *
 * Escribe docs/moodle/muestra-ronda-t.xml y lo pasa por el validador. U5 suma
 * dos categorías: una con LaTeX y otra con caracteres difíciles (33 preguntas). No toca
 * la base ni llama a la IA. Cada ítem de F2 a F7 suma su tipo acá.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { unirMoodleXml } from '../../lib/moodle-xml'
import { PREGUNTAS_CON_CARACTERES_DIFICILES, PREGUNTAS_CON_LATEX } from './fixtures/moodle-dificiles'
import { aleatorioConSemilla, instanciarCalculada } from '../../lib/calculada'
import { validarMoodleXml } from '../../lib/moodle-xml-validar'
import type { Question, TeacherQuiz } from '../../lib/types'

const comun = { topic: 'muestra', topicName: 'Muestra' }

export const PREGUNTAS_DE_MUESTRA: Question[] = [
  {
    ...comun,
    id: 'm1',
    type: 'multiple_choice',
    question: 'Para la antropología, el etnocentrismo es…',
    options: [
      'juzgar otras culturas con los valores de la propia',
      'estudiar una cultura desde adentro',
      'comparar culturas sin juzgarlas',
      'el estudio de los grupos étnicos',
    ],
    correctAnswer: 0,
    explanation: 'Es tomar la propia cultura como medida de las demás.',
  },
  {
    ...comun,
    id: 'm2',
    type: 'true_false',
    question: 'Si la demanda es inelástica, una suba del precio aumenta el ingreso total.',
    correctAnswer: true,
    explanation: 'La cantidad baja proporcionalmente menos de lo que sube el precio.',
  },
  {
    ...comun,
    id: 'm3',
    type: 'numeric',
    question: 'El precio sube un 10 % y la cantidad demandada baja un 5 %. ¿Cuál es el valor absoluto de la elasticidad precio, $|E_p|$?',
    correctAnswer: 0.5,
    tolerance: 0.01,
    explanation: '$|E_p| = \\frac{5\\%}{10\\%} = 0.5$',
  },
  {
    ...comun,
    id: 'm4',
    type: 'short_answer',
    question: '¿Cómo se llama el rito que marca el paso de una etapa de la vida a otra?',
    acceptedAnswers: ['rito de paso', 'ritos de paso', 'rito de pasaje'],
    explanation: 'Van Gennep los llamó ritos de paso.',
  },
  // F2 · varias correctas
  {
    ...comun,
    id: 'm5',
    type: 'multiple_response',
    question: '¿Cuáles son rasgos de la cultura para la antropología? Marcá todas las que correspondan.',
    options: ['Se aprende', 'Es innata', 'Se comparte', 'Es individual', 'Es simbólica'],
    correctAnswers: [0, 2, 4],
    explanation: 'La cultura se aprende, se comparte y es simbólica.',
  },
  // F3 · emparejamiento
  {
    ...comun,
    id: 'm6',
    type: 'matching',
    question: 'Uní cada autor con su concepto.',
    pairs: [
      { left: 'Clifford Geertz', right: 'Descripción densa' },
      { left: 'Claude Lévi-Strauss', right: 'Estructuralismo' },
      { left: 'Bronisław Malinowski', right: 'Observación participante' },
      { left: 'Franz Boas', right: 'Particularismo histórico' },
    ],
    distractors: ['Evolucionismo unilineal'],
    explanation: 'Cada autor con el concepto que lo identifica.',
  },
  // F4 · ordenamiento
  {
    ...comun,
    id: 'm7',
    type: 'ordering',
    question: 'Ordená los pasos del trabajo de campo etnográfico.',
    items: ['Elegir el problema', 'Entrar al campo', 'Observar y registrar', 'Analizar los registros', 'Escribir la etnografía'],
    explanation: 'Del problema a la escritura.',
  },
  // F5 · seleccionar la palabra y arrastrar al texto
  {
    ...comun,
    id: 'm8',
    type: 'gapselect',
    question: 'Completá el texto con las palabras que faltan.',
    text: 'Si sube el [[1]] de un bien, baja la [[2]] demandada: la curva de [[3]] tiene pendiente negativa.',
    choices: ['precio', 'cantidad', 'demanda', 'oferta', 'renta'],
    explanation: 'Es la ley de la demanda.',
  },
  {
    ...comun,
    id: 'm9',
    type: 'ddwtos',
    question: 'Poné cada palabra en su hueco.',
    text: 'El [[1]] juzga otras culturas con los valores propios; el [[2]] cultural pide entenderlas en sus [[3]].',
    choices: ['etnocentrismo', 'relativismo', 'términos', 'evolucionismo', 'rasgos'],
    explanation: 'Etnocentrismo y relativismo cultural.',
  },
  // F6 · la palabra faltante
  {
    ...comun,
    id: 'm10',
    type: 'missing_word',
    question: 'Elegí la palabra que falta.',
    text: 'Cuando la cantidad demandada casi no cambia ante una suba del precio, la demanda es [[1]].',
    options: ['inelástica', 'elástica', 'unitaria', 'perfectamente elástica'],
    correctAnswer: 0,
    explanation: 'Si la cantidad casi no responde al precio, la demanda es inelástica.',
  },
  // F7 · calculada (los valores, sorteados con semilla: el archivo sale siempre igual)
  instanciarCalculada(
    {
      ...comun,
      id: 'm11',
      type: 'calculated' as const,
      question: 'Un bien cuesta {p} pesos y su precio sube un {x} %. ¿Cuánto cuesta después de la suba?',
      formula: '{p} * (1 + {x} / 100)',
      variables: [
        { name: 'p', min: 100, max: 900, decimals: 0 },
        { name: 'x', min: 5, max: 25, decimals: 0 },
      ],
      tolerance: 0.01,
      explanation: 'Se multiplica el precio por 1 más el porcentaje de suba.',
    },
    aleatorioConSemilla('muestra-m11'),
  )!,
]

function cuestionario(titulo: string, tema: string, preguntas: Question[]): TeacherQuiz {
  return {
    id: 0,
    userId: 'muestra',
    teacherProgramId: 0,
    title: titulo,
    subjectName: 'Muestra MaestrIA',
    mode: 'mixto',
    status: 'saved',
    selectedTopics: [{ id: 'muestra', name: tema }],
    questionCount: preguntas.length,
    questions: preguntas.map((p) => ({ ...p, topicName: tema })),
    createdAt: '2026-11-22T00:00:00Z',
    updatedAt: '2026-11-23T00:00:00Z',
  } as TeacherQuiz
}

/**
 * U5: tres categorías en el mismo archivo, cada una con una pregunta de cada
 * tipo: la de la ronda T, una con LaTeX (fracciones, raíces, conjuntos) y una
 * con los caracteres que rompieron el GIFT del 20/11.
 */
export function cuestionariosDeMuestra(): TeacherQuiz[] {
  return [
    cuestionario('Muestra Moodle XML · ronda T', 'Ronda T', PREGUNTAS_DE_MUESTRA),
    cuestionario('Muestra Moodle XML · con LaTeX', 'Con LaTeX', PREGUNTAS_CON_LATEX),
    cuestionario('Muestra Moodle XML · caracteres difíciles', 'Caracteres difíciles', PREGUNTAS_CON_CARACTERES_DIFICILES),
  ]
}

const xml = unirMoodleXml(cuestionariosDeMuestra())
const problemas = validarMoodleXml(xml)
if (problemas.length > 0) {
  console.error('El archivo no pasa el validador:\n' + problemas.join('\n'))
  process.exit(1)
}
mkdirSync('docs/moodle', { recursive: true })
writeFileSync('docs/moodle/muestra-ronda-t.xml', xml)
const tipos = [...xml.matchAll(/<question type="(\w+)">/g)].map((m) => m[1]).filter((t) => t !== 'category')
console.log(`docs/moodle/muestra-ronda-t.xml · ${tipos.length} preguntas en 3 categorías (${[...new Set(tipos)].join(', ')}) · el validador no encontró problemas`)
