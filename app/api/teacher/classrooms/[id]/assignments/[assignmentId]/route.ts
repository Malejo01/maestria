import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getOwnedClassroom, parseOptionalDate, parseOptionalPositiveInt } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

async function loadContext(
  params: Promise<{ id: string; assignmentId: string }>,
  teacherId: string
): Promise<{ classroomId: number; assignmentId: number } | null> {
  const { id, assignmentId } = await params
  const classroomId = Number(id)
  const parsedAssignmentId = Number(assignmentId)

  if (!Number.isFinite(classroomId) || classroomId <= 0) return null
  if (!Number.isFinite(parsedAssignmentId) || parsedAssignmentId <= 0) return null

  const classroom = await getOwnedClassroom(classroomId, teacherId)
  return classroom ? { classroomId, assignmentId: parsedAssignmentId } : null
}

// PATCH — move the dates or change the attempt cap of an already-published quiz.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden editar asignaciones' }, { status: 403 })
  }

  const context = await loadContext(params, teacher.id)
  if (!context) {
    return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  }

  try {
    const existing = await sql`
      SELECT id, opens_at, due_at, max_attempts
      FROM classroom_assignments
      WHERE id = ${context.assignmentId} AND classroom_id = ${context.classroomId}
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const parsedOpensAt = parseOptionalDate(body?.opensAt)
    const parsedDueAt = parseOptionalDate(body?.dueAt)
    const parsedMaxAttempts = parseOptionalPositiveInt(body?.maxAttempts)

    // undefined means "not sent"; it only signals a bad value when the client
    // actually included the field.
    if (parsedOpensAt === undefined && body?.opensAt !== undefined) {
      return NextResponse.json({ error: 'La fecha de apertura no es válida' }, { status: 400 })
    }
    if (parsedDueAt === undefined && body?.dueAt !== undefined) {
      return NextResponse.json({ error: 'La fecha límite no es válida' }, { status: 400 })
    }
    if (parsedMaxAttempts === undefined && body?.maxAttempts !== undefined) {
      return NextResponse.json({ error: 'El máximo de intentos debe ser un número mayor a 0' }, { status: 400 })
    }

    const opensAt = parsedOpensAt === undefined ? existing[0].opens_at : parsedOpensAt
    const dueAt = parsedDueAt === undefined ? existing[0].due_at : parsedDueAt
    const maxAttempts = parsedMaxAttempts === undefined ? existing[0].max_attempts : parsedMaxAttempts

    if (opensAt && dueAt && new Date(opensAt) >= new Date(dueAt)) {
      return NextResponse.json({ error: 'La fecha límite tiene que ser posterior a la de apertura' }, { status: 400 })
    }

    const rows = await sql`
      UPDATE classroom_assignments
      SET opens_at = ${opensAt}, due_at = ${dueAt}, max_attempts = ${maxAttempts}, updated_at = NOW()
      WHERE id = ${context.assignmentId} AND classroom_id = ${context.classroomId}
      RETURNING id, classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at
    `

    return NextResponse.json({ assignment: rows[0] })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/assignments/[assignmentId]', operation: 'PATCH' })
    return NextResponse.json(
      { error: 'No se pudo actualizar la asignación', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// DELETE — unpublish. The quiz itself and any attempts already made survive;
// only the link to the aula goes away (quiz_attempts.assignment_id → NULL).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden quitar asignaciones' }, { status: 403 })
  }

  const context = await loadContext(params, teacher.id)
  if (!context) {
    return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  }

  try {
    const deleted = await sql`
      DELETE FROM classroom_assignments
      WHERE id = ${context.assignmentId} AND classroom_id = ${context.classroomId}
      RETURNING id
    `

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/assignments/[assignmentId]', operation: 'DELETE' })
    return NextResponse.json(
      { error: 'No se pudo quitar la asignación', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
