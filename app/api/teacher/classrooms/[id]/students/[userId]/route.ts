import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getOwnedClassroom } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/classrooms/[id]/students/[userId]
 *
 * One student's activity **inside this aula only**. Everything is filtered by
 * classroom_id, so a teacher never sees what the student practised on their
 * own or in another teacher's aula — the roster gives access to this subject,
 * not to the student's whole account.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver el seguimiento' }, { status: 403 })
  }

  const { id, userId } = await params
  const classroomId = Number(id)
  const studentId = String(userId ?? '').trim()

  if (!Number.isFinite(classroomId) || classroomId <= 0 || !studentId) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    const memberRows = (await sql`
      SELECT id, user_id, display_name, is_verified, joined_at
      FROM classroom_members
      WHERE classroom_id = ${classroomId} AND user_id = ${studentId} AND status = 'active'
      LIMIT 1
    `) as Record<string, any>[]

    if (memberRows.length === 0) {
      return NextResponse.json({ error: 'Ese alumno no está en esta aula' }, { status: 404 })
    }

    const [attemptRows, topicRows, tipRows] = await Promise.all([
      sql`
        SELECT att.id,
               att.subject,
               att.mode,
               att.score,
               att.passed,
               att.total_questions,
               att.correct_answers,
               att.attempt_number,
               att.completed_at,
               att.assignment_id,
               q.title AS assignment_title
        FROM quiz_attempts att
        LEFT JOIN classroom_assignments a ON a.id = att.assignment_id
        LEFT JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
        WHERE att.classroom_id = ${classroomId} AND att.user_id = ${studentId}
        ORDER BY att.completed_at DESC
        LIMIT 50
      `,
      sql`
        SELECT ans.topic_name,
               COUNT(*)::int                              AS total,
               COUNT(*) FILTER (WHERE ans.is_correct)::int AS correct
        FROM quiz_answers ans
        JOIN quiz_attempts att ON att.id = ans.quiz_attempt_id
        WHERE att.classroom_id = ${classroomId} AND att.user_id = ${studentId} AND ans.topic_name <> ''
        GROUP BY ans.topic_name
      `,
      // Tips the AI wrote for this student, limited to the aula's subject so
      // the teacher sees the reasoning behind the errors in *their* materia.
      sql`
        SELECT topic_name, misconception_type, tip, resolved, created_at
        FROM student_misconceptions
        WHERE user_id = ${studentId} AND subject = ${classroom.subject_name}
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ])

    const topics = (topicRows as Record<string, any>[])
      .map((row) => {
        const total = Number(row.total)
        const correct = Number(row.correct)
        return {
          topicName: String(row.topic_name),
          total,
          correct,
          accuracy: total > 0 ? correct / total : 0,
        }
      })
      .sort((a, b) => a.accuracy - b.accuracy)

    return NextResponse.json({
      student: {
        memberId: Number(memberRows[0].id),
        userId: String(memberRows[0].user_id),
        displayName: String(memberRows[0].display_name),
        isVerified: Boolean(memberRows[0].is_verified),
        joinedAt: memberRows[0].joined_at,
      },
      attempts: (attemptRows as Record<string, any>[]).map((row) => ({
        id: Number(row.id),
        subject: String(row.subject),
        mode: String(row.mode),
        score: row.score === null ? null : Number(row.score),
        passed: Boolean(row.passed),
        totalQuestions: Number(row.total_questions),
        correctAnswers: Number(row.correct_answers),
        attemptNumber: row.attempt_number === null ? null : Number(row.attempt_number),
        completedAt: row.completed_at,
        assignmentId: row.assignment_id === null ? null : Number(row.assignment_id),
        // Null title = free practice on the aula's temario, not an assignment.
        assignmentTitle: row.assignment_title ?? null,
      })),
      topics,
      tips: (tipRows as Record<string, any>[]).map((row) => ({
        topicName: String(row.topic_name),
        misconceptionType: String(row.misconception_type),
        tip: String(row.tip),
        resolved: Boolean(row.resolved),
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/students/[userId]', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo obtener la ficha del alumno', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
