import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getOwnedClassroom } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * DELETE — remove a student from the aula.
 *
 * Soft removal (status = 'removed') rather than a real DELETE: the student's
 * attempts stay linked to the aula, so removing someone doesn't silently
 * rewrite the teacher's own history. Re-joining with the code flips the same
 * row back to 'active'.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden quitar alumnos' }, { status: 403 })
  }

  const { id, memberId } = await params
  const classroomId = Number(id)
  const parsedMemberId = Number(memberId)

  if (!Number.isFinite(classroomId) || classroomId <= 0 || !Number.isFinite(parsedMemberId) || parsedMemberId <= 0) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    const updated = await sql`
      UPDATE classroom_members
      SET status = 'removed', updated_at = NOW()
      WHERE id = ${parsedMemberId} AND classroom_id = ${classroomId}
      RETURNING id
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: 'El alumno no pertenece a esta aula' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/members/[memberId]', operation: 'DELETE' })
    return NextResponse.json(
      { error: 'No se pudo quitar al alumno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
