import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { paraRepasarHoy } from '@/lib/repaso-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda X · X2 — GET /api/student/repaso[?materia=Nombre]: las preguntas que
 * tocan hoy en el repaso espaciado. Sólo con cuenta (el invitado no tiene
 * práctica libre). No llama a la IA.
 */
export async function GET(req: Request) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ preguntas: [] })
  const materia = new URL(req.url).searchParams.get('materia')?.slice(0, 200) || undefined
  try {
    return NextResponse.json({ preguntas: await paraRepasarHoy(viewer.id, materia) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/repaso', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo armar el repaso' }, { status: 500 })
  }
}
