import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import {
  LARGO_MAXIMO_CONTEXTO,
  LARGO_MAXIMO_NOMBRE,
  crearInvitacion,
  leerMisAlumnos,
} from '@/lib/alumnos-docente-server'
import { asegurarGrupoDe } from '@/lib/onboarding-docente-server'
import { bloqueoParaSumarAlumno } from '@/lib/planes-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/alumnos
 *
 * El listado de Mis alumnos: una fila por persona, cruzando los grupos del
 * docente, con la sugerencia y el resumen. Todo se filtra por sus grupos.
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  try {
    return NextResponse.json(await leerMisAlumnos(teacher.id))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron leer tus alumnos', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

const altaSchema = z.object({
  nombre: z.string().trim().min(1).max(LARGO_MAXIMO_NOMBRE),
  contexto: z.string().trim().max(LARGO_MAXIMO_CONTEXTO).optional().default(''),
  teacherProgramId: z.number().int().positive(),
})

/**
 * POST /api/teacher/alumnos — { nombre, contexto?, teacherProgramId }
 *
 * Agrega a un alumno por su nombre. El grupo de esa materia se crea detrás si
 * todavía no existe: el docente nunca ve un botón "crear aula". Devuelve el
 * código del grupo, que es lo que el docente le pasa al alumno.
 */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  try {
    const datos = altaSchema.safeParse(await req.json().catch(() => null))
    if (!datos.success) {
      return NextResponse.json({ error: 'Escribí el nombre del alumno y elegí la materia.' }, { status: 400 })
    }

    // El alumno que supera el cupo no entra: se frena acá y la UI muestra la
    // pantalla de límite (lib/planes.ts).
    const bloqueo = await bloqueoParaSumarAlumno(teacher.id, teacher.email)
    if (bloqueo) return bloqueo

    const grupo = await asegurarGrupoDe(teacher.id, datos.data.teacherProgramId)
    if (!grupo) {
      return NextResponse.json({ error: 'Esa materia no es tuya o ya no existe' }, { status: 404 })
    }

    const invitacionId = await crearInvitacion(grupo.id, datos.data.nombre, datos.data.contexto)
    return NextResponse.json({ invitacionId, grupo })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo agregar al alumno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
