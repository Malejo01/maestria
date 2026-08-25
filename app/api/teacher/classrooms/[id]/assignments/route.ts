import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import {
  getClassroomAssignments,
  getOwnedClassroom,
  parseOptionalDate,
  parseOptionalPositiveInt,
} from '@/lib/classrooms-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver asignaciones' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = Number(id)
  if (!Number.isFinite(classroomId) || classroomId <= 0) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ assignments: await getClassroomAssignments(classroomId) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/assignments', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron obtener las asignaciones', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST — publish a saved cuestionario into the aula.
 *
 * opensAt / dueAt arrive as ISO strings built from the teacher's own browser,
 * so a deadline set as "viernes 23:59" means 23:59 in their timezone. Both
 * dates and maxAttempts are optional: omitting all three publishes a quiz that
 * is available immediately, forever, with unlimited attempts.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden asignar cuestionarios' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = Number(id)
  if (!Number.isFinite(classroomId) || classroomId <= 0) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const teacherQuizId = Number(body?.teacherQuizId)

    if (!Number.isFinite(teacherQuizId) || teacherQuizId <= 0) {
      return NextResponse.json({ error: 'Cuestionario inválido' }, { status: 400 })
    }

    const quizRows = await sql`
      SELECT id, teacher_program_id
      FROM teacher_quizzes
      WHERE id = ${teacherQuizId} AND user_id = ${teacher.id}
      LIMIT 1
    `

    if (quizRows.length === 0) {
      return NextResponse.json({ error: 'El cuestionario no pertenece a este docente' }, { status: 403 })
    }

    // An aula hands out one subject; assigning a quiz from a different program
    // would show students topics that aren't in their temario.
    if (Number(quizRows[0].teacher_program_id) !== Number(classroom.teacher_program_id)) {
      return NextResponse.json(
        { error: 'El cuestionario es de otra materia. Asigná uno de la materia del aula.' },
        { status: 400 }
      )
    }

    const opensAt = parseOptionalDate(body?.opensAt)
    const dueAt = parseOptionalDate(body?.dueAt)
    const maxAttempts = parseOptionalPositiveInt(body?.maxAttempts)

    if (opensAt === undefined && body?.opensAt !== undefined) {
      return NextResponse.json({ error: 'La fecha de apertura no es válida' }, { status: 400 })
    }
    if (dueAt === undefined && body?.dueAt !== undefined) {
      return NextResponse.json({ error: 'La fecha límite no es válida' }, { status: 400 })
    }
    if (maxAttempts === undefined && body?.maxAttempts !== undefined) {
      return NextResponse.json({ error: 'El máximo de intentos debe ser un número mayor a 0' }, { status: 400 })
    }

    if (opensAt && dueAt && opensAt >= dueAt) {
      return NextResponse.json({ error: 'La fecha límite tiene que ser posterior a la de apertura' }, { status: 400 })
    }

    const rows = await sql`
      INSERT INTO classroom_assignments (classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at, updated_at)
      VALUES (
        ${classroomId},
        ${teacherQuizId},
        ${opensAt ?? null},
        ${dueAt ?? null},
        ${maxAttempts ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT (classroom_id, teacher_quiz_id) DO UPDATE
        SET opens_at = EXCLUDED.opens_at,
            due_at = EXCLUDED.due_at,
            max_attempts = EXCLUDED.max_attempts,
            updated_at = NOW()
      RETURNING id, classroom_id, teacher_quiz_id, opens_at, due_at, max_attempts, created_at
    `

    // Mark the quiz as shared so the teacher's list stops calling it "pendiente".
    await sql`
      UPDATE teacher_quizzes SET status = 'saved', updated_at = NOW()
      WHERE id = ${teacherQuizId} AND user_id = ${teacher.id} AND status = 'pending_share'
    `

    return NextResponse.json({ assignment: rows[0], assignments: await getClassroomAssignments(classroomId) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/assignments', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo asignar el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
