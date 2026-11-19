import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { filtrarSinRespuestas, quitarAlumno } from '@/lib/alumnos-docente-server'

export const dynamic = 'force-dynamic'

const cuerpoSchema = z.object({ userIds: z.array(z.string().min(1)).min(1).max(500) })

/**
 * POST /api/teacher/alumnos/quitar-sin-respuestas — { userIds }
 *
 * J1, la acción en lote de fin de cuatrimestre. El docente confirma la lista
 * que vio; acá se vuelve a mirar quién de esa lista sigue sin haber respondido
 * nada y sólo a ésos se los quita. Devuelve cuántos quitó.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const datos = cuerpoSchema.safeParse(await req.json().catch(() => null))
  if (!datos.success) return NextResponse.json({ error: 'Lista inválida' }, { status: 400 })

  try {
    const aQuitar = await filtrarSinRespuestas(teacher.id, [...new Set(datos.data.userIds)])
    let quitados = 0
    for (const userId of aQuitar) {
      if ((await quitarAlumno(teacher.id, userId)) > 0) quitados++
    }
    return NextResponse.json({ quitados })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/quitar-sin-respuestas', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo quitar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
