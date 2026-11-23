import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { crearLinkDeInforme, informesDisponibles, linksDelAlumno } from '@/lib/informe-familia-server'
import { urlDelSitio } from '@/lib/sitio'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda V · V4 — Los links del informe para la familia de un alumno.
 *   GET  → { disponible, links }   (sin la 047, disponible: false)
 *   POST { proximosPasos } → { link, venceEl }   (el token se ve una sola vez)
 * Sólo de alumnos del docente.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { userId } = await params
  try {
    if (!(await informesDisponibles())) return NextResponse.json({ disponible: false, links: [] })
    return NextResponse.json({ disponible: true, links: await linksDelAlumno(teacher.id, decodeURIComponent(userId)) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]/informes', operation: 'GET' })
    return NextResponse.json({ disponible: false, links: [] })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { userId } = await params
  const cuerpo = (await req.json().catch(() => null)) as { proximosPasos?: unknown } | null
  try {
    if (!(await informesDisponibles())) return NextResponse.json({ error: 'Todavía no está disponible.' }, { status: 409 })
    const creado = await crearLinkDeInforme(teacher.id, decodeURIComponent(userId), String(cuerpo?.proximosPasos ?? ''))
    if (!creado) return NextResponse.json({ error: 'Ese alumno no está en tus grupos.' }, { status: 404 })
    return NextResponse.json({ link: `${urlDelSitio()}/informe/${creado.token}`, venceEl: creado.venceEl })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]/informes', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo armar el link' }, { status: 500 })
  }
}
