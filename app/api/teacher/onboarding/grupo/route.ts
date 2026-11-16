import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { asegurarGrupoDe } from '@/lib/onboarding-docente-server'
import { bloqueoParaGenerar } from '@/lib/planes-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/teacher/onboarding/grupo — { teacherProgramId }
 *
 * El grupo automático. Devuelve el grupo de esa materia y, si todavía no
 * existe, lo crea. El docente no ve un botón "crear aula": pide el link para
 * su primer alumno y el grupo aparece detrás. Es idempotente, así que apretar
 * dos veces no crea dos grupos.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  }

  // Plan vencido: modo solo lectura (lib/planes.ts).
  const bloqueo = await bloqueoParaGenerar(teacher.id, teacher.email)
  if (bloqueo) return bloqueo

  try {
    const body = (await req.json().catch(() => null)) as { teacherProgramId?: unknown } | null
    const teacherProgramId = Number(body?.teacherProgramId)

    if (!Number.isInteger(teacherProgramId) || teacherProgramId <= 0) {
      return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })
    }

    const grupo = await asegurarGrupoDe(teacher.id, teacherProgramId)
    if (!grupo) {
      return NextResponse.json({ error: 'Esa materia no es tuya o ya no existe' }, { status: 404 })
    }

    return NextResponse.json({ grupo })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/onboarding/grupo', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo preparar el grupo', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
