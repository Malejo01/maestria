import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { loadCourseDiagnostic } from '@/lib/diagnostic-report-server'
import { sql } from '@/lib/db'
import type { ProgramaParaVincular } from '@/lib/diagnostic-report'
import { captureRouteFailure } from '@/lib/observability'

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
/**
 * O6: `?programa=<id>` lee el diagnóstico contra una materia del docente
 * (`teacher_programs`, sus unidades y temas) en vez del mapa a mano del 10/08.
 * Una materia que no es suya da 404.
 */
async function programaDelDocente(id: number, docenteId: string): Promise<ProgramaParaVincular | null> {
  const filas = (await sql`
    SELECT subject_name, units FROM teacher_programs WHERE id = ${id} AND user_id = ${docenteId} LIMIT 1
  `) as { subject_name: string; units: unknown }[]
  if (!filas[0]) return null
  const unidades = Array.isArray(filas[0].units) ? (filas[0].units as { name?: unknown; topics?: { name?: unknown }[] }[]) : []
  return {
    materia: filas[0].subject_name,
    unidades: unidades.map((u) => ({
      nombre: typeof u?.name === 'string' ? u.name : '',
      temas: (Array.isArray(u?.topics) ? u.topics : []).map((t) => (typeof t?.name === 'string' ? t.name : '')).filter(Boolean),
    })).filter((u) => u.nombre),
  }
}

export async function GET(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver el diagnóstico' }, { status: 403 })
  }

  try {
    const pedido = new URL(req.url).searchParams.get('programa')
    let programa: ProgramaParaVincular | null = null
    if (pedido) {
      const id = Number(pedido)
      programa = Number.isInteger(id) && id > 0 ? await programaDelDocente(id, teacher.id) : null
      if (!programa) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })
    }
    return NextResponse.json({ report: await loadCourseDiagnostic({ programa }) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnostic-report', operation: 'GET' })
    return NextResponse.json(
      {
        error: 'No se pudo armar el reporte del diagnóstico',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
