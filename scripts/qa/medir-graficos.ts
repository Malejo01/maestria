/**
 * Ronda X · X3 — ¿La IA usa el gráfico en temas de funciones? Genera, con el
 * modelo real y contra staging (sólo lectura), un cuestionario de 8 preguntas
 * para tres temas de funciones y uno de control sin funciones. Cuenta cuántas
 * traen gráfico, cuántos se pudieron dibujar y muestra las expresiones.
 *
 *   npx tsx scripts/qa/medir-graficos.ts --env=staging
 */
import { existsSync, readFileSync } from 'node:fs'

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
  console.error('Sólo corre contra staging: agregá --env=staging.')
  process.exit(1)
}
process.env.DATABASE_URL = leerEnv('.env.staging.local').DATABASE_URL
process.env.GOOGLE_GENERATIVE_AI_API_KEY ||= leerEnv('.env.staging.local').GOOGLE_GENERATIVE_AI_API_KEY || leerEnv('.env.local').GOOGLE_GENERATIVE_AI_API_KEY || ''

const CASOS = [
  { materia: 'Matemática', nivel: 'Secundario', grado: '4', tema: 'Función cuadrática: raíces, vértice y gráfico' },
  { materia: 'Matemática', nivel: 'Secundario', grado: '3', tema: 'Función lineal: pendiente y ordenada al origen' },
  { materia: 'Análisis Matemático I', nivel: 'Superior', grado: '1', tema: 'Funciones exponencial y logarítmica' },
  { materia: 'Matemática', nivel: 'Secundario', grado: '1', tema: 'Fracciones equivalentes' },
]

async function main() {
  const { generateQuiz } = await import('../../lib/quiz-generation')
  const { limpiarGrafico } = await import('../../lib/grafico')
  const { estimateCostUsd } = await import('../../lib/ai-usage')
  const { AI_MODEL } = await import('../../lib/ai-model')
  let entrada = 0
  let salida = 0
  for (const c of CASOS) {
    const topics = [{ id: 't1', name: c.tema }]
    const r = await generateQuiz(
      {
        subject: c.materia,
        subjectUnits: [{ name: 'Funciones', topics }],
        topics,
        mode: 'practico',
        previousQuestions: [],
        questionCount: 8,
        nivel: c.nivel,
        grado: c.grado,
        carrera: '',
        difficulty: 'intermedio',
        explicitQuestionTypes: ['multiple_choice', 'numeric', 'true_false'] as never[],
      },
      (u) => {
        entrada += u?.inputTokens ?? 0
        salida += u?.outputTokens ?? 0
      },
    )
    if (!r.ok) {
      console.log(`${c.tema}: ERROR ${r.message}`)
      continue
    }
    const con = r.questions.filter((q) => q.grafico)
    const dibujables = con.filter((q) => limpiarGrafico(q.grafico))
    console.log(`\n${c.tema}: ${con.length} de ${r.questions.length} con gráfico (${dibujables.length} dibujables)`)
    for (const q of con) console.log(`  · ${q.question.slice(0, 90)}\n    ${JSON.stringify(q.grafico)}`)
  }
  console.log(`\nGasto: US$${estimateCostUsd(AI_MODEL, entrada, salida).toFixed(4)}`)
}
main()
