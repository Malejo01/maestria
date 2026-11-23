import { guardAiCall } from '@/lib/ai-guard'
import { captureAiSchemaFailure } from '@/lib/observability'
import type { AiSdkUsage } from '@/lib/ai-usage'
import { pistaPermitida, type ContextoDePista } from '@/lib/pista'
import { pensarPista } from '@/lib/pista-ia'
import type { Question } from '@/lib/types'

/**
 * Ronda X · X1 — POST { question, contexto, nivel, grado, materia }: una pista
 * para la pregunta en pantalla, antes de responder. Sólo en la práctica
 * (`pistaPermitida`), con tope diario propio (bucket `hint`). Si la IA no da
 * una pista que no regale la respuesta, 422.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { question?: Question; contexto?: ContextoDePista; nivel?: string; grado?: string; materia?: string } | null
  const q = body?.question
  if (!q || typeof q.question !== 'string' || typeof q.type !== 'string' || q.type === 'essay') {
    return Response.json({ error: 'Pregunta inválida' }, { status: 400 })
  }
  if (!pistaPermitida(body?.contexto ?? null)) {
    return Response.json({ error: 'En este cuestionario no hay pistas.' }, { status: 403 })
  }

  const guard = await guardAiCall({ bucket: 'hint', nivel: body?.nivel })
  if (!guard.ok) return guard.response

  let usage: AiSdkUsage | undefined
  try {
    const pista = await pensarPista({ question: q, nivel: body?.nivel, grado: body?.grado, materia: body?.materia, onUsage: (u) => (usage = u) })
    await guard.finish(usage)
    if (!pista) return Response.json({ error: 'Para esta pregunta no hay una pista que no regale la respuesta.' }, { status: 422 })
    return Response.json({ pista })
  } catch (error) {
    await guard.fail()
    captureAiSchemaFailure(error, { endpoint: '/api/quiz/pista', fallback: 'none', nivel: body?.nivel })
    return Response.json({ error: 'No se pudo pensar una pista.' }, { status: 500 })
  }
}
