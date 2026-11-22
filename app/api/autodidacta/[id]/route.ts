import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { leerMateriaPersonal } from '@/lib/autodidacta-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/** Ronda T · E1 — GET: la materia personal con lo que sabe, lo que tiene que reforzar y el plan. Ajena: 404. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })
  try {
    const materia = await leerMateriaPersonal(viewer.id, id)
    if (!materia) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    return NextResponse.json(materia)
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta/[id]', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer' }, { status: 500 })
  }
}
