import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { diagnosticoDisponible } from '@/lib/diagnostico-server'
import { grupoPropio, leerSeguimientoDelGrupo } from '@/lib/diagnostico-grupo-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/grupos/[id]/diagnosticos
 *
 * L4: lo que "Mis grupos" necesita para armar un diagnóstico o una práctica
 * del grupo (la materia y sus unidades) y el seguimiento de los que ya tiene:
 * por cuestionario, cuántos lo hicieron sobre el total; por tema, cuántos lo
 * acertaron. `disponible: false` sin la 027.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const classroomId = Number((await params).id)
  if (!Number.isInteger(classroomId) || classroomId <= 0) return NextResponse.json({ error: 'Grupo inválido' }, { status: 400 })

  try {
    if (!(await diagnosticoDisponible())) return NextResponse.json({ disponible: false })
    const grupo = await grupoPropio(teacher.id, classroomId)
    if (!grupo) return NextResponse.json({ error: 'Ese grupo no es tuyo' }, { status: 404 })
    return NextResponse.json({
      disponible: true,
      grupo: { classroomId: grupo.classroomId, materiaId: grupo.materiaId, materia: grupo.etiqueta, unidades: grupo.unidades },
      diagnosticos: await leerSeguimientoDelGrupo(teacher.id, grupo),
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/grupos/[id]/diagnosticos', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer el seguimiento del grupo', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
