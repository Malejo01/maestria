import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { ensayosParaCorregir } from '@/lib/correcciones-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/** Ronda W · W5 — GET: los ensayos de los grupos del docente que esperan corrección. */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    return NextResponse.json(await ensayosParaCorregir(teacher.id))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/correcciones', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer las correcciones' }, { status: 500 })
  }
}
