import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { revocarLinkDeInforme } from '@/lib/informe-familia-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/** Ronda V · V4 — DELETE: revoca un link del informe (sólo el del docente). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Link inválido' }, { status: 400 })
  try {
    const ok = await revocarLinkDeInforme(teacher.id, id)
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ese link no es tuyo o ya estaba revocado' }, { status: 404 })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/informes/[id]', operation: 'DELETE' })
    return NextResponse.json({ error: 'No se pudo revocar' }, { status: 500 })
  }
}
