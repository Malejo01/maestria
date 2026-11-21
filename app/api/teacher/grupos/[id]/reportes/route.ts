import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { reportesDelGrupo } from '@/lib/reportes-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/grupos/[id]/reportes — M6: lo que los alumnos reportaron en
 * las tareas de este docente en este grupo (sin resolver). Otro docente: 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const docente = await getTeacherViewer()
  if (!docente) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const grupoId = Number((await params).id)
  if (!Number.isInteger(grupoId) || grupoId <= 0) return NextResponse.json({ error: 'Id inválido' }, { status: 400 })

  try {
    const reportes = await reportesDelGrupo(docente.id, grupoId)
    if (reportes === null) return NextResponse.json({ error: 'Grupo no encontrado' }, { status: 404 })
    return NextResponse.json({ reportes })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/grupos/[id]/reportes', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer los reportes' }, { status: 500 })
  }
}
