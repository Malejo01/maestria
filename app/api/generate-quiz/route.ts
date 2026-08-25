/**
 * Frontera HTTP de la generación de cuestionarios.
 *
 * El núcleo vive en lib/quiz-generation.ts. Acá queda sólo lo que es de la
 * ruta: normalizar el cuerpo, pasar por el guard de IA (identidad, presupuesto,
 * rate limit), sumar el consumo real de todas las tandas en una sola fila de
 * `ai_usage_log`, y traducir el resultado a un status.
 *
 * El orden importa y es el de siempre: primero el 400 por cuerpo inválido —que
 * no gasta nada—, después el guard con el nivel ya resuelto para que el mensaje
 * de corte le hable distinto a un chico de primaria que a un terciario, y recién
 * ahí la generación.
 */
import { guardAiCall } from '@/lib/ai-guard'
import { captureRouteFailure } from '@/lib/observability'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { generateQuiz, resolveQuizRequest } from '@/lib/quiz-generation'

export async function POST(req: Request) {
  const resolved = resolveQuizRequest(await req.json())

  if (!resolved.ok) {
    return Response.json({ questions: [], error: resolved.error }, { status: 400 })
  }

  const params = resolved.params

  // Recién acá, con el nivel ya resuelto, para que el mensaje de corte le hable
  // a un chico de primaria distinto que a un estudiante de terciario. Todo lo
  // anterior es parseo del body: no cuesta tokens.
  const guard = await guardAiCall({
    bucket: 'quiz_generation',
    nivel: params.nivel,
    errorBody: () => ({ questions: [] }),
  })
  if (!guard.ok) return guard.response

  // Una request puede disparar hasta tres tandas (y el modo mixto, dos series
  // de tres). El límite cuenta la request; el costo tiene que sumarlas todas.
  const usageParts: (AiSdkUsage | undefined)[] = []
  const collectUsage = (usage: AiSdkUsage | undefined) => {
    usageParts.push(usage)
  }

  try {
    const result = await generateQuiz(params, collectUsage)

    if (!result.ok) {
      // Los tokens ya se gastaron aunque el resultado no sirva: se cierra la
      // fila con lo consumido, no se descarta.
      await guard.finish(sumUsage(...usageParts))
      return Response.json({ questions: [], error: result.message }, { status: 409 })
    }

    await guard.finish(sumUsage(...usageParts))
    return Response.json({ questions: result.questions })
  } catch (error) {
    // La fila queda en 'error' y sigue contando: si Gemini alcanzó a responder
    // antes de romperse, ese consumo ya se facturó.
    await guard.fail()

    captureRouteFailure(error, {
      endpoint: '/api/generate-quiz',
      status: 500,
      operation: 'generate_quiz',
    })

    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[POST] Final error:', {
      message: err.message,
      name: err.name,
      cause: err.cause,
      stack: err.stack?.substring(0, 500)
    })

    // This used to answer 200 with buildLocalFallbackQuestions() — template
    // items like "Sobre <tema>, selecciona la afirmación correcta." with four
    // generic options. Callers only look at `questions`, so a failed AI call
    // reached students as a real quiz: every question identical, every answer
    // meaningless, and no sign anything had gone wrong. Failing loudly is the
    // lesser harm; both the practicar page and subject-content already show a
    // "no pudimos generar, intentá de nuevo" message on a non-OK response.
    return Response.json(
      {
        questions: [],
        error: 'La IA no pudo generar el cuestionario en este momento. Volvé a intentarlo en unos instantes.',
        details: err.message || 'Error interno al generar el quiz',
      },
      { status: 502 }
    )
  }
}
