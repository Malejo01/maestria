import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { cambiarFechaDeExamen, leerMateriaPersonal } from '@/lib/autodidacta-server'
import { fechaDeExamenValida } from '@/lib/autodidacta'
import { AUTODIDACTA } from '@/lib/textos'
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

/**
 * Ronda U · U2 — PATCH { fechaExamen }: cambia la fecha del examen. Con el pase
 * vigente, el pase se corre a la fecha nueva + 7 días una sola vez y nunca se
 * acorta. Ajena: 404.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })
  const fecha = ((await req.json().catch(() => null)) as { fechaExamen?: unknown } | null)?.fechaExamen
  if (!fechaDeExamenValida(fecha, new Date())) return NextResponse.json({ error: AUTODIDACTA.fechaInvalida }, { status: 400 })
  try {
    const cambio = await cambiarFechaDeExamen(viewer.id, id, fecha)
    if (!cambio) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    return NextResponse.json(cambio)
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta/[id]', operation: 'PATCH' })
    return NextResponse.json({ error: 'No se pudo cambiar la fecha' }, { status: 500 })
  }
}
