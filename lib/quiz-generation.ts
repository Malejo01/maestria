/**
 * Núcleo de generación de cuestionarios.
 *
 * Vivía dentro de app/api/generate-quiz/route.ts, lo que lo hacía imposible de
 * ejercitar sin levantar un servidor. Acá adentro no hay nada de HTTP: ni
 * Request, ni Response, ni sesión, ni rate limit. La ruta sigue siendo dueña de
 * todo eso y de la fila de `ai_usage_log`; este módulo sólo sabe pedirle
 * preguntas a Gemini y devolverlas limpias.
 *
 * Es una extracción sin cambio de comportamiento. Los tests de caracterización
 * de app/api/generate-quiz/route.test.ts se escribieron contra la ruta ANTES de
 * mover una línea y tienen que seguir pasando sin tocarse — ése es el contrato.
 * Si hay que elegir entre "más prolijo" y "idéntico", gana idéntico: los `any`
 * y las ramas tolerantes de abajo están tal como estaban.
 */
import { generateObject, generateText, type RepairTextFunction } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { buildEducationSystemPrompt, type ContextoProfesionalCarrera } from '@/lib/education-context'
import { captureAiSchemaFailure, captureRouteFailure } from '@/lib/observability'
import type { AiSdkUsage } from '@/lib/ai-usage'
import { normalizeQuestionText, numericSignature } from '@/lib/question-dedup'
import {
  buildQuestionMixInstruction,
  mergeQuestionTypeMixes,
  parseQuestionTypeMix,
  questionTypesFromMix,
  restrictQuestionTypeMix,
  type QuestionTypeMix,
} from '@/lib/question-mix'
import { sql } from '@/lib/db'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Schema Zod — un tipo por variante, discriminado por "type". Agregar un tipo
// nuevo (essay, matching...) es sumar una variante acá + un caso en el switch
// de PROMPT_FIELD_BLOCKS + un caso en el switch de shuffle más abajo.
const baseQuestionFields = {
  id: z.string().optional(),
  topic: z.string().optional(),
  topicName: z.string().optional(),
  question: z.string(),
  explanation: z.string(),
}

const multipleChoiceQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal('multiple_choice'),
  options: z.array(z.string()),
  correctAnswer: z.number(),
})

const shortAnswerQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal('short_answer'),
  acceptedAnswers: z.array(z.string()).min(1),
})

const trueFalseQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal('true_false'),
  correctAnswer: z.boolean(),
})

const numericQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal('numeric'),
  correctAnswer: z.number(),
  tolerance: z.number().optional(),
})

const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  shortAnswerQuestionSchema,
  trueFalseQuestionSchema,
  numericQuestionSchema,
])

export const quizSchema = z.object({
  questions: z.array(questionSchema),
}).transform(data => ({
  questions: data.questions.map((q, idx) => ({
    ...q,
    id: q.id || `q${idx + 1}`,
    topic: q.topic || 'unknown',
    topicName: q.topicName || 'Unknown Topic',
  }))
}))

/**
 * Una pregunta ya validada por `quizSchema`.
 *
 * Sale del propio esquema Zod en vez de escribirse a mano: es la única forma de
 * que no se desincronice cuando se agregue un tipo de pregunta nuevo. Describe
 * lo que la generación DEVUELVE; adentro del módulo las preguntas siguen
 * viajando sin tipo mientras se reparan y se barajan, que es donde todavía no
 * hay garantías que ofrecer.
 */
export type GeneratedQuestion = z.infer<typeof quizSchema>['questions'][number]

export const QUESTION_TYPE_VALUES = ['multiple_choice', 'short_answer', 'true_false', 'numeric'] as const
export type QuestionType = (typeof QUESTION_TYPE_VALUES)[number]

const PROMPT_FIELD_BLOCKS: Record<QuestionType, string> = {
  multiple_choice: `TIPO "multiple_choice":
- type: "multiple_choice"
- options: array de 4 strings
- correctAnswer: number (índice 0-based de la opción correcta)`,
  short_answer: `TIPO "short_answer":
- type: "short_answer"
- acceptedAnswers: array de 1 a 3 strings con respuestas correctas aceptadas (variantes cortas, sin explicación)`,
  true_false: `TIPO "true_false":
- type: "true_false"
- correctAnswer: boolean (true o false)`,
  numeric: `TIPO "numeric":
- type: "numeric"
- correctAnswer: number
- tolerance: number opcional (margen de error aceptado, omitir si la respuesta debe ser exacta)`,
}

function buildTypeInstructions(
  questionTypes: QuestionType[],
  questionMix: QuestionTypeMix | undefined,
  questionCount: number
): string {
  const blocks = questionTypes.map((type) => PROMPT_FIELD_BLOCKS[type]).join('\n\n')
  const typesList = questionTypes.join(', ')

  // Con mezcla declarada, el reparto es numérico y explícito; sin ella queda el
  // "de forma pareja" de siempre, que es lo que ve todo K-12.
  const mixInstruction = buildQuestionMixInstruction(questionMix, questionCount)
  const distribution = mixInstruction || 'Distribuí las preguntas de forma pareja entre los tipos solicitados.'

  return `CAMPOS COMUNES A TODA PREGUNTA (además de los específicos del tipo):
- id: string (ej: "q1", "q2")
- topic: string (ID del tema)
- topicName: string (nombre del tema)
- question: string (enunciado adaptado a la edad, con LaTeX entre $ si aplica)
- explanation: string (2-4 frases con tono empático y lenguaje acorde a la edad del estudiante)

TIPOS DE PREGUNTA A GENERAR (usa el campo "type" con EXACTAMENTE uno de estos valores: ${typesList}):

${blocks}
${questionTypes.length > 1
  ? `
${distribution}

MUY IMPORTANTE — NO REPITAS EL MISMO EJERCICIO EN DOS FORMATOS:
Dos preguntas son la MISMA aunque cambien de tipo o de redacción si se resuelven
con la misma cuenta o evalúan el mismo caso puntual. Por ejemplo, "¿Cuál es el
resultado de $7^2$?" (opción múltiple) y "Si calculamos el cuadrado de 7, ¿qué
número obtenemos?" (respuesta corta) son la misma pregunta disfrazada: está mal.
Cada pregunta tiene que usar números o casos DISTINTOS de las demás, no solo
otro formato.`
  : ''}`
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Shuffles options + remaps correctAnswer for multiple_choice only — every
 *  other type has no options array to shuffle, so it passes through as-is. */
function shuffleAndRenumber(question: any, newId: string): any {
  if (question.type !== 'multiple_choice') {
    return { ...question, id: newId }
  }

  const optionsWithIndex = question.options.map((text: string, index: number) => ({ text, index }))
  shuffleInPlace(optionsWithIndex)

  const newOptions = optionsWithIndex.map((o: { text: string }) => o.text)
  const newCorrectAnswer = optionsWithIndex.findIndex((o: { index: number }) => o.index === question.correctAnswer)

  return {
    ...question,
    id: newId,
    options: newOptions,
    correctAnswer: newCorrectAnswer,
  }
}

export const repairQuizJson: RepairTextFunction = async ({ text }) => {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  // First, try to find and extract the JSON object
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    console.warn('[repairQuizJson] No JSON structure found')
    return null
  }

  let candidate = match[0]

  // Remove trailing commas before } or ]
  candidate = candidate.replace(/,\s*([}\]])/g, '$1')

  // Fix common escaping issues
  // Single backslash followed by non-escape character becomes double backslash
  candidate = candidate.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')

  // Fix unescaped quotes inside strings (common issue)
  // This is tricky - try to fix common patterns
  candidate = candidate.replace(/: "([^"]*)"([^,}\]])/g, (match, content, next) => {
    // If content has unescaped quotes, escape them
    const fixed = content.replace(/([^\\])"/g, '$1\\"')
    return `: "${fixed}"${next}`
  })

  console.log('[repairQuizJson] Repairs applied, length:', candidate.length)
  return candidate
}

/**
 * Escapes `\uXXXX` que llegaron como TEXTO al alumno (ids 1430-1448 del 10/08:
 * un intento entero leyó "parábola").
 *
 * Reproducido el 25/08/2026: el modelo emite `par\\u00e1bola` — doble
 * backslash, el mismo hábito con el que escribe `\\frac` para que el JSON
 * signifique `\frac`, aplicado donde no corresponde. Eso es JSON VÁLIDO cuyo
 * valor es el texto literal `parábola`, así que ni `repairQuizJson` ni el
 * parser tienen nada que arreglar: la regex de reparación (que la nota del
 * backlog señalaba como sospechosa) nunca toca `\u` — está en su lookahead de
 * exclusión — y el parse sale bien. El defecto sólo se ve acá, después de
 * parsear.
 *
 * Acotado a la mitad ALTA de Latin-1 (``-`ÿ`), el mismo recorte que
 * la regla del lint (lib/qa/lint-questions.ts) y por la misma razón: ahí viven
 * las tildes y los `¿¡` del castellano, y un `A` literal puede ser el tema
 * legítimo de una pregunta de sistemas sobre codificación.
 */
function decodeStrandedUnicodeEscapes(text: string): string {
  return text.replace(/\\u00([89a-fA-F][0-9a-fA-F])/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16))
  )
}

function normalizeLogicalNotation(text: string): string {
  return decodeStrandedUnicodeEscapes(text)
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\wedge/g, '∧')
    .replace(/\\vee/g, '∨')
    .replace(/\\neg\s*/g, '¬')
    // Recover already-corrupted tokens like "egp" or "eg(q∨r)".
    .replace(/(^|[\s(])eg(?=[a-zA-Z(])/gi, '$1¬')
}

function normalizeQuestionSetLogicalNotation(questions: any[]) {
  return questions.map((question) => ({
    ...question,
    question: normalizeLogicalNotation(String(question.question || '')),
    explanation: normalizeLogicalNotation(String(question.explanation || '')),
    ...(Array.isArray(question.options)
      ? { options: question.options.map((option: unknown) => normalizeLogicalNotation(String(option))) }
      : {}),
    // Sólo la decodificación, no la notación lógica: acá el texto es lo que se
    // compara contra lo que tipea el alumno, y `á` varado ahí hace
    // incorregible la pregunta igual que en el enunciado.
    ...(Array.isArray(question.acceptedAnswers)
      ? {
          acceptedAnswers: question.acceptedAnswers.map((answer: unknown) =>
            decodeStrandedUnicodeEscapes(String(answer))
          ),
        }
      : {}),
  }))
}

export function cleanGeminiResponse(text: string): string {
  // Remove markdown code blocks
  let cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  // Remove "json" prefix if it appears at the start
  cleaned = cleaned.replace(/^json\s*/i, '')

  // Remove common prefixes/suffixes Gemini adds
  cleaned = cleaned.replace(/^Here.*?:?\s*/i, '')
  cleaned = cleaned.replace(/^Response.*?:?\s*/i, '')

  // Remove trailing text after the last }
  const lastBrace = cleaned.lastIndexOf('}')
  if (lastBrace !== -1) {
    cleaned = cleaned.substring(0, lastBrace + 1)
  }

  return cleaned.trim()
}

export function extractFirstJsonObject(text: string): string | null {
  // Try direct brace match first
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()

  // Find the first { and last }
  const firstBrace = cleaned.indexOf('{')
  if (firstBrace === -1) {
    console.warn('[extractFirstJsonObject] No opening brace found')
    return null
  }

  let braceCount = 0
  let lastValidBrace = -1

  for (let i = firstBrace; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++
    else if (cleaned[i] === '}') {
      braceCount--
      if (braceCount === 0) {
        lastValidBrace = i
        break
      }
    }
  }

  if (lastValidBrace === -1) {
    console.warn('[extractFirstJsonObject] Mismatched braces, braceCount ended at:', braceCount)
    return null
  }

  const extracted = cleaned.substring(firstBrace, lastValidBrace + 1)
  console.log('[extractFirstJsonObject] Extracted JSON length:', extracted.length)
  return extracted
}

async function generateQuizBatchWithFallback({
  subject,
  curriculum,
  modeDescription,
  topicsText,
  questionCount,
  previousNote,
  pedagogyNote,
  specialistRole,
  difficulty,
  nivel,
  grado,
  contextoProfesional,
  questionTypes,
  questionMix,
  onUsage,
}: {
  subject: string
  curriculum: string
  modeDescription: string
  topicsText: string
  questionCount: number
  previousNote: string
  pedagogyNote: string
  specialistRole: string
  difficulty: string
  nivel?: string
  grado?: string
  contextoProfesional?: ContextoProfesionalCarrera
  questionTypes: QuestionType[]
  /** Reparto por tipo que declara el programa de cátedra (migración 023). */
  questionMix?: QuestionTypeMix
  /**
   * Se invoca por CADA llamada al modelo, incluidas las del camino de fallback.
   * Una sola request puede gastar tres veces lo que sugiere su única fila de
   * rate limit, y el dashboard tiene que reflejarlo.
   */
  onUsage?: (usage: AiSdkUsage | undefined) => void
}) {
  const educationPrompt = buildEducationSystemPrompt({
    nivel,
    grado,
    materia: subject,
    difficulty,
    contextoProfesional,
  })

  const systemPrompt = `${educationPrompt}
${specialistRole ? `\nASPECTO ADICIONAL DE MATERIA: ${specialistRole}` : ''}

Tu única tarea es generar un objeto JSON que contenga un array de preguntas.
ADAPTA el estilo de las preguntas estrictamente a la materia solicitada (${subject}) y al nivel/grado del estudiante.

INSTRUCCIONES CRÍTICAS:
1. Genera EXACTAMENTE ${questionCount} preguntas.
2. Responde SOLO con JSON válido. Sin markdown, sin explicaciones fuera del JSON, sin comentarios.
3. Estructura: { "questions": [ { ...campos según tipo... }, ... ] }

FORMATO ESTRICTO PARA CONTENIDO MATEMÁTICO (si aplica):
- TODO contenido matemático debe estar entre $...$
- Usa LaTeX estándar: \\frac{a}{b}, \\sqrt{x}, x^2, etc.
- Operadores lógicos: $p \\wedge q$ (y), $p \\vee q$ (o), $\\neg p$ (no), $p \\rightarrow q$ (si...entonces), $p \\leftrightarrow q$ (si y solo si)
- Escapa backslashes: \\\\frac, \\\\sqrt, \\\\wedge (dos barras en JSON)

${buildTypeInstructions(questionTypes, questionMix, questionCount)}`

  const userPrompt = `Genera ${questionCount} preguntas para: ${subject}

CURRICULUM:
${curriculum}

MODO: ${modeDescription}

TEMAS: ${topicsText}

${previousNote}
${pedagogyNote}

IMPORTANTE: Responde SOLO JSON válido comenzando con { y terminando con }`

  try {
    const { object, usage } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: quizSchema,
      schemaName: 'quizQuestions',
      schemaDescription: `Objeto JSON con exactamente ${questionCount} preguntas, cada una con los campos correspondientes a su "type" (${questionTypes.join(', ')}).`,
      experimental_repairText: repairQuizJson,
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 8000,
      temperature: 0.3,
    })
    onUsage?.(usage)

    console.log('[generateObject] Success! Questions:', object.questions.length)
    return normalizeQuestionSetLogicalNotation(object.questions)
  } catch (primaryError: any) {
    // El alumno no ve nada raro: el fallback suele salvar la generación. Pero
    // cada vez que esto pasa se paga el doble de tokens y baja la calidad, así
    // que un pico acá es la señal de que cambió el modelo o el prompt.
    captureAiSchemaFailure(primaryError, {
      endpoint: '/api/generate-quiz',
      fallback: 'generateText',
      nivel,
      subject,
    })
    console.warn('[generateObject] Primary parse failed, retrying with generateText:', primaryError?.message)

    let rawText = ''
    for (let retryAttempt = 0; retryAttempt < 2; retryAttempt++) {
      try {
        const response = await generateText({
          model: google('gemini-2.5-flash'),
          system: systemPrompt,
          prompt: userPrompt,
          maxOutputTokens: 8000,
          temperature: 0.2,
        })
        rawText = response.text
        onUsage?.(response.usage)
        console.log(`[generateText] Attempt ${retryAttempt + 1} succeeded, length: ${rawText.length}`)
        break
      } catch (textGenErr) {
        console.warn(`[generateText] Attempt ${retryAttempt + 1} failed:`, textGenErr)
        if (retryAttempt === 1) throw textGenErr
      }
    }

    const text = cleanGeminiResponse(rawText)
    console.log('[cleanGeminiResponse] Before:', rawText.length, 'After:', text.length)
    console.log('[cleanGeminiResponse] First 300 chars:', text.substring(0, 300))

    const repaired = await repairQuizJson({ text, error: undefined as any })
    console.log('[repairQuizJson] Result:', repaired ? `Success (${repaired.length} chars)` : 'Failed')

    const jsonCandidate = repaired ?? extractFirstJsonObject(text)

    if (!jsonCandidate) {
      console.error('[fallback] Could not extract JSON after repair and extraction')
      console.error('[fallback] Cleaned response:', text.substring(0, 800))
      throw new Error('No object generated: could not parse the response.')
    }

    console.log('[jsonCandidate] Length:', jsonCandidate.length, 'Starts:', jsonCandidate.substring(0, 50))

    let parsed: any
    try {
      parsed = JSON.parse(jsonCandidate)
      console.log('[JSON.parse] ✓ Success, type:', typeof parsed)
      console.log('[JSON.parse] Top-level keys:', Object.keys(parsed).join(', '))
    } catch (parseErr: any) {
      console.error('[JSON.parse] ✗ Failed:', parseErr.message)
      console.error('[JSON.parse] Error at position:', parseErr.pos)
      console.error('[JSON.parse] Around error:', jsonCandidate.substring(Math.max(0, (parseErr.pos || 0) - 50), (parseErr.pos || 0) + 50))
      throw new Error('No object generated: could not parse the response.')
    }

    // Lenient validation - ensure we have a questions array
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('[validation] ✗ Missing or invalid questions array')
      throw new Error('No object generated: invalid quiz schema.')
    }

    console.log('[validation] ✓ Found questions array with', parsed.questions.length, 'items')

    if (parsed.questions.length === 0) {
      console.error('[validation] ✗ Empty questions array')
      throw new Error('No object generated: empty questions array.')
    }

    // Validate with lenient schema
    const validated = quizSchema.safeParse(parsed)
    if (!validated.success) {
      const errors = validated.error.issues.map(i => `${i.path.join('.')} - ${i.message}`).join('; ')
      console.error('[Zod validation] ✗ Failed on', validated.error.issues.length, 'issue(s)')
      console.error('[Zod validation] Errors:', errors.substring(0, 500))

      // If only some questions are invalid, try to use valid ones. This is a
      // last-resort text-repair path (primary generateObject + JSON repair
      // both failed) — a missing "type" here defaults to multiple_choice,
      // since that's the only type in practice until questionTypes carries
      // more than one entry through a real caller.
      if (parsed.questions && Array.isArray(parsed.questions)) {
        const validQuestions = parsed.questions
          .map((q: any) => ({ ...q, type: q.type || 'multiple_choice' }))
          .filter((q: any) => {
            if (!q.question || !q.explanation) return false
            switch (q.type) {
              case 'multiple_choice':
                return Array.isArray(q.options) && q.options.length > 0 && typeof q.correctAnswer === 'number'
              case 'true_false':
                return typeof q.correctAnswer === 'boolean'
              case 'numeric':
                return typeof q.correctAnswer === 'number'
              case 'short_answer':
                return Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0
              default:
                return false
            }
          })

        if (validQuestions.length > 0) {
          console.warn(`[Zod validation] ⚠ Using ${validQuestions.length}/${parsed.questions.length} valid questions`)
          const normalizedValidQuestions = validQuestions.map((q: any, idx: number) => ({
            ...q,
            id: q.id || `q${idx + 1}`,
            topic: q.topic || 'unknown',
            topicName: q.topicName || 'Unknown Topic',
            correctAnswer: q.type === 'multiple_choice' || q.type === 'numeric' ? Number(q.correctAnswer) : q.correctAnswer,
          }))

          return normalizeQuestionSetLogicalNotation(normalizedValidQuestions)
        }
      }

      throw new Error('No object generated: invalid quiz schema.')
    }

    console.log('[generateObject fallback] ✓ Success! Returning', validated.data.questions.length, 'questions')
    return normalizeQuestionSetLogicalNotation(validated.data.questions)
  }
}

async function generateQuizBatch(params: Parameters<typeof generateQuizBatchWithFallback>[0]) {
  return generateQuizBatchWithFallback(params)
}

function interleaveQuestions(teoricoQuestions: any[], practicoQuestions: any[], total: number) {
  const mixed = []
  const maxLength = Math.max(teoricoQuestions.length, practicoQuestions.length)

  for (let i = 0; i < maxLength && mixed.length < total; i++) {
    if (teoricoQuestions[i]) mixed.push(teoricoQuestions[i])
    if (practicoQuestions[i] && mixed.length < total) mixed.push(practicoQuestions[i])
  }

  return mixed.slice(0, total)
}

function buildCurriculumFromUnits(subject: string, units: any[]): string {
  if (!units || units.length === 0) {
    return `Materia: ${subject}`
  }

  const unitsText = units
    .map((unit: any) => {
      const topicsText = unit.topics
        ?.map((topic: any) => `  - ${topic.name}`)
        .join('\n') || ''
      return `${unit.name}:\n${topicsText}`
    })
    .join('\n\n')

  return `PROGRAMA DE ${subject.toUpperCase()}:\n\n${unitsText}`
}

function getSpecialistRole(subject: string): string {
  const subjectLower = subject.toLowerCase()
  if (subjectLower.includes('matemát') || subjectLower.includes('matemat') || subjectLower.includes('álgebra') || subjectLower.includes('algebra') || subjectLower.includes('análisis') || subjectLower.includes('analisis') || subjectLower.includes('cálculo') || subjectLower.includes('calculo') || subjectLower.includes('probabilidad') || subjectLower.includes('estadística') || subjectLower.includes('estadistica')) {
    return `Eres un experto generador de exámenes de matemáticas especializado en ${subject}.`
  }
  if (subjectLower.includes('programación') || subjectLower.includes('informatica') || subjectLower.includes('computación')) {
    return `Eres un experto generador de exámenes de programación e informática especializado en ${subject}.`
  }
  if (subjectLower.includes('física') || subjectLower.includes('mecanica')) {
    return `Eres un experto generador de exámenes de física especializado en ${subject}.`
  }
  if (subjectLower.includes('química') || subjectLower.includes('quimica')) {
    return `Eres un experto generador de exámenes de química especializado en ${subject}.`
  }
  if (subjectLower.includes('historia') || subjectLower.includes('geografía')) {
    return `Eres un experto generador de exámenes de historia y geografía especializado en ${subject}.`
  }
  if (subjectLower.includes('idioma') || subjectLower.includes('lengua') || subjectLower.includes('english') || subjectLower.includes('español')) {
    return `Eres un experto generador de exámenes de idiomas especializado en ${subject}.`
  }
  if (subjectLower.includes('derecho') || subjectLower.includes('leyes')) {
    return `Eres un experto generador de exámenes de derecho especializado en ${subject}.`
  }

  return `Eres un experto generador de exámenes universitarios especializado en ${subject}.`
}


/** Lo que el programa de cátedra le aporta al prompt, en una sola consulta. */
interface CurriculumPedagogy {
  contextoProfesional?: ContextoProfesionalCarrera
  /** Suma de las mezclas de las unidades elegidas. Ver lib/question-mix.ts. */
  questionMix?: QuestionTypeMix
}

/**
 * Trae de `curriculum` lo que las unidades elegidas declaran sobre cómo evaluar:
 * la aplicación profesional (migración 022) y la mezcla de tipos de pregunta
 * (migración 023).
 *
 * Cada campo devuelve `undefined` —y no un objeto vacío— cuando no aplica, para
 * que el prompt omita la sección entera en vez de inyectar un encabezado sin
 * contenido. No aplica nada en tres casos: nivel distinto de Superior, carrera
 * ausente (el flujo de "subí tu programa" no tiene fila en curriculum), o un
 * programa que no declara nada en ninguna de sus unidades.
 *
 * Las dos cosas se leen del servidor y no se aceptan del body a propósito: son
 * texto y proporciones que entran al system prompt, y leyéndolas de `curriculum`
 * queda garantizado que lo que pide el prompt es lo que declara el programa de
 * cátedra, sin desactualizarse cuando el programa cambia.
 *
 * Una falla de base acá no puede tumbar la generación: sin esto el cuestionario
 * sale genérico y parejo, que es exactamente el comportamiento previo.
 */
async function loadCurriculumPedagogy({
  nivel,
  grado,
  materia,
  carrera,
  ejes,
}: {
  nivel?: string
  grado?: string
  materia: string
  carrera: string
  ejes: string[]
}): Promise<CurriculumPedagogy> {
  if (nivel !== 'Superior' || !carrera || !grado || ejes.length === 0) return {}

  try {
    const rows = (await sql`
      SELECT eje, contexto_profesional, tipos_pregunta_sugeridos
      FROM curriculum
      WHERE nivel   = 'Superior'
        AND carrera = ${carrera}
        AND grado   = ${grado}
        AND materia = ${materia}
        AND eje     = ANY(${ejes})
        AND (contexto_profesional IS NOT NULL OR tipos_pregunta_sugeridos IS NOT NULL)
      ORDER BY id
    `) as { eje: string; contexto_profesional: unknown; tipos_pregunta_sugeridos: unknown }[]

    const unidades = rows.flatMap((row) => {
      const value = row.contexto_profesional
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

      const record = value as Record<string, unknown>
      const aplicacion = typeof record.aplicacion === 'string' ? record.aplicacion.trim() : ''
      if (!aplicacion) return []

      const herramientas = Array.isArray(record.herramientas)
        ? record.herramientas.filter((item): item is string => typeof item === 'string')
        : []

      return [{ eje: row.eje, aplicacion, herramientas }]
    })

    const mixes = rows
      .map((row) => parseQuestionTypeMix(row.tipos_pregunta_sugeridos))
      .filter((mix): mix is QuestionTypeMix => mix !== undefined)

    return {
      contextoProfesional: unidades.length > 0 ? { carrera, unidades } : undefined,
      questionMix: mergeQuestionTypeMixes(mixes),
    }
  } catch (error) {
    captureRouteFailure(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/generate-quiz',
      operation: 'loadCurriculumPedagogy',
    })
    return {}
  }
}

/**
 * Unidad del programa tal como la manda el cliente.
 *
 * Todo opcional y `unknown` adentro porque viene del body sin validar: el único
 * consumidor es `buildCurriculumFromUnits`, que ya trata cada campo como
 * sospechoso. Tipar esto no valida nada — hace visible qué se espera.
 */
export interface QuizSubjectUnit {
  name?: unknown
  topics?: { name?: unknown }[]
}

/** Lo que la ruta necesita saber del cuerpo, ya normalizado. */
export interface QuizRequestParams {
  subject: string
  subjectUnits: QuizSubjectUnit[]
  topics: { id: string; name: string }[]
  mode: string
  previousQuestionIds?: string[]
  previousQuestions: { question?: string }[]
  pedagogyContext?: string
  questionCount: number
  nivel?: string
  grado?: string
  carrera: string
  difficulty: string
  /**
   * Sólo lo que el llamador pidió explícitamente; vacío si no pidió nada. El
   * tipo final lo decide `generateQuiz` una vez leído el currículum.
   */
  explicitQuestionTypes: QuestionType[]
  /**
   * Motivo por el que el docente rechazó la pregunta que se está reemplazando.
   * Sólo lo manda la regeneración de UNA pregunta; es efímero y no se guarda en
   * el programa. Ver el bloque que lo usa en generateQuiz.
   */
  rejectionNote?: string
}

export type ResolveQuizRequestResult =
  | { ok: true; params: QuizRequestParams }
  | { ok: false; error: string }

/**
 * Normaliza el cuerpo de la request.
 *
 * Va separado de `generateQuiz` porque la ruta necesita el `nivel` resuelto
 * ANTES de llamar al guard: el mensaje de corte por límite le habla distinto a
 * un chico de primaria que a un estudiante de terciario. Todo lo de acá es
 * parseo puro y no cuesta un token.
 */
export function resolveQuizRequest(body: unknown): ResolveQuizRequestResult {
  // `unknown` en la firma y el ensanche acá: el cuerpo llega de la red y no
  // está validado. El cast no promete que los campos tengan el tipo declarado
  // —abajo se los sigue tratando con `Number()`, `Array.isArray` y
  // `typeof`— pero deja escrito en un solo lugar qué campos se leen.
  const {
    subject,
    subjectUnits = [],
    topics,
    mode,
    previousQuestionIds,
    previousQuestions,
    pedagogyContext,
    questionCount: rawQuestionCount,
    nivel: rawNivel,
    grado: rawGrado,
    carrera: rawCarrera,
    difficulty: rawDifficulty,
    questionTypes: rawQuestionTypes,
  } = (body ?? {}) as {
    // subject, topics y mode van NO opcionales a propósito, y es una deuda
    // hecha visible: el código de abajo los usa sin chequear y `QuizRequestParams`
    // los declara requeridos, así que la suposición ya existía — el `any`
    // anterior sólo la escondía. Tiparlos como opcionales acá obliga a decidir
    // qué pasa cuando faltan, y eso cambia comportamiento: hay 29 tests de
    // caracterización que fijan el actual. Validarlos es trabajo aparte.
    subject: string
    subjectUnits?: QuizSubjectUnit[]
    topics: { id: string; name: string }[]
    mode: string
    previousQuestionIds?: string[]
    previousQuestions?: { question?: string }[]
    pedagogyContext?: string
    questionCount?: unknown
    nivel?: string
    grado?: string
    carrera?: unknown
    difficulty?: string
    questionTypes?: unknown
  }

  const parsedQuestionCount = Number(rawQuestionCount)
  const questionCount = Number.isInteger(parsedQuestionCount) && parsedQuestionCount >= 1 ? parsedQuestionCount : 10

  if (questionCount < 1 || questionCount > 50) {
    return { ok: false, error: 'La cantidad de preguntas debe estar entre 1 y 50.' }
  }

  // Lo que el llamador pidió explícitamente. Puede quedar vacío: el default no
  // se aplica acá porque depende de lo que declare el currículum, que se lee de
  // la base dentro de `generateQuiz`. La precedencia completa está documentada
  // en `resolveQuestionTypes`.
  const explicitQuestionTypes: QuestionType[] = Array.isArray(rawQuestionTypes)
    ? rawQuestionTypes.filter((t: unknown): t is QuestionType => QUESTION_TYPE_VALUES.includes(t as QuestionType))
    : []

  let nivel = rawNivel
  let grado = rawGrado
  let difficulty = rawDifficulty || 'intermedio'

  if (typeof pedagogyContext === 'string') {
    if (!nivel) {
      const matchNivel = pedagogyContext.match(/Nivel:\s*([a-zA-Záéíóúñ]+)/i)
      if (matchNivel && matchNivel[1]) nivel = matchNivel[1]
    }
    if (!grado) {
      // Stop at a newline or a pipe: callers send this context either as one
      // pipe-separated line (practicar) or as several labelled lines
      // (pedagogyProfileToContext). Matching across newlines swallowed every
      // following label into "grado" and poisoned the prompt with a 4-line blob.
      const matchGrado = pedagogyContext.match(/Grado(?:\/Año)?:\s*([^\n|]+)/i)
      if (matchGrado && matchGrado[1].trim()) grado = matchGrado[1].trim()
    }
    if (!rawDifficulty) {
      const matchDiff = pedagogyContext.match(/Dificultad:\s*([a-zA-Záéíóúñ]+)/i)
      if (matchDiff && matchDiff[1]) {
        const diffVal = matchDiff[1].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        if (['basico', 'intermedio', 'avanzado'].includes(diffVal)) {
          difficulty = diffVal
        }
      }
    }
  }

  return {
    ok: true,
    params: {
      subject,
      subjectUnits,
      topics,
      mode,
      previousQuestionIds,
      previousQuestions: Array.isArray(previousQuestions) ? previousQuestions : [],
      pedagogyContext,
      questionCount,
      nivel,
      grado,
      carrera: typeof rawCarrera === 'string' ? rawCarrera.trim() : '',
      difficulty,
      explicitQuestionTypes,
    },
  }
}

/**
 * Precedencia de tipos de pregunta.
 *
 * `tipos_pregunta_sugeridos` es un DEFAULT, no un candado — la columna dice
 * "sugeridos" y el comportamiento tiene que coincidir:
 *
 *   1. Lo que el llamador pidió explícitamente (el alumno destildó tipos en el
 *      selector, o el docente armó el cuestionario con los que quiso).
 *   2. Lo que sugiere el programa de cátedra para las unidades elegidas.
 *   3. multiple_choice, el default histórico para todo llamador sin nada de
 *      lo anterior.
 *
 * El paso 2 es el que corrige a los llamadores que hoy caen al 3 sin haber
 * elegido nada: sin él, un cuestionario de aula sigue saliendo 100% opción
 * múltiple aunque el programa pida lo contrario.
 */
function resolveQuestionTypes(
  explicitQuestionTypes: QuestionType[],
  suggestedMix: QuestionTypeMix | undefined
): QuestionType[] {
  if (explicitQuestionTypes.length > 0) return explicitQuestionTypes

  const suggested = questionTypesFromMix(suggestedMix)
  return suggested.length > 0 ? suggested : ['multiple_choice']
}

export type GenerateQuizResult =
  | { ok: true; questions: GeneratedQuestion[] }
  /** No se juntó variedad suficiente. La ruta lo traduce a un 409. */
  | { ok: false; reason: 'insufficient_variety'; message: string }

/**
 * Genera el cuestionario.
 *
 * Lanza cuando la IA falla de verdad: la ruta convierte eso en un 502 y cierra
 * la fila de uso como fallida. NO devuelve preguntas de relleno — eso se probó
 * y llegó a los alumnos como un cuestionario real con todas las preguntas
 * iguales y ninguna respuesta con sentido.
 */
export async function generateQuiz(
  params: QuizRequestParams,
  onUsage?: (usage: AiSdkUsage | undefined) => void
): Promise<GenerateQuizResult> {
  const {
    subject,
    subjectUnits,
    topics,
    mode,
    previousQuestionIds,
    previousQuestions,
    pedagogyContext,
    questionCount,
    nivel,
    grado,
    carrera,
    difficulty,
    explicitQuestionTypes,
    rejectionNote,
  } = params

  const topicsText = topics.map((t: { id: string; name: string }) => `- ${t.name}`).join('\n')
  const previousQuestionList = Array.isArray(previousQuestions) ? previousQuestions : []
  const previousQuestionTexts = previousQuestionList
    .map((question: { question?: string }) => question.question)
    .filter((question: string | undefined): question is string => Boolean(question))
  const previousQuestionFingerprints = new Set(previousQuestionTexts.map(normalizeQuestionText))

  const curriculum = buildCurriculumFromUnits(subject, subjectUnits)
  const specialistRole = getSpecialistRole(subject)

  // Lo que declara el programa de cátedra: contexto profesional (migración 022)
  // y mezcla sugerida de tipos de pregunta (migración 023).
  const { contextoProfesional, questionMix: suggestedMix } = await loadCurriculumPedagogy({
    nivel,
    grado,
    materia: subject,
    carrera,
    ejes: Array.isArray(subjectUnits)
      ? subjectUnits
          .map((unit: { name?: unknown }) => (typeof unit?.name === 'string' ? unit.name : ''))
          .filter((name: string) => name.length > 0)
      : [],
  })

  const finalQuestionTypes = resolveQuestionTypes(explicitQuestionTypes, suggestedMix)

  // La mezcla se recorta a los tipos que finalmente se van a usar y se
  // renormaliza. Un tipo que el usuario tildó y el programa no pondera entra
  // igual; un tipo que el usuario destildó no vuelve por la ventana.
  const questionMix = restrictQuestionTypeMix(suggestedMix, finalQuestionTypes)

  const modeDescription = mode === 'teorico'
    ? 'MODO TEÓRICO: Preguntas conceptuales sobre definiciones, teoremas y propiedades. Sin cálculos numéricos complejos.'
    : mode === 'practico'
      ? 'MODO PRÁCTICO: Ejercicios de cálculo y resolución de problemas numéricos.'
      : 'MODO MIXTO: Equilibrar preguntas teoricas y practicas.'

  // Grows as the run collects questions. Rebuilding it before every batch is
  // what stops a retry — or the other half of a "mixto" quiz — from producing
  // the same exercise again: until now the note was frozen at the questions the
  // student had seen in *previous* quizzes, so each batch was blind to what the
  // rest of this very quiz had already asked.
  const askedTexts: string[] = [...previousQuestionTexts]

  /**
   * Lo que el docente escribió al rechazar la pregunta que se está
   * reemplazando. Va SEPARADO de `pedagogyContext`, que describe cómo da la
   * materia en general y viaja a todas las generaciones: esto es sobre una
   * pregunta puntual y se descarta apenas termina esta llamada.
   */
  const rejectionBlock =
    typeof rejectionNote === 'string' && rejectionNote.trim().length > 0
      ? `\n\nEL DOCENTE RECHAZÓ LA PREGUNTA ANTERIOR SOBRE ESTE TEMA. Motivo, en sus palabras:
"${rejectionNote.trim()}"

Generá una pregunta que NO tenga ese problema. El motivo describe qué corregir,
no de qué tratar: el tema y el tipo de pregunta no cambian.`
      : ''

  const buildPreviousNote = () => {
    if (askedTexts.length === 0) {
      const base =
        previousQuestionIds && previousQuestionIds.length > 0 ? 'Genera preguntas diferentes a las anteriores.' : ''
      return base + rejectionBlock
    }
    return `NO repitas ni reformules ninguna de estas preguntas (ya fueron usadas):
${askedTexts.map((question: string, index: number) => `${index + 1}. ${question}`).join('\n')}

Una pregunta cuenta como repetida aunque cambies el tipo, el formato o la redacción,
si se resuelve con la misma cuenta o evalúa el mismo caso puntual. Usá números o
situaciones diferentes.${rejectionBlock}`
  }

  /** Signatures seen in THIS run — see numericSignature for why it is not global. */
  const runSignatures = new Set<string>()

  /** Returns true when the question is a duplicate and should be dropped. */
  const isDuplicate = (question: { question: string; topic?: string; topicName?: string }): boolean => {
    const fingerprint = normalizeQuestionText(question.question)
    if (!fingerprint || previousQuestionFingerprints.has(fingerprint)) return true

    const signature = numericSignature(question)
    if (signature && runSignatures.has(signature)) {
      console.log('[generate-quiz] Dropped a re-dressed duplicate:', question.question)
      return true
    }

    previousQuestionFingerprints.add(fingerprint)
    if (signature) runSignatures.add(signature)
    askedTexts.push(question.question)
    return false
  }

  const pedagogyNote = typeof pedagogyContext === 'string' && pedagogyContext.trim().length > 0
    ? `\nPREFERENCIAS PEDAGOGICAS DEL DOCENTE:\n${pedagogyContext}`
    : ''

  const collectedQuestions = []

  if (mode === 'mixto') {
    const teoricoCount = Math.ceil(questionCount / 2)
    const practicoCount = Math.floor(questionCount / 2)
    const teoricoCollected: any[] = []
    const practicoCollected: any[] = []

    for (let attempt = 0; attempt < 3 && (teoricoCollected.length < teoricoCount || practicoCollected.length < practicoCount); attempt++) {
      if (teoricoCollected.length < teoricoCount) {
        const teoricoBatch = await generateQuizBatch({
          subject,
          curriculum,
          modeDescription: 'MODO TEÓRICO: Preguntas conceptuales sobre definiciones, teoremas y propiedades. Sin cálculos numéricos complejos.',
          topicsText,
          questionCount: teoricoCount,
          previousNote: buildPreviousNote(),
          pedagogyNote,
          specialistRole,
          difficulty,
          nivel,
          grado,
          contextoProfesional,
          questionTypes: finalQuestionTypes,
          questionMix,
          onUsage,
        })

        for (const question of teoricoBatch) {
          if (isDuplicate(question)) continue
          teoricoCollected.push(question)
          if (teoricoCollected.length === teoricoCount) break
        }
      }

      if (practicoCollected.length < practicoCount) {
        const practicoBatch = await generateQuizBatch({
          subject,
          curriculum,
          modeDescription: 'MODO PRÁCTICO: Ejercicios de cálculo y resolución de problemas numéricos.',
          topicsText,
          questionCount: practicoCount,
          // Rebuilt here on purpose: by now it also lists the teórico half,
          // so the práctico batch can no longer restate the same exercise.
          previousNote: buildPreviousNote(),
          pedagogyNote,
          specialistRole,
          difficulty,
          nivel,
          grado,
          contextoProfesional,
          questionTypes: finalQuestionTypes,
          questionMix,
          onUsage,
        })

        for (const question of practicoBatch) {
          if (isDuplicate(question)) continue
          practicoCollected.push(question)
          if (practicoCollected.length === practicoCount) break
        }
      }
    }

    if (teoricoCollected.length < teoricoCount || practicoCollected.length < practicoCount) {
      return {
        ok: false,
        reason: 'insufficient_variety',
        message: 'No se pudo generar un cuestionario mixto con suficiente variedad. Intenta otra vez.',
      }
    }

    const mixedQuestions = interleaveQuestions(teoricoCollected, practicoCollected, questionCount)
    return { ok: true, questions: mixedQuestions.map((q, idx) => shuffleAndRenumber(q, `q${idx + 1}`)) }
  }

  for (let attempt = 0; attempt < 3 && collectedQuestions.length < questionCount; attempt++) {
    const generatedQuestions = await generateQuizBatch({
      subject,
      curriculum,
      modeDescription,
      topicsText,
      questionCount,
      // Rebuilt on every attempt so retry #2 knows what attempt #1 produced.
      previousNote: buildPreviousNote(),
      pedagogyNote,
      specialistRole,
      difficulty,
      nivel,
      grado,
      contextoProfesional,
      questionTypes: finalQuestionTypes,
      questionMix,
      onUsage,
    })

    console.log('[generateObject] Success! Questions:', generatedQuestions.length)

    for (const question of generatedQuestions) {
      if (isDuplicate(question)) continue

      collectedQuestions.push(question)

      if (collectedQuestions.length === questionCount) {
        break
      }
    }
  }

  if (collectedQuestions.length < questionCount) {
    return {
      ok: false,
      reason: 'insufficient_variety',
      message: 'No se pudo generar un nuevo cuestionario completamente distinto. Intenta otra vez.',
    }
  }

  return { ok: true, questions: collectedQuestions.map((q, idx) => shuffleAndRenumber(q, `q${idx + 1}`)) }
}
