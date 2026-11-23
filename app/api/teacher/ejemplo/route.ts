import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { borrarMateriasDeEjemplo, crearMateriaDeEjemplo, ejemploDisponible, ejemplosDelDocente } from '@/lib/materia-de-ejemplo-server'
import { esAreaDeEjemplo } from '@/lib/materias-de-ejemplo'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda V · V2 — La materia de ejemplo del docente.
 *   GET    → { disponible, ejemplos }   (sin la 045, disponible: false)
 *   POST   { area } → el ejemplo creado (o el que ya tenía)
 *   DELETE → borra todo lo de ejemplo del docente
 * No llama a la IA ni cuenta para el plan.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const disponible = await ejemploDisponible()
    return NextResponse.json({ disponible, ejemplos: disponible ? await ejemplosDelDocente(teacher.id) : [] })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/ejemplo', operation: 'GET' })
    return NextResponse.json({ disponible: false, ejemplos: [] })
  }
}

export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const area = ((await req.json().catch(() => null)) as { area?: unknown } | null)?.area
  if (!esAreaDeEjemplo(area)) return NextResponse.json({ error: 'Elegí un área' }, { status: 400 })
  try {
    const ejemplo = await crearMateriaDeEjemplo(teacher.id, area)
    if (!ejemplo) return NextResponse.json({ error: 'Todavía no está disponible.' }, { status: 409 })
    return NextResponse.json(ejemplo)
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/ejemplo', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo crear el ejemplo' }, { status: 500 })
  }
}

export async function DELETE() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    return NextResponse.json({ borradas: await borrarMateriasDeEjemplo(teacher.id) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/ejemplo', operation: 'DELETE' })
    return NextResponse.json({ error: 'No se pudo borrar el ejemplo' }, { status: 500 })
  }
}
