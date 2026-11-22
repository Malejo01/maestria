import { NextResponse } from 'next/server'
import { bloqueoIndividual } from '@/lib/planes-server'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { fichaSchema, normalizarFicha } from '@/lib/fichas'
import { faltaLa027, guardarFicha, leerFicha, type Destino } from '@/lib/fichas-server'

export const dynamic = 'force-dynamic'

/** `?alumno=<userId>` o `?invitacion=<id>`. */
function destinoDe(url: string): Destino | null {
  const params = new URL(url).searchParams
  const alumno = params.get('alumno')
  if (alumno) return { userId: alumno }
  const invitacion = Number(params.get('invitacion'))
  if (Number.isInteger(invitacion) && invitacion > 0) return { invitacionId: invitacion }
  return null
}

/**
 * GET /api/teacher/fichas?alumno=… | ?invitacion=…
 *
 * J2: la ficha del alumno (o de alguien que todavía no entró), con las
 * materias del docente y sus temas para elegir "qué le cuesta". Si la 027 no
 * corrió, `disponible: false`.
 */
export async function GET(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const destino = destinoDe(req.url)
  if (!destino) return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 })

  try {
    const ficha = await leerFicha(teacher.id, destino)
    if (!ficha) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json(ficha)
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/fichas', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer la ficha', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

/** PUT /api/teacher/fichas?alumno=… | ?invitacion=… — la ficha entera, nombre incluido. */
export async function PUT(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const destino = destinoDe(req.url)
  if (!destino) return NextResponse.json({ error: 'Falta el alumno' }, { status: 400 })
  // B1: la ficha es una función individual (plan Particular).
  const soloParticular = await bloqueoIndividual(teacher.id, teacher.email)
  if (soloParticular) return soloParticular

  const datos = fichaSchema.safeParse(await req.json().catch(() => null))
  if (!datos.success) {
    return NextResponse.json({ error: 'Revisá los datos: el nombre no puede quedar vacío.' }, { status: 400 })
  }

  try {
    const { nombre, ...resto } = datos.data
    const guardada = await guardarFicha(teacher.id, destino, nombre, normalizarFicha(resto))
    if (!guardada) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (faltaLa027(error)) {
      return NextResponse.json({ error: 'La ficha todavía no está disponible.' }, { status: 409 })
    }
    captureRouteFailure(error, { endpoint: '/api/teacher/fichas', operation: 'PUT' })
    return NextResponse.json(
      { error: 'No se pudo guardar la ficha', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
