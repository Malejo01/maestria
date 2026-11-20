import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { bloqueoParaGenerar } from '@/lib/planes-server'
import { crearDiagnostico, diagnosticoDisponible, grupoDe, temasDificilesDe } from '@/lib/diagnostico-server'
import { leerResultados } from '@/lib/diagnostico-resultados-server'
import { destinatarioDisponible } from '@/lib/destinatario-server'
import type { Destino } from '@/lib/fichas-server'
import { DIAGNOSTICO } from '@/lib/textos'

export const dynamic = 'force-dynamic'

function destinoDe(params: URLSearchParams | { alumno?: string; invitacion?: number }): Destino | null {
  const alumno = params instanceof URLSearchParams ? params.get('alumno') : params.alumno
  if (alumno) return { userId: alumno }
  const invitacion = Number(params instanceof URLSearchParams ? params.get('invitacion') : params.invitacion)
  return Number.isInteger(invitacion) && invitacion > 0 ? { invitacionId: invitacion } : null
}

/**
 * GET /api/teacher/diagnosticos?alumno=… | ?invitacion=…
 *
 * J4/J6: lo que la ficha necesita para "Armar diagnóstico" (el grupo, las
 * unidades de su materia, los temas que le cuestan) y los diagnósticos que ya
 * tiene con su resultado. `disponible: false` si la 027 no corrió.
 */
export async function GET(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const destino = destinoDe(new URL(req.url).searchParams)
  if (!destino) return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 })

  try {
    if (!(await diagnosticoDisponible())) return NextResponse.json({ disponible: false })
    const dificiles = await temasDificilesDe(teacher.id, destino)
    const grupo = await grupoDe(teacher.id, destino, dificiles.materiaId)
    if (!grupo) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json({
      disponible: true,
      // L0: sin la 028 no hay dónde guardar que es sólo para este alumno, y
      // armarlo lo asignaría al grupo entero. El botón queda deshabilitado.
      individualDisponible: await destinatarioDisponible(),
      grupo: { classroomId: grupo.classroomId, materiaId: grupo.materiaId, materia: grupo.etiqueta, unidades: grupo.unidades },
      // Los temas que le cuestan sólo cuentan si la ficha es de esta materia.
      temasDificiles: dificiles.materiaId === grupo.materiaId ? dificiles.temas : [],
      // J6: cada diagnóstico con el resultado de ESTE alumno.
      diagnosticos: await leerResultados(teacher.id, grupo, destino),
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer el diagnóstico', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

const crearSchema = z.object({
  alumno: z.string().min(1).optional(),
  invitacion: z.number().int().positive().optional(),
  modo: z.enum(['por_unidad', 'integral']),
})

/**
 * POST /api/teacher/diagnosticos — { alumno | invitacion, modo }
 *
 * Crea el diagnóstico de ESE alumno o invitación (L0: sólo para él, no para
 * el resto del grupo; sin la 028, 409). Los cuestionarios se generan después, uno
 * por pedido (POST /api/teacher/diagnosticos/[id]/cuestionarios), para que el
 * docente vea el avance y una falla no se lleve puestos a los demás.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const datos = crearSchema.safeParse(await req.json().catch(() => null))
  const destino = datos.success ? destinoDe(datos.data) : null
  if (!datos.success || !destino) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  try {
    // Si ya no puede generar (plan vencido o tope), que se entere antes de crear nada.
    const bloqueo = await bloqueoParaGenerar(teacher.id, teacher.email, {}, { cuestionario: true })
    if (bloqueo) return bloqueo
    if (!(await diagnosticoDisponible())) {
      return NextResponse.json({ error: 'El diagnóstico todavía no está disponible.' }, { status: 409 })
    }
    if (!(await destinatarioDisponible())) {
      return NextResponse.json({ error: DIAGNOSTICO.faltaActualizacion }, { status: 409 })
    }
    const dificiles = await temasDificilesDe(teacher.id, destino)
    const grupo = await grupoDe(teacher.id, destino, dificiles.materiaId)
    if (!grupo) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    const diagnosticoId = await crearDiagnostico({
      teacherId: teacher.id,
      classroomId: grupo.classroomId,
      materiaId: grupo.materiaId,
      modo: datos.data.modo,
      destinatario: destino,
    })
    return NextResponse.json({ diagnosticoId })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/diagnosticos', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo crear el diagnóstico', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
