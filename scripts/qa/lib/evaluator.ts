/**
 * El evaluador: Claude aplicando la rúbrica sobre lo que generó Gemini.
 *
 * Modelo distinto del generador a propósito. Si el mismo modelo genera y juzga,
 * comparte sus puntos ciegos con su propio trabajo y el informe queda ciego
 * exactamente donde importa.
 *
 * Dos decisiones que valen la pena explicar:
 *
 * 1. `messages.parse()` con salida estructurada nativa, no `generateObject` del
 *    AI SDK. El schema se garantiza del lado del servidor, así que este módulo
 *    no necesita la capa de reparación de JSON que /api/generate-quiz tuvo que
 *    construir a mano para Gemini (repairQuizJson + extractFirstJsonObject +
 *    validación tolerante, unas 300 líneas). No hay razón para pagar ese costo
 *    dos veces.
 *
 * 2. El prompt está partido en prefijo estable (rúbrica + persona + currículum)
 *    y sufijo volátil (las preguntas). El prefijo lleva `cache_control`, así que
 *    iterar la rúbrica sobre el mismo fixture lee caché a 0,1× en vez de pagar
 *    entrada completa en cada vuelta.
 */
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { Question } from '../../../lib/types'
import type { Persona } from '../../../lib/qa/personas'
import { dimensionsForPersona } from '../../../lib/qa/personas'
import {
  DIMENSION_RUBRICS,
  SEVERITY_ANCHORS,
  evaluationSchema,
  validateFindings,
  type Finding,
  type LlmDimension,
} from '../../../lib/qa/rubric'
import type { GroundTruth } from './curriculum-ground-truth'

/** Por defecto Claude Opus 5. Empezar caro y bajar después de calibrar, no al revés. */
export const DEFAULT_EVALUATOR_MODEL = 'claude-opus-5'

/**
 * USD por millón de tokens. Mismo criterio que lib/ai-usage.ts: un solo lugar
 * donde tocar el precio. Lectura de caché a 0,1× y escritura a 1,25×.
 */
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
}

export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface EvaluateOptions {
  persona: Persona
  materia: string
  groundTruth: GroundTruth
  questions: Question[]
  model?: string
  effort?: Effort
}

export interface EvaluationResult {
  findings: Finding[]
  summary: string
  dimensionsEvaluated: LlmDimension[]
  droppedFindings: number
  costUsd: number
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
  }
}

/**
 * Falla ruidoso si no hay clave. Sin esto el SDK tira un error de auth genérico
 * en la primera llamada, después de haber armado todo el prompt — y peor,
 * cualquier degradación silenciosa acá haría creer que un agente se calibró
 * cuando en realidad nunca corrió.
 */
export function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key || key.trim().length === 0) {
    throw new Error(
      'Falta ANTHROPIC_API_KEY.\n' +
        '  El evaluador es Claude y no hay camino alternativo: sin clave no se corre nada.\n' +
        '  Agregala a .env.staging.local (o exportala) y volvé a intentar.\n' +
        '  No hay degradación a otro modelo a propósito: evaluar con el mismo modelo que genera\n' +
        '  es justamente lo que este diseño evita.'
    )
  }
  return key
}

export function estimateCostUsd(
  model: string,
  usage: EvaluationResult['usage']
): number {
  const pricing = PRICING_USD_PER_MTOK[model] ?? PRICING_USD_PER_MTOK[DEFAULT_EVALUATOR_MODEL]
  const cost =
    (usage.inputTokens / 1_000_000) * pricing.input +
    (usage.cacheReadTokens / 1_000_000) * pricing.input * 0.1 +
    (usage.cacheWriteTokens / 1_000_000) * pricing.input * 1.25 +
    (usage.outputTokens / 1_000_000) * pricing.output

  return Math.round(cost * 1_000_000) / 1_000_000
}

/** Prefijo estable: no depende de las preguntas, así que se cachea. */
export function buildSystemPrompt(
  persona: Persona,
  materia: string,
  groundTruth: GroundTruth
): string {
  const dimensions = dimensionsForPersona(persona)
  const rubrics = dimensions.map((dimension) => DIMENSION_RUBRICS[dimension]).join('\n\n')

  return `Sos un evaluador de calidad pedagógica. NO generás preguntas: juzgás las que te pasan.

${persona.expertRubric}

CONTEXTO DE LA EVALUACIÓN
- Nivel: ${persona.nivel}
- Grado/Año: ${persona.grado}
- Materia: ${materia}${persona.carrera ? `\n- Carrera: ${persona.carrera}` : ''}

${groundTruth.text}

DIMENSIONES A EVALUAR (exactamente estas ${dimensions.length}, ninguna más)

${rubrics}

${SEVERITY_ANCHORS}

CÓMO REPORTAR
- Un finding por defecto concreto en una pregunta concreta. Si no podés nombrar el defecto en
  una línea, no hay defecto: no lo reportes.
- "Podría ser mejor" no es un finding. "Se acortaría" no es un finding.
- Una pregunta sin defectos no genera ningún finding. El silencio es una respuesta válida y
  esperada: un informe que marca todo se ignora, y un informe ignorado no sirve para nada.
- questionIndex es 0-based sobre la lista que te paso, en el orden en que te la paso.
- justification: una sola oración, concreta, citando lo que está mal.
- summary: 2 a 4 oraciones sobre el conjunto. Si hay un patrón que se repite entre preguntas,
  nombralo — es más útil que la suma de los findings individuales.
- No evalúes ortografía ni LaTeX: eso lo revisa un chequeo determinista aparte.`
}

/** Sufijo volátil: las preguntas concretas de esta corrida. */
export function buildUserPrompt(questions: Question[]): string {
  const serialized = questions
    .map((question, index) => {
      const lines = [`[${index}] tipo: ${question.type}`, `enunciado: ${question.question}`]

      if (question.type === 'multiple_choice') {
        question.options.forEach((option, optionIndex) => {
          const marker = optionIndex === question.correctAnswer ? ' ← marcada como CORRECTA' : ''
          lines.push(`  opción ${optionIndex}: ${option}${marker}`)
        })
      } else if (question.type === 'short_answer') {
        lines.push(`respuestas aceptadas: ${JSON.stringify(question.acceptedAnswers)}`)
      } else if (question.type === 'true_false') {
        lines.push(`respuesta correcta: ${question.correctAnswer}`)
      } else if (question.type === 'numeric') {
        lines.push(
          `respuesta correcta: ${question.correctAnswer}${question.tolerance != null ? ` (tolerancia ${question.tolerance})` : ' (sin tolerancia)'}`
        )
      }

      if (question.explanation) lines.push(`explicación al alumno: ${question.explanation}`)
      return lines.join('\n')
    })
    .join('\n\n')

  return `Evaluá estas ${questions.length} preguntas.\n\n${serialized}`
}

export async function evaluate(options: EvaluateOptions): Promise<EvaluationResult> {
  const model = options.model ?? DEFAULT_EVALUATOR_MODEL
  const effort = options.effort ?? 'high'
  const client = new Anthropic({ apiKey: requireApiKey() })
  const dimensions = dimensionsForPersona(options.persona)

  const response = await client.messages.parse({
    model,
    max_tokens: 16000,
    system: [
      {
        type: 'text',
        text: buildSystemPrompt(options.persona, options.materia, options.groundTruth),
        // El prefijo no cambia entre preguntas ni entre iteraciones de la misma
        // rúbrica: es exactamente lo que conviene cachear.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserPrompt(options.questions) }],
    output_config: {
      format: zodOutputFormat(evaluationSchema),
      effort,
    },
  })

  const parsed = response.parsed_output
  if (!parsed) {
    throw new Error(
      `El evaluador no devolvió una respuesta que valide contra el schema (stop_reason: ${response.stop_reason}).`
    )
  }

  const stamped: Finding[] = parsed.findings.map((finding) => ({ ...finding, source: 'model' as const }))
  const { valid, dropped } = validateFindings(stamped, options.questions.length)

  const usage = {
    inputTokens: response.usage.input_tokens ?? 0,
    outputTokens: response.usage.output_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
  }

  return {
    findings: valid,
    summary: parsed.summary,
    dimensionsEvaluated: dimensions,
    droppedFindings: dropped.length,
    costUsd: estimateCostUsd(model, usage),
    usage,
  }
}
