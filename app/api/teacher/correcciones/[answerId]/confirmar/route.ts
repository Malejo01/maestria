import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { confirmarCorreccion, ensayoDelDocente } from '@/lib/correcciones-server'
import { correccionConfirmada } from '@/lib/ensayo'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda W · W5 — POST { criterios, nota, devolucion }: el docente confirma (o
 * cambia) la corrección. Recién ahí el alumno ve la nota y la devolución.
 */
export async function POST(req: Request, { params }: { params: Promise<{ answerId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = Number((await params).answerId)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Respuesta inválida' }, { status: 400 })
  try {
    const ensayo = await ensayoDelDocente(teacher.id, id)
    if (!ensayo) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    const correccion = correccionConfirmada(await req.json().catch(() => null), ensayo.rubrica)
    if (!correccion) return NextResponse.json({ error: 'Corrección inválida' }, { status: 400 })
    await confirmarCorreccion(teacher.id, ensayo, correccion)
    return NextResponse.json({ ok: true, correccion })
  } catch (error) {
    if (['42P01', '42703'].includes((error as { code?: string })?.code ?? '')) {
      return NextResponse.json({ error: 'La corrección todavía no está disponible' }, { status: 409 })
    }
    captureRouteFailure(error, { endpoint: '/api/teacher/correcciones/confirmar', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar la corrección' }, { status: 500 })
  }
}
