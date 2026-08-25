import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getOwnedClassroom } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/** A topic is only worth flagging once the group has answered it a few times. */
const MIN_ANSWERS_FOR_TOPIC_SIGNAL = 3

/** Below this accuracy a topic is reported as "flojo". */
const WEAK_TOPIC_THRESHOLD = 0.6

function accuracy(correct: number, total: number): number {
  return total > 0 ? correct / total : 0
}

/**
 * GET /api/teacher/classrooms/[id]/report
 *
 * The whole seguimiento panel in one payload: group summary, per-student
 * marks, topic accuracy (both for the group and per student) and how each
 * assigned cuestionario is going.
 *
 * Accuracy is computed from quiz_answers rather than from quiz_attempts.score
 * because a score only says "6 out of 10", while the answers say *which*
 * topics went wrong — which is what actually changes what the teacher does
 * next class.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver el seguimiento' }, { status: 403 })
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

    const [studentRows, topicRows, studentTopicRows, assignmentRows] = await Promise.all([
      sql`
        SELECT m.id AS member_id,
               m.user_id,
               m.display_name,
               m.is_verified,
               m.joined_at,
               COUNT(a.id)::int                            AS attempt_count,
               AVG(a.score)                                AS average_score,
               MAX(a.score)                                AS best_score,
               MAX(a.completed_at)                         AS last_attempt_at,
               COUNT(*) FILTER (WHERE a.passed)::int       AS passed_count
        FROM classroom_members m
        LEFT JOIN quiz_attempts a
          ON a.user_id = m.user_id AND a.classroom_id = ${classroomId}
        WHERE m.classroom_id = ${classroomId} AND m.status = 'active'
        GROUP BY m.id, m.user_id, m.display_name, m.is_verified, m.joined_at
        ORDER BY m.display_name
      `,
      sql`
        SELECT ans.topic_name,
               COUNT(*)::int                                 AS total,
               COUNT(*) FILTER (WHERE ans.is_correct)::int    AS correct,
               COUNT(DISTINCT att.user_id)::int               AS student_count
        FROM quiz_answers ans
        JOIN quiz_attempts att ON att.id = ans.quiz_attempt_id
        WHERE att.classroom_id = ${classroomId} AND ans.topic_name <> ''
        GROUP BY ans.topic_name
      `,
      sql`
        SELECT att.user_id,
               ans.topic_name,
               COUNT(*)::int                              AS total,
               COUNT(*) FILTER (WHERE ans.is_correct)::int AS correct
        FROM quiz_answers ans
        JOIN quiz_attempts att ON att.id = ans.quiz_attempt_id
        WHERE att.classroom_id = ${classroomId} AND ans.topic_name <> ''
        GROUP BY att.user_id, ans.topic_name
      `,
      sql`
        SELECT a.id,
               a.due_at,
               a.opens_at,
               a.max_attempts,
               q.title,
               q.question_count,
               COUNT(DISTINCT att.user_id)::int AS submitted_count,
               COUNT(att.id)::int               AS attempt_count,
               -- Each student counts once, with their best try: averaging raw
               -- attempts would let whoever retried the most drag the class
               -- mark around, which is not what "promedio" means to a teacher.
               (
                 SELECT AVG(best)
                 FROM (
                   SELECT MAX(inner_att.score) AS best
                   FROM quiz_attempts inner_att
                   WHERE inner_att.assignment_id = a.id
                   GROUP BY inner_att.user_id
                 ) per_student
               ) AS average_score
        FROM classroom_assignments a
        JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
        LEFT JOIN quiz_attempts att ON att.assignment_id = a.id
        WHERE a.classroom_id = ${classroomId}
        GROUP BY a.id, q.title, q.question_count
        ORDER BY a.created_at DESC
      `,
    ])

    const students = (studentRows as Record<string, any>[]).map((row) => String(row.user_id))

    // Per-student topic accuracy, grouped so each student carries only their
    // own weak spots instead of the whole matrix.
    const weakByStudent = new Map<string, { topicName: string; correct: number; total: number; accuracy: number }[]>()
    for (const row of studentTopicRows as Record<string, any>[]) {
      const userId = String(row.user_id)
      const total = Number(row.total)
      const correct = Number(row.correct)
      if (total < MIN_ANSWERS_FOR_TOPIC_SIGNAL) continue

      const rate = accuracy(correct, total)
      if (rate >= WEAK_TOPIC_THRESHOLD) continue

      const list = weakByStudent.get(userId) ?? []
      list.push({ topicName: String(row.topic_name), correct, total, accuracy: rate })
      weakByStudent.set(userId, list)
    }

    for (const list of weakByStudent.values()) {
      list.sort((a, b) => a.accuracy - b.accuracy)
    }

    const studentCount = students.length
    const totalAttempts = (studentRows as Record<string, any>[]).reduce(
      (sum, row) => sum + Number(row.attempt_count ?? 0),
      0
    )
    const scored = (studentRows as Record<string, any>[]).filter((row) => row.average_score !== null)
    const groupAverage =
      scored.length > 0
        ? scored.reduce((sum, row) => sum + Number(row.average_score), 0) / scored.length
        : null

    const topics = (topicRows as Record<string, any>[])
      .map((row) => {
        const total = Number(row.total)
        const correct = Number(row.correct)
        return {
          topicName: String(row.topic_name),
          total,
          correct,
          accuracy: accuracy(correct, total),
          studentCount: Number(row.student_count),
        }
      })
      .filter((topic) => topic.total >= MIN_ANSWERS_FOR_TOPIC_SIGNAL)
      .sort((a, b) => a.accuracy - b.accuracy)

    return NextResponse.json({
      classroom: {
        id: classroom.id,
        name: classroom.name,
        subjectName: classroom.subject_name,
        nivel: classroom.nivel,
        grado: classroom.grado,
      },
      summary: {
        studentCount,
        // Students who never opened anything — the number a teacher chases.
        inactiveCount: (studentRows as Record<string, any>[]).filter((row) => Number(row.attempt_count) === 0).length,
        totalAttempts,
        groupAverage,
        weakTopicCount: topics.filter((topic) => topic.accuracy < WEAK_TOPIC_THRESHOLD).length,
      },
      students: (studentRows as Record<string, any>[]).map((row) => ({
        memberId: Number(row.member_id),
        userId: String(row.user_id),
        displayName: String(row.display_name),
        isVerified: Boolean(row.is_verified),
        joinedAt: row.joined_at,
        attemptCount: Number(row.attempt_count),
        averageScore: row.average_score === null ? null : Number(row.average_score),
        bestScore: row.best_score === null ? null : Number(row.best_score),
        passedCount: Number(row.passed_count),
        lastAttemptAt: row.last_attempt_at,
        weakTopics: (weakByStudent.get(String(row.user_id)) ?? []).slice(0, 3),
      })),
      topics,
      assignments: (assignmentRows as Record<string, any>[]).map((row) => {
        const submitted = Number(row.submitted_count)
        return {
          id: Number(row.id),
          title: String(row.title),
          questionCount: Number(row.question_count),
          opensAt: row.opens_at,
          dueAt: row.due_at,
          maxAttempts: row.max_attempts === null ? null : Number(row.max_attempts),
          submittedCount: submitted,
          pendingCount: Math.max(0, studentCount - submitted),
          attemptCount: Number(row.attempt_count),
          averageScore: row.average_score === null ? null : Number(row.average_score),
        }
      }),
      thresholds: { weakTopic: WEAK_TOPIC_THRESHOLD, minAnswers: MIN_ANSWERS_FOR_TOPIC_SIGNAL },
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/report', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo armar el seguimiento', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
