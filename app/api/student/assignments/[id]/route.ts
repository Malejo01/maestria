import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getViewer } from '@/lib/auth-session'
import { ASSIGNMENT_STATE_LABEL, assignmentState, canStartAssignment } from '@/lib/classrooms'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/assignments/[id]
 *
 * Hands the student the questions of an assigned cuestionario — but only if
 * they belong to the aula and the assignment is actually open for them. This
 * is the authoritative check: the list endpoint computes the same state for
 * display, but a student could always call this URL directly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Entrá al aula con tu código para resolver el cuestionario.' }, { status: 401 })
  }

  const { id } = await params
  const assignmentId = Number(id)
  if (!Number.isFinite(assignmentId) || assignmentId <= 0) {
    return NextResponse.json({ error: 'Asignación inválida' }, { status: 400 })
  }

  try {
    const rows = (await sql`
      SELECT a.id,
             a.classroom_id,
             a.opens_at,
             a.due_at,
             a.max_attempts,
             c.status AS classroom_status,
             c.teacher_program_id,
             q.id AS quiz_id,
             q.title,
             q.mode,
             q.question_count,
             q.questions,
             q.selected_topics,
             q.pedagogy_context,
             q.subject_name
      FROM classroom_assignments a
      JOIN classrooms c ON c.id = a.classroom_id
      JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      JOIN classroom_members m ON m.classroom_id = c.id AND m.user_id = ${viewer.id} AND m.status = 'active'
      WHERE a.id = ${assignmentId}
      LIMIT 1
    `) as Record<string, any>[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontramos ese cuestionario en tus aulas.' }, { status: 404 })
    }

    const row = rows[0]

    const attemptRows = (await sql`
      SELECT COUNT(*)::int AS attempts_used
      FROM quiz_attempts
      WHERE assignment_id = ${assignmentId} AND user_id = ${viewer.id}
    `) as { attempts_used: number }[]

    const attemptsUsed = Number(attemptRows[0]?.attempts_used ?? 0)

    const window = {
      opensAt: row.opens_at ? new Date(row.opens_at).toISOString() : null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
      maxAttempts: row.max_attempts === null ? null : Number(row.max_attempts),
    }

    const state = assignmentState(window, attemptsUsed, new Date(), row.classroom_status)

    if (!canStartAssignment(state)) {
      return NextResponse.json(
        { error: ASSIGNMENT_STATE_LABEL[state], state, attemptsUsed, ...window },
        { status: 403 }
      )
    }

    return NextResponse.json({
      assignment: {
        id: Number(row.id),
        classroomId: Number(row.classroom_id),
        teacherProgramId: Number(row.teacher_program_id),
        title: row.title,
        subjectName: row.subject_name,
        mode: row.mode,
        questionCount: Number(row.question_count),
        questions: Array.isArray(row.questions) ? row.questions : [],
        selectedTopics: Array.isArray(row.selected_topics) ? row.selected_topics : [],
        pedagogyContext: row.pedagogy_context ?? undefined,
        attemptsUsed,
        ...window,
        state,
      },
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/assignments/[id]', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo abrir el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
