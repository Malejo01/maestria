import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { ensayoDelDocente, guardarSugerencia } from '@/lib/correcciones-server'
import { sugerirCorreccion } from '@/lib/ensayo-ia'
import { captureAiSchemaFailure } from '@/lib/observability'
import type { AiSdkUsage } from '@/lib/ai-usage'

export const dynamic = 'force-dynamic'

/**
 * Ronda W · W5 — POST: la IA sugiere la corrección de un ensayo. Se guarda
 * como sugerencia; el alumno no ve nada hasta que el docente confirma.
 * Cuenta en el límite de corrección del docente.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ answerId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = Number((await params).answerId)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400 })

  let ensayo
  try {
    ensayo = await ensayoDelDocente(teacher.id, id)
  } catch {
    return NextResponse.json({ error: 'La corrección todavía no está disponible' }, { status: 409 })
  }
  if (!ensayo) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (ensayo.rubrica.length === 0) return NextResponse.json({ error: 'La pregunta no tiene rúbrica' }, { status: 422 })

  const guard = await guardAiCall({ bucket: 'grading', actor: 'docente' })
  if (!guard.ok) return guard.response
  let usage: AiSdkUsage | undefined
  try {
    const sugerencia = await sugerirCorreccion({ ...ensayo, onUsage: (u) => (usage = u) })
    await guard.finish(usage)
    if (!sugerencia) return NextResponse.json({ error: 'La sugerencia no fue válida' }, { status: 502 })
    await guardarSugerencia(teacher.id, id, sugerencia)
    return NextResponse.json({ sugerencia })
  } catch (error) {
    await guard.fail()
    captureAiSchemaFailure(error, { endpoint: '/api/teacher/correcciones/sugerir', fallback: 'none' })
    return NextResponse.json({ error: 'No se pudo sugerir la corrección' }, { status: 500 })
  }
}
