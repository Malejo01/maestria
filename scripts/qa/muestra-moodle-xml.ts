/**
 * Ronda T · F1 — El archivo Moodle XML de muestra: un cuestionario con cada
 * tipo de pregunta que exporta MaestrIA, para importarlo en un Moodle de
 * prueba (Banco de preguntas > Importar > Formato Moodle XML).
 *
 *   npx tsx scripts/qa/muestra-moodle-xml.ts
 *
 * Escribe docs/moodle/muestra-ronda-t.xml y lo pasa por el validador. No toca
 * la base ni llama a la IA. Cada ítem de F2 a F7 suma su tipo acá.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { convertQuizToMoodleXml } from '../../lib/moodle-xml'
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
]

export function cuestionarioDeMuestra(): TeacherQuiz {
  return {
    id: 0,
    userId: 'muestra',
    teacherProgramId: 0,
    title: 'Muestra Moodle XML · ronda T',
    subjectName: 'Muestra MaestrIA',
    mode: 'mixto',
    status: 'saved',
    selectedTopics: [{ id: 'muestra', name: 'Ronda T' }],
    questionCount: PREGUNTAS_DE_MUESTRA.length,
    questions: PREGUNTAS_DE_MUESTRA,
    createdAt: '2026-11-22T00:00:00Z',
    updatedAt: '2026-11-22T00:00:00Z',
  } as TeacherQuiz
}

const xml = convertQuizToMoodleXml(cuestionarioDeMuestra())
const problemas = validarMoodleXml(xml)
if (problemas.length > 0) {
  console.error('El archivo no pasa el validador:\n' + problemas.join('\n'))
  process.exit(1)
}
mkdirSync('docs/moodle', { recursive: true })
writeFileSync('docs/moodle/muestra-ronda-t.xml', xml)
const tipos = [...xml.matchAll(/<question type="(\w+)">/g)].map((m) => m[1]).filter((t) => t !== 'category')
console.log(`docs/moodle/muestra-ronda-t.xml · ${tipos.length} preguntas (${[...new Set(tipos)].join(', ')}) · el validador no encontró problemas`)
