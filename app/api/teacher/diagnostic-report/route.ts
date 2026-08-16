import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { loadCourseDiagnostic } from '@/lib/diagnostic-report-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/diagnostic-report
 *
 * El diagnóstico del 10/08 leído a nivel curso, para decidir qué nivelar.
 *
 * Va aparte de `/api/teacher/classrooms/[id]/report` y no como un modo suyo,
 * porque ese endpoint filtra todo por `classroom_id` y los 84 intentos del
 * diagnóstico lo tienen en NULL: no se tomó dentro de un aula. Forzarlo ahí
 * pediría inventar una pertenencia que no existió.
 *
 * No devuelve un solo nombre propio. El agregado sirve para planificar la
 * clase, y para eso el curso es la unidad de análisis; el detalle por alumno es
 * otra pregunta y merece otro endpoint, con su propia decisión de exponerlo.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver el diagnóstico' }, { status: 403 })
  }

  try {
    return NextResponse.json({ report: await loadCourseDiagnostic() })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'No se pudo armar el reporte del diagnóstico',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
