import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { avisosDelDocente, marcarAvisosVistos } from '@/lib/avisos-docente-server'
import { captureRouteFailure } from '@/lib/observability'
import { isAdminEmail } from '@/lib/ai-rate-limit'

export const dynamic = 'force-dynamic'

/**
 * O10 · La campanita del docente.
 *   GET  → `{ avisos, vistoEl }` (de lo que ya hay en la base, últimas 2 semanas)
 *   POST → marca todo como visto (al abrir la campanita)
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  try {
    return NextResponse.json(await avisosDelDocente(teacher.id, { esAdmin: isAdminEmail(teacher.email) }))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/avisos', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer los avisos' }, { status: 500 })
  }
}

export async function POST() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  try {
    await marcarAvisosVistos(teacher.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/avisos', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
