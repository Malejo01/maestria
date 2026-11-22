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
import { preguntasAEvitar } from '@/lib/valoraciones-server'
import { captureRouteFailure } from '@/lib/observability'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { generateQuiz, resolveQuizRequest } from '@/lib/quiz-generation'
import { bloqueoParaGenerar } from '@/lib/planes-server'
import { perfilSinRomper } from '@/lib/fichas-server'
import { getViewer } from '@/lib/auth-session'
import { paramsDePracticaExtra } from '@/lib/practica-extra-server'
import type { QuizRequestParams } from '@/lib/quiz-generation'

export async function POST(req: Request) {
  const body = await req.json()

  // P4: la práctica extra de una tarea. La configuración NO sale del cuerpo:
  // se lee de la tarea en el servidor, y la IA se le cobra al docente.
  const practicaExtraId = Number((body as { practicaExtraId?: unknown } | null)?.practicaExtraId)
  if (Number.isInteger(practicaExtraId) && practicaExtraId > 0) return generarPracticaExtra(practicaExtraId)

  const resolved = resolveQuizRequest(body)

  if (!resolved.ok) {
    return Response.json({ questions: [], error: resolved.error }, { status: 400 })
  }

  const params = resolved.params

  // Un docente con el plan vencido no genera (lib/planes.ts). A los alumnos no
  // se los toca: no se castiga al alumno por algo del docente.
  const viewer = await getViewer()
  if (viewer && !viewer.isGuest && viewer.role === 'DOCENTE') {
    const bloqueo = await bloqueoParaGenerar(viewer.id, viewer.email, { questions: [] }, { cuestionario: true })
    if (bloqueo) return bloqueo
    // J3: si genera para una materia suya, lo pedagógico de las fichas de los
    // alumnos de ese grupo entra al prompt. Se carga acá, nunca del cuerpo.
    if (params.teacherProgramId) {
      params.perfilAlumnos = await perfilSinRomper(viewer.id, params.teacherProgramId)
    }
  }
  // O8: los pulgares abajo del docente en esa materia ("Evitá esto"), también
  // para la práctica de sus alumnos en el grupo. Nunca lanza.
  if (params.teacherProgramId) params.evitar = await preguntasAEvitar(params.teacherProgramId)

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

/**
 * P4 · Las preguntas de una práctica extra ya reservada (POST
 * /api/student/practica-extra). Sólo para quien la reservó; los parámetros
 * salen de la tarea; el límite de IA es el del docente de la tarea.
 */
async function generarPracticaExtra(practicaExtraId: number) {
  const viewer = await getViewer()
  if (!viewer) return Response.json({ questions: [], error: 'unauthenticated' }, { status: 401 })
  const practica = await paramsDePracticaExtra(viewer.id, practicaExtraId)
  if (!practica) return Response.json({ questions: [], error: 'Esta práctica ya no está disponible.' }, { status: 404 })
  const params: QuizRequestParams = { ...practica.params, evitar: await preguntasAEvitar(practica.params.teacherProgramId!) }
  const guard = await guardAiCall({
    bucket: 'quiz_generation',
    nivel: params.nivel,
    cobrarA: practica.docente,
    errorBody: () => ({ questions: [] }),
  })
  if (!guard.ok) return guard.response
  const usageParts: (AiSdkUsage | undefined)[] = []
  try {
    const result = await generateQuiz(params, (usage) => usageParts.push(usage))
    await guard.finish(sumUsage(...usageParts))
    if (!result.ok) return Response.json({ questions: [], error: result.message }, { status: 409 })
    return Response.json({ questions: result.questions })
  } catch (error) {
    await guard.fail()
    captureRouteFailure(error, { endpoint: '/api/generate-quiz', operation: 'practicaExtra' })
    return Response.json(
      { questions: [], error: 'La IA no pudo generar el cuestionario en este momento. Volvé a intentarlo en unos instantes.' },
      { status: 502 },
    )
  }
}
