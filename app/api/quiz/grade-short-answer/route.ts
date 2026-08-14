import { generateObject, NoObjectGeneratedError } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { getEducationContext } from '@/lib/education-context'
import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure } from '@/lib/observability'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { gradeShortAnswerLocally } from '@/lib/short-answer-autograde'

const gradeSchema = z.object({
  isCorrect: z.boolean(),
  category: z.enum(['Excelente', 'Parcial', 'A mejorar']),
  scorePercent: z.number(),
  feedback: z.string(),
})

/**
 * Era 500, el techo más bajo de todo el repo (el resto de las rutas va de 2000 a
 * 8000). No alcanzaba, y el modo de falla no era obvio: `gemini-2.5-flash` gasta
 * presupuesto de SALIDA en thinking tokens antes de emitir el primer carácter
 * del objeto, así que el corte caía adentro del JSON. En una prueba con 30
 * alumnos esto produjo ~224 `AI_NoObjectGeneratedError` en dos horas; el evento
 * de Sentry muestra la respuesta cortada en 14 caracteres, literalmente
 * `{\n  "isCorrect`.
 *
 * Subirlo no encarece el caso normal: se factura lo que el modelo emite, no el
 * techo, y una corrección son cuatro campos con un feedback de dos o tres
 * frases — bastante menos de 500 tokens de salida real. El número existe para
 * que un pico de razonamiento no rompa el objeto, no para acotar el costo; para
 * eso están el rate limit por usuario y el kill switch de presupuesto. Si
 * aparece la tentación de volver a bajarlo, mirar antes el ratio de errores de
 * este endpoint en Sentry.
 */
const MAX_OUTPUT_TOKENS = 2000

/**
 * Además del techo, se apaga el razonamiento previo. Verificado contra la
 * versión instalada (@ai-sdk/google 3.0.64): `providerOptions.google
 * .thinkingConfig.thinkingBudget` está en el schema de opciones del modelo y el
 * provider lo reenvía tal cual al request de Gemini — el 0 no se pierde por un
 * chequeo de falsy. Corregir contra una rúbrica cerrada de tres categorías no
 * necesita cadena de pensamiento, y era justo lo que se comía el presupuesto
 * antes de que empezara a salir el JSON.
 */
const GRADING_PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingBudget: 0 } },
}

/**
 * Las dos caras del mismo corte: `generateObject` envuelve el fallo de parseo
 * (`AI_JSONParseError`) dentro de un `AI_NoObjectGeneratedError`, así que se
 * recorre la cadena de `cause` en vez de mirar sólo el error de arriba. Un
 * timeout, un 429 de Google o una falla de red NO entran acá: reintentar eso
 * sería insistirle a un proveedor caído desde una ruta que un alumno dispara
 * una vez por pregunta.
 */
const RETRYABLE_AI_ERROR_NAMES = new Set(['AI_NoObjectGeneratedError', 'AI_JSONParseError'])

function isTruncatedObjectError(error: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(error)) return true

  // El tope de saltos es contra una cadena de causas cíclica, que colgaría el
  // handler sin dejar rastro de por qué.
  let current: unknown = error
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (RETRYABLE_AI_ERROR_NAMES.has(current.name)) return true
    current = (current as { cause?: unknown }).cause
  }

  return false
}

/**
 * Google factura el intento aunque el JSON llegue cortado — mismo criterio que
 * ya documenta `lib/ai-usage.ts` al escribir la fila ANTES de llamar al modelo.
 * `NoObjectGeneratedError` expone el `usage` de ese intento, así que se puede
 * recuperar y sumar al del reintento en vez de perderlo.
 */
function usageOfFailedAttempt(error: unknown): AiSdkUsage | undefined {
  return NoObjectGeneratedError.isInstance(error) ? error.usage : undefined
}

export async function POST(req: Request) {
  const { question, acceptedAnswers, studentAnswer, nivel, grado, materia } = await req.json()

  if (typeof question !== 'string' || !Array.isArray(acceptedAnswers) || typeof studentAnswer !== 'string') {
    return Response.json({ error: 'Parametros invalidos' }, { status: 400 })
  }

  // Corrección determinista ANTES del guard, y por lo tanto antes de abrir la
  // fila de `ai_usage_log`: si se resuelve acá no hubo llamada al modelo, así
  // que tampoco tiene que haber registro de uso ni consumo de rate limit.
  //
  // El cliente ya hace este mismo chequeo antes del `fetch` —ahí está el valor
  // real, porque le permite corregir sin red—, de modo que en el flujo normal
  // esta rama casi no se ejecuta. Existe para cualquier otro llamador de la
  // ruta, que no tiene por qué saber que hay un paso previo. Es la misma
  // función, no una copia.
  const local = gradeShortAnswerLocally(studentAnswer, acceptedAnswers)
  if (local.resolved) {
    return Response.json({
      isCorrect: true,
      category: 'Excelente',
      scorePercent: 100,
      feedback:
        local.via === 'numeric'
          ? 'Correcto: tu respuesta equivale a la esperada.'
          : 'Correcto.',
    })
  }

  const guard = await guardAiCall({ bucket: 'grading', nivel })
  if (!guard.ok) return guard.response

  const eduCtx = getEducationContext(nivel, grado, materia || 'la materia')

  const gradeWithAi = () =>
    generateObject({
      model: google('gemini-2.5-flash'),
      schema: gradeSchema,
      schemaName: 'shortAnswerGrade',
      schemaDescription: 'Evaluacion de una respuesta corta de un estudiante basado en la rubrica del docente.',
      system: `${eduCtx.rolDocente}.
Tu tarea es corregir la respuesta de un estudiante a una pregunta de respuesta corta.
Se flexible con errores de tipeo, orden de palabras o sinónimos — evalúa el CONTENIDO conceptual, no la redacción exacta (excepto si la rúbrica lo penaliza estrictamente).
${eduCtx.registroLinguistico}

${eduCtx.rubricaRespuestaCorta}`,
      prompt: `PREGUNTA: ${question}

RESPUESTAS ACEPTADAS (referencia, el estudiante no tiene que igualarlas textualmente): ${acceptedAnswers.join(' / ')}

RESPUESTA DEL ESTUDIANTE: "${studentAnswer}"

Indica la categoría de la rúbrica (Excelente, Parcial, A mejorar), el puntaje estimado (100, 70, o 40), si califica como conceptualmente correcta (isCorrect, suele ser true para Excelente/Parcial) y da un feedback justificado según las reglas del perfil en el tono de ${eduCtx.instruccionesExplicacion.slice(0, 200)}.`,
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: GRADING_PROVIDER_OPTIONS,
    })

  // Tokens del primer intento cuando ese intento se cayó por parseo. Se declara
  // acá afuera para que el `finish` de más abajo sume los dos intentos: el guard
  // abrió UNA fila de uso y espera exactamente un finish o un fail, así que la
  // fila tiene que cerrarse con el gasto total de la request, no con el del
  // último intento. Mismo criterio que `/api/generate-quiz`, que acumula el
  // usage de todas sus tandas y cierra una sola vez con `sumUsage`.
  let firstAttemptUsage: AiSdkUsage | undefined

  try {
    let result: Awaited<ReturnType<typeof gradeWithAi>>

    try {
      result = await gradeWithAi()
    } catch (error) {
      if (!isTruncatedObjectError(error)) throw error

      firstAttemptUsage = usageOfFailedAttempt(error)
      // Un solo reintento, no un bucle: la ruta ya está detrás del rate limit
      // por usuario y lo que se busca es sobrevivir a un corte puntual del
      // modelo, no martillar a un proveedor que está mal. Si el segundo intento
      // también falla, cae al catch de afuera y el alumno se entera.
      //
      // A Sentry no se manda este intento recuperado a propósito: el `fallback`
      // de captureAiSchemaFailure es una unión cerrada
      // ('generateText' | 'heuristic' | 'none') y ninguno describe "reintento
      // del mismo camino". Si algún día queremos la métrica de cuántas veces
      // salva el reintento, la unión se amplía en lib/observability.ts.
      console.warn('[grade-short-answer] Objeto truncado, reintentando una vez:', error)
      result = await gradeWithAi()
    }

    await guard.finish(sumUsage(firstAttemptUsage, result.usage))
    return Response.json(result.object)
  } catch (error) {
    await guard.fail()
    // Sin fallback: si la IA no corrige, el alumno se queda sin nota en esa
    // pregunta. Es el que más directo impacta en lo que ve un estudiante.
    captureAiSchemaFailure(error, {
      endpoint: '/api/quiz/grade-short-answer',
      fallback: 'none',
      nivel,
    })
    console.error('[grade-short-answer] Error:', error)
    return Response.json(
      { error: 'No se pudo corregir la respuesta', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
