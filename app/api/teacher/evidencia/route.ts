import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerEvidencia } from '@/lib/evidencia-del-muro-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/evidencia
 *
 * AB6: lo que ya practicaron los alumnos del docente, para mostrárselo en el
 * muro del 3.er alumno antes de la oferta (lib/evidencia-del-muro.ts).
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  }
  try {
    return NextResponse.json({ evidencia: await leerEvidencia(teacher.id) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/evidencia', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer la práctica de tus alumnos' }, { status: 500 })
  }
}
