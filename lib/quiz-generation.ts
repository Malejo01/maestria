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
import { anclarTema } from '@/lib/a-reforzar'
import { seccionEvitar, type PreguntaAEvitar } from '@/lib/valoraciones'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import { buildEducationSystemPrompt, type ContextoProfesionalCarrera } from '@/lib/education-context'
import type { PerfilAlumnos } from '@/lib/perfil-alumnos'
import { captureAiSchemaFailure, captureRouteFailure } from '@/lib/observability'
import type { AiSdkUsage } from '@/lib/ai-usage'
import { normalizeQuestionText, numericSignature } from '@/lib/question-dedup'
import { normalizarFraccionGenerada } from '@/lib/fraccion'
import { pideMasDeUnValor } from '@/lib/consigna-multiple'
import { corregirTipoDePregunta, MOTIVO_DE_PROBLEMA } from '@/lib/validar-tipo-de-pregunta'
import {
  buildQuestionMixInstruction,
  mergeQuestionTypeMixes,
  parseQuestionTypeMix,
  questionTypesFromMix,
  restrictQuestionTypeMix,
  type QuestionTypeMix,
} from '@/lib/question-mix'
import { sql } from '@/lib/db'
import { AI_MODEL } from '@/lib/ai-model'
import { isConceptualNumericQuestion, questionTypesForMode, scopeUnitsToTopics } from '@/lib/quiz-scope'
import { limitarMezcla, maximoPorTipo, tiposPermitidos, type AreaId, type Modo } from '@/lib/areas'
import {
  BLOQUE_LATEX,
  bloqueDeNotacion,
  descripcionDelModo,
  excedeElTope,
  mezclaDelArea,
  rolDeLaGeneracion,
  seccionDeArea,
} from '@/lib/area-para-generar'
import { areaParaGenerar } from '@/lib/area-para-generar-server'

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
  // M2: lo ve el modelo en el esquema. No se valida acá (un refine tiraría la
  // tanda entera): lo que se escape lo arregla `corregirTipoDePregunta`.
  question: z.string().describe('Una AFIRMACIÓN que se pueda juzgar verdadera o falsa. Sin "¿" y sin "?" al final.'),
  type: z.literal('true_false'),
  correctAnswer: z.boolean(),
})

const numericQuestionSchema = z.object({
  ...baseQuestionFields,
  type: z.literal('numeric'),
  correctAnswer: z.number(),
  tolerance: z.number().optional(),
  // K2: la respuesta como fracción. Opcional, y se normaliza después
  // (`normalizarFraccionGenerada`): la fracción manda sobre `correctAnswer`.
  fraccion: z.object({ numerador: z.number().int(), denominador: z.number().int() }).optional(),
  exigeIrreducible: z.boolean().optional(),
  admiteMixto: z.boolean().optional(),
  // L3: la consigna pide factorizar; `correctAnswer` es el número. Si la IA no
  // lo marca y la consigna lo pide, lo marca `normalizarFraccionGenerada`.
  forma: z.enum(['factorizacion']).optional(),
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
- acceptedAnswers: array de 1 a 3 strings con respuestas correctas aceptadas (variantes cortas, sin explicación)
- UNA CONSIGNA, UNA RESPUESTA: la pregunta pide exactamente un resultado. Si el tema tiene dos cálculos (por ejemplo media y mediana), hacé dos preguntas separadas.`,
  true_false: `TIPO "true_false":
- type: "true_false"
- correctAnswer: boolean (true o false)
- question: una AFIRMACIÓN que se pueda juzgar, sin "¿" y sin "?" al final. Nunca una pregunta ("¿qué sucede…?", "¿cómo…?", "¿por qué…?"): no se contesta con Verdadero o Falso.`,
  numeric: `TIPO "numeric":
- type: "numeric"
- correctAnswer: number
- tolerance: number opcional (margen de error aceptado, omitir si la respuesta debe ser exacta)
- fraccion: { "numerador": entero, "denominador": entero } OPCIONAL. Ponelo SIEMPRE que la respuesta sea una fracción que no da un decimal exacto (2/3 + 1/4 → { "numerador": 11, "denominador": 12 }, nunca 0.9166666666666666), cuando el tema sea de fracciones, o cuando la consigna pida "fracción", "expresión irreducible" o "simplificá" (Simplificá 42/56 → { "numerador": 3, "denominador": 4 }, nunca 0.75). Con fraccion, correctAnswer es su valor decimal.
- exigeIrreducible: boolean OPCIONAL. true si la consigna pide la expresión irreducible o simplificar: entonces 6/8 no vale por 3/4.
- admiteMixto: boolean OPCIONAL. true sólo si el enunciado admite responder con un número mixto (1 1/2).
- forma: "factorizacion" OPCIONAL. OBLIGATORIO cuando la consigna pide factorizar, descomponer en factores primos o escribir como producto de potencias o de primos ("Descomponé 60 en factores primos" → correctAnswer: 60, forma: "factorizacion"). correctAnswer es el NÚMERO; el alumno responde el producto (2^2·3·5) y se corrige que todos los factores sean primos y den ese número.
- Usalo SOLO cuando la respuesta es un único número que sale de un cálculo o un conteo (ej: "Calculá el MCD(24, 36)" → 12).
- UNA CONSIGNA, UNA RESPUESTA: hay un solo casillero, así que la pregunta pide exactamente un resultado. NUNCA "calculá la media y la mediana", "el perímetro y el área", "el MCD y el MCM", dos preguntas en una ("¿cuánto…? ¿y cuántos…?") ni "a) … b) …". Si el tema tiene dos cálculos, hacé dos preguntas separadas.
- NUNCA lo uses para preguntas que se responden con palabras (explicar, justificar, identificar un error, nombrar un concepto o una propiedad), ni para codificar sí/no o verdadero/falso como 1/0. Si la respuesta es conceptual, usá otro de los tipos pedidos.`,
}

function buildTypeInstructions(
  questionTypes: QuestionType[],
  questionMix: QuestionTypeMix | undefined,
  questionCount: number,
  /** Ronda T · A4: sin nada cuantitativo, el porqué no habla de modelar y resolver. */
  conceptual = false,
): string {
  const blocks = questionTypes.map((type) => PROMPT_FIELD_BLOCKS[type]).join('\n\n')
  const typesList = questionTypes.join(', ')

  // Con mezcla declarada, el reparto es numérico y explícito; sin ella queda el
  // "de forma pareja" de siempre, que es lo que ve todo K-12.
  const mixInstruction = buildQuestionMixInstruction(questionMix, questionCount, conceptual ? RAZON_CONCEPTUAL : undefined)
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

const RAZON_CONCEPTUAL = `La mezcla equilibra reconocer y producir: con más de un tipo, ninguno puede ser más de la mitad.
Un cuestionario de puro verdadero o falso se aprueba adivinando la mitad; las de respuesta corta
y las de opción múltiple con casos obligan a usar el concepto. Si un tema te resulta difícil de
plantear como respuesta corta, planteá un caso breve y pedí el concepto que lo explica.`

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
  // K2: la fracción de una `numeric` (simplificada, y recuperada del decimal si
  // la consigna pide una fracción y la IA mandó sólo el número).
  return questions.map((original) => (original?.type === 'numeric' ? normalizarFraccionGenerada(original) : original)).map((question) => ({
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
  perfilAlumnos,
  contenido,
  questionTypes,
  questionMix,
  area,
  seccionArea,
  notacion,
  sinCalculo,
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
  perfilAlumnos?: PerfilAlumnos | null
  /** O3: unidades y temas de la tanda (para reconocer una unidad de didáctica). */
  contenido?: { unidades: string[]; temas: string[] }
  questionTypes: QuestionType[]
  /** Reparto por tipo que declara el programa de cátedra (migración 023). */
  questionMix?: QuestionTypeMix
  /** Ronda T · A4: el área de la materia (lib/areas.ts). */
  area?: AreaId
  /** Ronda T · A4: "ÁREA Y CÓMO SE EVALÚA" (rol, modo, ejemplos). */
  seccionArea?: string
  /** Ronda T · A4: los bloques de notación que corresponden (LaTeX sólo si algo es cuantitativo). */
  notacion?: string
  /** Ronda T · A4: todas las unidades son conceptuales (el porqué de la mezcla cambia). */
  sinCalculo?: boolean
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
    perfilAlumnos,
    contenido,
    area,
  })

  const systemPrompt = `${educationPrompt}
${specialistRole ? `\nASPECTO ADICIONAL DE MATERIA: ${specialistRole}` : ''}
${seccionArea ? `\n${seccionArea}\n` : ''}

Tu única tarea es generar un objeto JSON que contenga un array de preguntas.
ADAPTA el estilo de las preguntas estrictamente a la materia solicitada (${subject}) y al nivel/grado del estudiante.

INSTRUCCIONES CRÍTICAS:
1. Genera EXACTAMENTE ${questionCount} preguntas.
2. Responde SOLO con JSON válido. Sin markdown, sin explicaciones fuera del JSON, sin comentarios.
3. Estructura: { "questions": [ { ...campos según tipo... }, ... ] }
4. Ortografía: todo el texto (enunciados, opciones, respuestas y explicaciones) respeta la ortografía del español, con todas sus tildes: "Sí, es correcta" (no "Si, es correcta"), "más", "qué", "cuál", "está".

${notacion ?? BLOQUE_LATEX}

${buildTypeInstructions(questionTypes, questionMix, questionCount, sinCalculo === true)}`

  const userPrompt = `Genera ${questionCount} preguntas para: ${subject}

UBICACIÓN EN EL PROGRAMA (referencia de nivel y contexto):
${curriculum}

MODO: ${modeDescription}

TEMAS SELECCIONADOS — ÚNICO ALCANCE DEL CUESTIONARIO:
${topicsText}

REGLA DE ALCANCE (obligatoria):
- Cada pregunta evalúa exclusivamente uno de los TEMAS SELECCIONADOS.
- NO preguntes sobre otros temas del programa, aunque sean de la misma unidad o estén relacionados con los seleccionados.
- Las preferencias pedagógicas del docente indican CÓMO preguntar (enfoque, tono, tipo de situación), no agregan temas: aplicá ese enfoque a los temas seleccionados.
- En "topicName" copiá textualmente el nombre del tema seleccionado que evalúa la pregunta.

${previousNote}
${pedagogyNote}

IMPORTANTE: Responde SOLO JSON válido comenzando con { y terminando con }`

  try {
    const { object, usage } = await generateObject({
      model: google(AI_MODEL),
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
          model: google(AI_MODEL),
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
  /**
   * J3: la materia del docente para la que se genera. La ruta la usa para
   * buscar las fichas de los alumnos de ese grupo; no viaja a la IA.
   */
  teacherProgramId?: number
  /**
   * J3: lo pedagógico de esas fichas. Lo carga la ruta en el servidor, NUNCA
   * sale del cuerpo de la request.
   */
  perfilAlumnos?: PerfilAlumnos | null
  /**
   * O8: los últimos pulgares abajo del docente en esta materia ("Evitá
   * esto"). Los carga la ruta en el servidor, NUNCA salen del cuerpo.
   */
  evitar?: PreguntaAEvitar[]
  /**
   * Ronda T · A4: el área, si quien llama ya la sabe. Si no, `generateQuiz`
   * la lee del programa (`teacherProgramId`) o la infiere de la materia.
   */
  area?: AreaId
  /**
   * Ronda T · A4: los `explicitQuestionTypes` son un valor por defecto del
   * código (el diagnóstico), no una elección de una persona: no habilitan
   * `numeric` en lo conceptual.
   */
  tiposPorDefecto?: boolean
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
      ...(teacherProgramIdDe(body) ? { teacherProgramId: teacherProgramIdDe(body) } : {}),
    },
  }
}

/** J3: la materia del docente, si el cuerpo la trae y es un id válido. */
function teacherProgramIdDe(body: unknown): number | undefined {
  const valor = Number((body as { teacherProgramId?: unknown } | null)?.teacherProgramId)
  return Number.isInteger(valor) && valor > 0 ? valor : undefined
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
    perfilAlumnos,
    evitar,
    tiposPorDefecto,
  } = params

  const topicsText = topics.map((t: { id: string; name: string }) => `- ${t.name}`).join('\n')
  const previousQuestionList = Array.isArray(previousQuestions) ? previousQuestions : []
  const previousQuestionTexts = previousQuestionList
    .map((question: { question?: string }) => question.question)
    .filter((question: string | undefined): question is string => Boolean(question))
  const previousQuestionFingerprints = new Set(previousQuestionTexts.map(normalizeQuestionText))

  // El aula manda el programa entero; recortarlo a los temas elegidos es lo
  // que evita que el modelo pregunte por los hermanos. Ver lib/quiz-scope.ts.
  const scopedUnits = scopeUnitsToTopics(Array.isArray(subjectUnits) ? subjectUnits : [], topics ?? [])
  const curriculum = buildCurriculumFromUnits(subject, scopedUnits)

  // Ronda T · A4: el área manda el rol, qué significa cada modo, la mezcla de
  // tipos y la notación (lib/areas.ts). Del programa si hay materia del
  // docente; si no, inferida de la materia.
  const areaCtx = await areaParaGenerar({
    area: params.area,
    teacherProgramId: params.teacherProgramId,
    subject,
    carrera,
    unidades: (Array.isArray(scopedUnits) ? scopedUnits : []) as never[],
    temas: topics ?? [],
  })
  const specialistRole = rolDeLaGeneracion(areaCtx, subject)
  const notacion = bloqueDeNotacion(areaCtx.bloques)
  const sinCalculo = areaCtx.caracteres.every((c) => c === 'conceptual')

  // Lo que declara el programa de cátedra: contexto profesional (migración 022)
  // y mezcla sugerida de tipos de pregunta (migración 023).
  const { contextoProfesional, questionMix: suggestedMix } = await loadCurriculumPedagogy({
    nivel,
    grado,
    materia: subject,
    carrera,
    ejes: Array.isArray(scopedUnits)
      ? scopedUnits
          .map((unit: { name?: unknown }) => (typeof unit?.name === 'string' ? unit.name : ''))
          .filter((name: string) => name.length > 0)
      : [],
  })

  // O3: con qué unidades y temas se genera, para la persona de didáctica.
  const contenido = {
    unidades: (Array.isArray(scopedUnits) ? scopedUnits : [])
      .map((unit: { name?: unknown }) => (typeof unit?.name === 'string' ? unit.name : ''))
      .filter((name: string) => name.length > 0),
    temas: (topics ?? []).map((t: { name?: unknown }) => (typeof t?.name === 'string' ? t.name : '')).filter(Boolean),
  }

  // Ronda T · A4: la mezcla de cada modo sale del programa de cátedra si lo
  // declara; si no, del área. Siempre con el tope del 50 % (limitarMezcla).
  const modoDeLaTanda: Modo = mode === 'teorico' || mode === 'practico' ? mode : 'mixto'
  const mezclaBase = (modo: Modo) => suggestedMix ?? mezclaDelArea(areaCtx, modo)

  // Sin tipos pedidos: los de la mezcla (programa de cátedra o área). `numeric`
  // sólo si alguna unidad es cuantitativa o si una persona la tildó a mano.
  const finalQuestionTypes = tiposPermitidos(
    resolveQuestionTypes(explicitQuestionTypes, mezclaBase(modoDeLaTanda === 'teorico' ? 'teorico' : 'practico')),
    areaCtx.caracteres,
    tiposPorDefecto ? [] : explicitQuestionTypes,
  )

  // La mezcla se recorta a los tipos que finalmente se van a usar y se
  // renormaliza. Un tipo que el usuario tildó y el programa no pondera entra
  // igual; un tipo que el usuario destildó no vuelve por la ventana.
  const mezclaDe = (modo: Modo, tipos: QuestionType[]) => {
    const recortada = restrictQuestionTypeMix(mezclaBase(modo), tipos)
    return recortada ? limitarMezcla(recortada) : undefined
  }
  const questionMix = mezclaDe(modoDeLaTanda === 'mixto' ? 'practico' : modoDeLaTanda, finalQuestionTypes)

  // La tanda teórica no admite `numeric` salvo que sea lo único pedido. Ver
  // `questionTypesForMode`. `mode === 'teorico'` cubre el aula, que pide las
  // dos mitades del mixto por separado; la tanda teórica del mixto de acá
  // abajo usa lo mismo.
  const teoricoQuestionTypes = questionTypesForMode(finalQuestionTypes, 'teorico')
  const teoricoQuestionMix = mezclaDe('teorico', teoricoQuestionTypes)
  const batchQuestionTypes = mode === 'teorico' ? teoricoQuestionTypes : finalQuestionTypes
  const batchQuestionMix = mode === 'teorico' ? teoricoQuestionMix : questionMix

  // Qué significa cada modo en el área: en Antropología, "práctico" es análisis
  // de casos, no ejercicios de cálculo.
  const modeDescription = descripcionDelModo(areaCtx, modoDeLaTanda)
  const seccionArea = seccionDeArea(areaCtx, modoDeLaTanda)

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

  // O8: lo que el docente marcó con pulgar abajo en esta materia.
  const evitarBlock = seccionEvitar(evitar ?? [])

  const buildPreviousNote = () => {
    if (askedTexts.length === 0) {
      const base =
        previousQuestionIds && previousQuestionIds.length > 0 ? 'Genera preguntas diferentes a las anteriores.' : ''
      return base + rejectionBlock + evitarBlock
    }
    return `NO repitas ni reformules ninguna de estas preguntas (ya fueron usadas):
${askedTexts.map((question: string, index: number) => `${index + 1}. ${question}`).join('\n')}

Una pregunta cuenta como repetida aunque cambies el tipo, el formato o la redacción,
si se resuelve con la misma cuenta o evalúa el mismo caso puntual. Usá números o
situaciones diferentes.${rejectionBlock}${evitarBlock}`
  }

  /** Signatures seen in THIS run — see numericSignature for why it is not global. */
  const runSignatures = new Set<string>()

  /** Returns true when the question is a duplicate, or a numeric one that asks for words, and should be dropped. */
  const shouldDrop = (
    question: { question: string; topic?: string; topicName?: string; type?: string; acceptedAnswers?: unknown },
    tiposDeLaTanda: QuestionType[] = finalQuestionTypes,
  ): boolean => {
    // Decisión 2 de la tanda P: un tipo que no se pidió se descarta y el bucle
    // pide otra pregunta (completa la cantidad).
    if (!tiposDeLaTanda.includes(question.type as QuestionType)) {
      console.log(`[generate-quiz] Dropped (tipo no pedido: ${question.type}):`, question.question)
      return true
    }
    // M2: el tipo tiene que encajar con la consigna. Lo que se arregla sin IA
    // (un sí/no en orden sujeto-verbo, "el valor" de una inecuación) se
    // reescribe acá mismo; lo demás se descarta y el bucle pide otra pregunta
    // en la tanda siguiente (hasta tres tandas). Cada corrección deja su línea
    // en el log para medir cuántas caen.
    const correccion = corregirTipoDePregunta(question)
    if (correccion.accion === 'regenerar') {
      console.log(`[generate-quiz] Dropped (tipo incoherente: ${MOTIVO_DE_PROBLEMA[correccion.problema]}):`, question.question)
      return true
    }
    if (correccion.accion === 'reescrita') {
      if (correccion.problema === 'inecuacion-formas') {
        console.log('[generate-quiz] Added the equivalent forms of a solution set:', question.question)
      } else {
        console.log(`[generate-quiz] Rewrote (tipo incoherente: ${MOTIVO_DE_PROBLEMA[correccion.problema]}):`, question.question, '→', correccion.cambios.question)
      }
      question.question = correccion.cambios.question
      if (correccion.cambios.acceptedAnswers) question.acceptedAnswers = correccion.cambios.acceptedAnswers
    }
    if (isConceptualNumericQuestion(question)) {
      console.log('[generate-quiz] Dropped a numeric question that asks for words:', question.question)
      return true
    }
    // K3: un solo casillero y una consigna que pide dos resultados. Se descarta
    // y el bucle pide otra, igual que la de arriba.
    if (pideMasDeUnValor(question)) {
      console.log('[generate-quiz] Dropped a question that asks for more than one value:', question.question)
      return true
    }

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

  /**
   * Ronda T · A1/A4: con más de un tipo, ninguno pasa de la mitad. Lo que
   * excede el tope queda de reserva: si al final no se completa la cantidad,
   * se usa antes que devolver un 409 (el tope es una regla de calidad, no un
   * motivo para dejar al alumno sin cuestionario).
   */
  const juntarConTope = (total: number, tipos: QuestionType[]) => {
    const juntadas: any[] = []
    const reserva: any[] = []
    const cuenta = new Map<QuestionType, number>()
    const maximo = maximoPorTipo(total, tipos.length)
    return {
      juntadas,
      agregar(question: any) {
        if (tipos.length > 1 && excedeElTope(cuenta, question.type, maximo)) {
          reserva.push(question)
          return
        }
        cuenta.set(question.type, (cuenta.get(question.type) ?? 0) + 1)
        juntadas.push(question)
      },
      completarConReserva() {
        while (juntadas.length < total && reserva.length > 0) juntadas.push(reserva.shift())
      },
      /**
       * Falta juntar. Por el tope se pide a lo sumo UNA tanda más que la
       * primera: desde la tercera, si con la reserva alcanza, no se vuelve a
       * llamar al modelo.
       */
      falta(intento: number) {
        if (juntadas.length >= total) return false
        return !(intento >= 2 && juntadas.length + reserva.length >= total)
      },
    }
  }

  if (mode === 'mixto') {
    const teoricoCount = Math.ceil(questionCount / 2)
    const practicoCount = Math.floor(questionCount / 2)
    const teorico = juntarConTope(teoricoCount, teoricoQuestionTypes)
    const practico = juntarConTope(practicoCount, finalQuestionTypes)
    const teoricoCollected = teorico.juntadas
    const practicoCollected = practico.juntadas

    for (let attempt = 0; attempt < 3 && (teorico.falta(attempt) || practico.falta(attempt)); attempt++) {
      if (teorico.falta(attempt)) {
        const teoricoBatch = await generateQuizBatch({
          subject,
          curriculum,
          modeDescription: descripcionDelModo(areaCtx, 'teorico'),
          topicsText,
          questionCount: teoricoCount,
          previousNote: buildPreviousNote(),
          pedagogyNote,
          specialistRole,
          difficulty,
          nivel,
          grado,
          contextoProfesional,
          perfilAlumnos,
          contenido,
          questionTypes: teoricoQuestionTypes,
          questionMix: teoricoQuestionMix,
          area: areaCtx.area,
          seccionArea: seccionDeArea(areaCtx, 'teorico'),
          notacion,
          sinCalculo,
          onUsage,
        })

        for (const question of teoricoBatch) {
          if (shouldDrop(question, teoricoQuestionTypes)) continue
          teorico.agregar(question)
          if (teoricoCollected.length === teoricoCount) break
        }
      }

      if (practico.falta(attempt)) {
        const practicoBatch = await generateQuizBatch({
          subject,
          curriculum,
          modeDescription: descripcionDelModo(areaCtx, 'practico'),
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
          perfilAlumnos,
          contenido,
          questionTypes: finalQuestionTypes,
          questionMix,
          area: areaCtx.area,
          seccionArea: seccionDeArea(areaCtx, 'practico'),
          notacion,
          sinCalculo,
          onUsage,
        })

        for (const question of practicoBatch) {
          if (shouldDrop(question, finalQuestionTypes)) continue
          practico.agregar(question)
          if (practicoCollected.length === practicoCount) break
        }
      }
    }
    teorico.completarConReserva()
    practico.completarConReserva()

    if (teoricoCollected.length < teoricoCount || practicoCollected.length < practicoCount) {
      return {
        ok: false,
        reason: 'insufficient_variety',
        message: 'No se pudo generar un cuestionario mixto con suficiente variedad. Intenta otra vez.',
      }
    }

    const mixedQuestions = interleaveQuestions(teoricoCollected, practicoCollected, questionCount)
    return { ok: true, questions: mixedQuestions.map((q, idx) => shuffleAndRenumber(anclarTema(q, topics ?? []), `q${idx + 1}`)) }
  }

  const juntando = juntarConTope(questionCount, batchQuestionTypes)
  for (let attempt = 0; attempt < 3 && juntando.falta(attempt); attempt++) {
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
      perfilAlumnos,
      contenido,
      questionTypes: batchQuestionTypes,
      questionMix: batchQuestionMix,
      area: areaCtx.area,
      seccionArea,
      notacion,
      sinCalculo,
      onUsage,
    })

    console.log('[generateObject] Success! Questions:', generatedQuestions.length)

    for (const question of generatedQuestions) {
      if (shouldDrop(question, batchQuestionTypes)) continue

      juntando.agregar(question)

      if (juntando.juntadas.length === questionCount) {
        break
      }
    }
  }
  juntando.completarConReserva()
  collectedQuestions.push(...juntando.juntadas)

  if (collectedQuestions.length < questionCount) {
    return {
      ok: false,
      reason: 'insufficient_variety',
      message: 'No se pudo generar un nuevo cuestionario completamente distinto. Intenta otra vez.',
    }
  }

  // O14: el tema de cada pregunta, anclado a los pedidos (ver anclarTema).
  return { ok: true, questions: collectedQuestions.map((q, idx) => shuffleAndRenumber(anclarTema(q, topics ?? []), `q${idx + 1}`)) }
}
