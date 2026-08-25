import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getViewer } from '@/lib/auth-session'
import { assignmentState } from '@/lib/classrooms'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/student/classrooms — "Mis aulas".
 *
 * Returns every aula the viewer belongs to, each with the teacher's temario
 * (for free practice) and the assignments with their state computed for this
 * particular student. Guests and signed-in students take the same path.
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) {
    return NextResponse.json({ classrooms: [] })
  }

  try {
    const classroomRows = (await sql`
      SELECT c.id,
             c.name,
             c.status,
             c.teacher_program_id,
             m.joined_at,
             p.subject_name,
             p.nivel,
             p.grado,
             p.icon_name,
             p.color_name,
             p.units,
             p.pedagogy_profile,
             COALESCE(t.name, 'Docente') AS teacher_name
      FROM classroom_members m
      JOIN classrooms c ON c.id = m.classroom_id
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      JOIN users t ON t.id = c.teacher_id
      WHERE m.user_id = ${viewer.id} AND m.status = 'active'
      ORDER BY m.joined_at DESC
    `) as Record<string, any>[]

    if (classroomRows.length === 0) {
      return NextResponse.json({ classrooms: [] })
    }

    const classroomIds = classroomRows.map((row) => Number(row.id))

    // One query for every assignment across every aula, with this student's
    // attempt count folded in — avoids N+1 when a student is in six aulas.
    const assignmentRows = (await sql`
      SELECT a.id,
             a.classroom_id,
             a.teacher_quiz_id,
             a.opens_at,
             a.due_at,
             a.max_attempts,
             a.created_at,
             q.title,
             q.mode,
             q.question_count,
             COUNT(att.id)::int AS attempts_used,
             MAX(att.score)     AS best_score
      FROM classroom_assignments a
      JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      LEFT JOIN quiz_attempts att
        ON att.assignment_id = a.id AND att.user_id = ${viewer.id}
      WHERE a.classroom_id = ANY(${classroomIds})
      GROUP BY a.id, q.title, q.mode, q.question_count
      ORDER BY a.created_at DESC
    `) as Record<string, any>[]

    const now = new Date()

    const classrooms = classroomRows.map((row) => {
      const assignments = assignmentRows
        .filter((assignment) => Number(assignment.classroom_id) === Number(row.id))
        .map((assignment) => {
          const window = {
            opensAt: assignment.opens_at ? new Date(assignment.opens_at).toISOString() : null,
            dueAt: assignment.due_at ? new Date(assignment.due_at).toISOString() : null,
            maxAttempts: assignment.max_attempts === null ? null : Number(assignment.max_attempts),
          }

          return {
            id: Number(assignment.id),
            teacherQuizId: Number(assignment.teacher_quiz_id),
            title: String(assignment.title),
            mode: assignment.mode,
            questionCount: Number(assignment.question_count),
            createdAt: assignment.created_at,
            ...window,
            attemptsUsed: Number(assignment.attempts_used ?? 0),
            bestScore: assignment.best_score === null ? null : Number(assignment.best_score),
            state: assignmentState(window, Number(assignment.attempts_used ?? 0), now, row.status),
          }
        })

      return {
        id: Number(row.id),
        name: row.name,
        status: row.status,
        teacherName: row.teacher_name,
        subjectName: row.subject_name,
        nivel: row.nivel,
        grado: row.grado,
        iconName: row.icon_name,
        colorName: row.color_name,
        teacherProgramId: Number(row.teacher_program_id),
        units: Array.isArray(row.units) ? row.units : [],
        pedagogyProfile: row.pedagogy_profile ?? undefined,
        joinedAt: row.joined_at,
        assignments,
      }
    })

    return NextResponse.json({ classrooms, viewer: { isGuest: viewer.isGuest, displayName: viewer.displayName } })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/classrooms', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron obtener tus aulas', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
