import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { grupoDe, temasDificilesDe } from '@/lib/diagnostico-server'
import { faltaLa027, guardarFicha, leerFicha, type Destino } from '@/lib/fichas-server'
import { sumarTemasDificiles } from '@/lib/fichas'

export const dynamic = 'force-dynamic'

const schema = z.object({
  alumno: z.string().min(1).optional(),
  invitacion: z.number().int().positive().optional(),
  temas: z.array(z.string().min(1)).min(1).max(200),
})

/**
 * POST /api/teacher/diagnosticos/marcar-temas — { alumno | invitacion, temas }
 *
 * J6: "Marcar los N temas que falló como temas que le cuestan". Lo confirma el
 * docente; nunca se marca solo. Los temas se SUMAN a los que ya tenía la ficha
 * (son de la materia del diagnóstico: si la ficha no tenía materia, queda ésa;
 * si tenía otra, pasa a ésta, porque los temas son de una materia).
 */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const datos = schema.safeParse(await req.json().catch(() => null))
  const destino: Destino | null = !datos.success
    ? null
    : datos.data.alumno
      ? { userId: datos.data.alumno }
      : datos.data.invitacion
        ? { invitacionId: datos.data.invitacion }
        : null
  if (!datos.success || !destino) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  try {
    const leida = await leerFicha(teacher.id, destino)
    if (!leida) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    if (!leida.disponible) return NextResponse.json({ error: 'La ficha todavía no está disponible.' }, { status: 409 })
    const grupo = await grupoDe(teacher.id, destino, (await temasDificilesDe(teacher.id, destino)).materiaId)
    if (!grupo) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })

    const ficha = sumarTemasDificiles(leida.ficha, grupo.materiaId, datos.data.temas)
    await guardarFicha(teacher.id, destino, leida.nombre, ficha)
    return NextResponse.json({ temasDificiles: ficha.temasDificiles })
  } catch (error) {
    if (faltaLa027(error)) return NextResponse.json({ error: 'La ficha todavía no está disponible.' }, { status: 409 })
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos/marcar-temas', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo marcar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
