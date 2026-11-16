import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { borrarInvitacion } from '@/lib/alumnos-docente-server'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/teacher/alumnos/invitaciones/[id]
 *
 * Saca del listado a un alumno que el docente agregó y todavía no entró. No
 * toca a nadie que ya esté en el grupo.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const invitacionId = Number((await params).id)
  if (!Number.isInteger(invitacionId) || invitacionId <= 0) {
    return NextResponse.json({ error: 'Invitación inválida' }, { status: 400 })
  }

  try {
    const borrada = await borrarInvitacion(teacher.id, invitacionId)
    if (!borrada) return NextResponse.json({ error: 'Esa invitación no existe' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/invitaciones/[id]', operation: 'DELETE' })
    return NextResponse.json(
      { error: 'No se pudo quitar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
