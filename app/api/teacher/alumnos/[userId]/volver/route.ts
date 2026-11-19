import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { volverASumarAlumno } from '@/lib/alumnos-docente-server'
import { bloqueoParaSumarAlumno } from '@/lib/planes-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/teacher/alumnos/[userId]/volver
 *
 * J1: vuelve a sumar a un alumno que el docente había quitado, con toda su
 * historia. Vuelve a ocupar un lugar, así que pasa por el cupo del plan: si
 * no hay lugar, el mismo 402 que agregar a un alumno nuevo.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const { userId } = await params

  try {
    const bloqueo = await bloqueoParaSumarAlumno(teacher.id, teacher.email)
    if (bloqueo) return bloqueo

    const sumadas = await volverASumarAlumno(teacher.id, userId)
    if (sumadas === 0) return NextResponse.json({ error: 'Ese alumno no estaba entre los quitados' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]/volver', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo volver a sumar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
