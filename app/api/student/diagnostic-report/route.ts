import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { loadStudentDiagnostic } from '@/lib/diagnostic-report-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/diagnostic-report
 *
 * Cómo le fue al alumno que consulta, en el diagnóstico del 10/08.
 *
 * Devuelve 200 con `{ report: null }` —y no 404— cuando el alumno no rindió ese
 * día: "no te corresponde este reporte" es una respuesta válida, no un error, y
 * el bloque de /history simplemente no se dibuja.
 *
 * No toma parámetros a propósito. El alumno es siempre el viewer: un `userId`
 * en la query sería una forma de leer el resultado de un compañero.
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const report = await loadStudentDiagnostic(viewer.id)
    return NextResponse.json({ report })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/diagnostic-report', operation: 'GET' })
    return NextResponse.json(
      {
        error: 'No se pudo armar el reporte del diagnóstico',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
