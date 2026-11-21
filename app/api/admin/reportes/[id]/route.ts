import { NextResponse } from 'next/server'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { esEstadoDeReporte } from '@/lib/reportes'
import { cambiarEstadoDeReporte } from '@/lib/reportes-server'

export const dynamic = 'force-dynamic'

/** PATCH /api/admin/reportes/[id] — { estado: 'nuevo' | 'visto' | 'resuelto' }. Sólo admin. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  const cuerpo = (await req.json().catch(() => null)) as { estado?: unknown } | null
  if (!esEstadoDeReporte(cuerpo?.estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  try {
    const cambiado = await cambiarEstadoDeReporte(id, cuerpo.estado)
    if (!cambiado) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/reportes/[id]', operation: 'PATCH' })
    return NextResponse.json({ error: 'No se pudo cambiar el estado' }, { status: 500 })
  }
}
