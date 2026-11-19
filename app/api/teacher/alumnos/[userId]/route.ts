import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { LARGO_MAXIMO_CONTEXTO, guardarContexto, leerFichaAlumno, quitarAlumno } from '@/lib/alumnos-docente-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/alumnos/[userId]
 *
 * La ficha de un alumno: qué prepara, cómo le va tema por tema, sus intentos y
 * los errores que se le repiten. Sólo lo que hizo dentro de los grupos de este
 * docente; 404 si no es alumno suyo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const { userId } = await params

  try {
    const ficha = await leerFichaAlumno(teacher.id, userId)
    if (!ficha) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json({ ficha })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo leer la ficha', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

const contextoSchema = z.object({ contexto: z.string().trim().max(LARGO_MAXIMO_CONTEXTO) })

/**
 * PATCH /api/teacher/alumnos/[userId] — { contexto }
 *
 * Guarda qué prepara el alumno y para cuándo. Es lo que escribe
 * `classroom_members.contexto` (migración 025).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const { userId } = await params

  try {
    const datos = contextoSchema.safeParse(await req.json().catch(() => null))
    if (!datos.success) {
      return NextResponse.json({ error: `Hasta ${LARGO_MAXIMO_CONTEXTO} caracteres.` }, { status: 400 })
    }

    const guardado = await guardarContexto(teacher.id, userId, datos.data.contexto)
    if (!guardado) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json({ contexto: datos.data.contexto })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]', operation: 'PATCH' })
    return NextResponse.json(
      { error: 'No se pudo guardar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/teacher/alumnos/[userId]
 *
 * J1: quita al alumno de todos los grupos de este docente. Reversible: no se
 * borra nada de lo que respondió (lib/alumnos-docente-server.ts, quitarAlumno).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })

  const { userId } = await params

  try {
    const quitadas = await quitarAlumno(teacher.id, userId)
    if (quitadas === 0) return NextResponse.json({ error: 'Ese alumno no está en tus grupos' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/alumnos/[userId]', operation: 'DELETE' })
    return NextResponse.json(
      { error: 'No se pudo quitar', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
