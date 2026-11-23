/**
 * Ronda X · X1 — Las pistas con el modelo real, sobre ocho preguntas de
 * niveles y materias distintas. Imprime cada pista para leerla, si hizo falta
 * pedir otra y el gasto. No escribe en ninguna base.
 *
 *   npx tsx scripts/qa/medir-pistas.ts --env=staging
 */
import { existsSync, readFileSync } from 'node:fs'
import type { Question } from '../../lib/types'

function leerEnv(archivo: string): Record<string, string> {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  )
}

if (!process.argv.includes('--env=staging')) {
  console.error('Sólo corre con --env=staging (no toca ninguna base).')
  process.exit(1)
}
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= leerEnv('.env.staging.local').GOOGLE_GENERATIVE_AI_API_KEY || leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY || ''

const b = { topic: 't', topicName: 'Tema', explanation: '' }
const CASOS: { nivel: string; grado: string; materia: string; q: Question }[] = [
  { nivel: 'primario', grado: '4', materia: 'Matemática', q: { ...b, id: '1', type: 'numeric', question: '¿Cuánto es 7 × 8?', correctAnswer: 56 } as Question },
  { nivel: 'secundario', grado: '2', materia: 'Matemática', q: { ...b, id: '2', type: 'short_answer', question: 'Resolvé: 3x + 5 = 20', acceptedAnswers: ['5', 'x = 5'] } as Question },
  { nivel: 'secundario', grado: '3', materia: 'Lengua', q: { ...b, id: '3', type: 'multiple_choice', question: '¿Qué tipo de texto busca convencer al lector?', options: ['Argumentativo', 'Narrativo', 'Descriptivo', 'Instructivo'], correctAnswer: 0 } as Question },
  { nivel: 'secundario', grado: '1', materia: 'Biología', q: { ...b, id: '4', type: 'true_false', question: 'La fotosíntesis ocurre en las mitocondrias.', correctAnswer: false } as Question },
  { nivel: 'superior', grado: '1', materia: 'Análisis Matemático', q: { ...b, id: '5', type: 'numeric', question: 'Calculá el límite de (x² − 4)/(x − 2) cuando x tiende a 2.', correctAnswer: 4 } as Question },
  { nivel: 'secundario', grado: '4', materia: 'Historia', q: { ...b, id: '6', type: 'multiple_choice', question: '¿En qué año se declaró la independencia argentina?', options: ['1810', '1816', '1853', '1880'], correctAnswer: 1 } as Question },
  { nivel: 'superior', grado: '2', materia: 'Química General', q: { ...b, id: '7', type: 'short_answer', question: '¿Cuál es el número de oxidación del oxígeno en el agua?', acceptedAnswers: ['-2'] } as Question },
  { nivel: 'primario', grado: '6', materia: 'Ciencias Sociales', q: { ...b, id: '8', type: 'multiple_choice', question: '¿Cuál es la capital de la provincia de Córdoba?', options: ['Rosario', 'Córdoba', 'Villa María', 'Río Cuarto'], correctAnswer: 1 } as Question },
]

async function main() {
  const { pensarPista } = await import('../../lib/pista-ia')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  let entrada = 0
  let salida = 0
  let sinPista = 0
  for (const c of CASOS) {
    const pista = await pensarPista({
      question: c.q,
      nivel: c.nivel,
      grado: c.grado,
      materia: c.materia,
      onUsage: (u) => {
        entrada += u?.inputTokens ?? 0
        salida += u?.outputTokens ?? 0
      },
    })
    if (!pista) sinPista++
    console.log(`\n[${c.nivel} · ${c.materia}] ${c.q.question}\n  → ${pista ?? '(sin pista: regalaba la respuesta)'}`)
  }
  console.log(`\nSin pista: ${sinPista} de ${CASOS.length}. Gasto: US$${estimateCostUsd(AI_MODEL, entrada, salida).toFixed(4)}`)
}
main()
