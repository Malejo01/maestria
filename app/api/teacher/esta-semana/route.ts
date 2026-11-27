import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerEstaSemana } from '@/lib/esta-semana-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/esta-semana
 *
 * AB5: quién practicó en los últimos 7 días, cuánto y qué tema le falta a
 * cada uno (lib/esta-semana.ts). Sólo lee.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  }
  try {
    return NextResponse.json(await leerEstaSemana(teacher.id))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/esta-semana', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer la semana' }, { status: 500 })
  }
}
