import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { createUniqueJoinCode, getOwnedClassroom } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

// Reading an aula lives in ./report, which returns everything this route used
// to plus the marks and topic accuracy the dashboard needs. Keeping a second,
// thinner read here would only let the two shapes drift apart.

function parseClassroomId(raw: string): number | null {
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * PATCH — rename, open/close, or regenerate the join code.
 *
 * Regenerating is the revoke mechanism: students already enrolled keep their
 * membership, but the old code stops working for anyone new. Closing the aula
 * is the stronger action — it makes every assignment unavailable.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden editar aulas' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = parseClassroomId(id)
  if (!classroomId) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    const body = await req.json()

    const name = body?.name === undefined ? classroom.name : String(body.name).trim()
    if (!name) {
      return NextResponse.json({ error: 'El nombre del aula no puede quedar vacío' }, { status: 400 })
    }

    const status =
      body?.status === 'open' || body?.status === 'closed' ? body.status : classroom.status

    const joinCode = body?.regenerateCode === true ? await createUniqueJoinCode() : classroom.join_code

    const rows = await sql`
      UPDATE classrooms
      SET name = ${name}, status = ${status}, join_code = ${joinCode}, updated_at = NOW()
      WHERE id = ${classroomId} AND teacher_id = ${teacher.id}
      RETURNING id, teacher_program_id, name, join_code, status, created_at
    `

    return NextResponse.json({ classroom: rows[0] })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]', operation: 'PATCH' })
    return NextResponse.json(
      { error: 'No se pudo actualizar el aula', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// DELETE — removes the aula, its roster and its assignments (ON DELETE CASCADE).
// Students' quiz_attempts survive with classroom_id set to NULL, so nobody
// loses their practice history because a teacher tidied up.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden eliminar aulas' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = parseClassroomId(id)
  if (!classroomId) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const deleted = await sql`
      DELETE FROM classrooms
      WHERE id = ${classroomId} AND teacher_id = ${teacher.id}
      RETURNING id
    `

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]', operation: 'DELETE' })
    return NextResponse.json(
      { error: 'No se pudo eliminar el aula', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
