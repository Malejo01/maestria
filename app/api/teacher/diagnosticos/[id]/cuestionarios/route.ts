import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { captureRouteFailure } from '@/lib/observability'
import { bloqueoParaGenerar } from '@/lib/planes-server'
import { generateQuiz } from '@/lib/quiz-generation'
import { validarCuestionario } from '@/lib/diagnostico'
import { grupoDelDiagnostico, guardarYAsignar, leerDiagnostico, parametrosDeGeneracion } from '@/lib/diagnostico-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const pedidoSchema = z.object({
  unidadId: z.string().nullable(),
  temas: z.array(z.object({ id: z.string().min(1), preguntas: z.number().int().min(1) })).min(1).max(60),
})

/**
 * POST /api/teacher/diagnosticos/[id]/cuestionarios — { unidadId, temas: [{ id, preguntas }] }
 *
 * J4: genera UN cuestionario del diagnóstico (el reparto lo armó el cliente con
 * lib/diagnostico.ts y acá se vuelve a validar contra el programa), lo guarda
 * como `teacher_quizzes` tipo diagnóstico y lo asigna al grupo con un intento.
 *
 * Cuenta para el tope de cuestionarios del plan como cualquier generación: pasa
 * por `bloqueoParaGenerar` y deja su fila en `ai_usage_log` por el guard.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const diagnosticoId = Number((await params).id)
  const pedido = pedidoSchema.safeParse(await req.json().catch(() => null))
  if (!Number.isInteger(diagnosticoId) || !pedido.success) {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })
  }

  let marcarFalla: (() => Promise<void>) | null = null
  try {
    const diagnostico = await leerDiagnostico(teacher.id, diagnosticoId)
    if (!diagnostico) return NextResponse.json({ error: 'Ese diagnóstico no es tuyo' }, { status: 404 })
    const grupo = await grupoDelDiagnostico(teacher.id, diagnostico)
    if (!grupo) return NextResponse.json({ error: 'La materia del diagnóstico ya no existe' }, { status: 404 })

    const cuestionario = validarCuestionario(pedido.data, grupo.unidades, diagnostico.modo)
    if (!cuestionario) return NextResponse.json({ error: 'Ese reparto no corresponde al programa' }, { status: 400 })

    const bloqueo = await bloqueoParaGenerar(teacher.id, teacher.email, {}, { cuestionario: true })
    if (bloqueo) return bloqueo

    const guard = await guardAiCall({ bucket: 'quiz_generation', nivel: grupo.nivel, actor: 'docente' })
    if (!guard.ok) return guard.response
    marcarFalla = guard.fail

    const usos: (AiSdkUsage | undefined)[] = []
    const resultado = await generateQuiz(await parametrosDeGeneracion(teacher.id, grupo, cuestionario), (u) => usos.push(u))
    await guard.finish(sumUsage(...usos))
    marcarFalla = null

    if (!resultado.ok || resultado.questions.length === 0) {
      return NextResponse.json(
        { error: resultado.ok ? 'La IA no devolvió preguntas.' : resultado.message },
        { status: 409 },
      )
    }

    const quizId = await guardarYAsignar({
      teacherId: teacher.id,
      diagnostico,
      materia: grupo.materia,
      etiqueta: grupo.etiqueta,
      cuestionario,
      preguntas: resultado.questions,
    })
    return NextResponse.json({ quizId, preguntas: resultado.questions.length })
  } catch (error) {
    if (marcarFalla) await marcarFalla()
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos/[id]/cuestionarios', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo generar este cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    )
  }
}
