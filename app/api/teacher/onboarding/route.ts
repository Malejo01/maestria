import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerOnboardingDocente } from '@/lib/onboarding-docente-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/onboarding
 *
 * En qué hito del onboarding está el docente. Se deduce de sus datos, no de un
 * campo guardado: ver lib/onboarding-docente.ts.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  }

  try {
    return NextResponse.json({ onboarding: await leerOnboardingDocente(teacher.id) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/onboarding', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer tu progreso', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
