import { sql } from '@/lib/db'
import { NextResponse } from 'next/server'
import { debugLog } from '@/lib/utils'
import { getViewer } from '@/lib/auth-session'
import { ASSIGNMENT_STATE_LABEL, assignmentState, canStartAssignment } from '@/lib/classrooms'
import { captureRouteFailure } from '@/lib/observability'

/**
 * Validates that this student may submit an attempt for an assigned quiz, and
 * returns which attempt number it is. Re-checks the window server-side because
 * the client could have had the page open since before the deadline.
 */
/** Forma del SELECT de abajo — DDL en scripts/015-classrooms.sql. */
interface AssignmentContextRow {
  id: number
  classroom_id: number
  opens_at: Date | null
  due_at: Date | null
  max_attempts: number | null
  classroom_status: 'open' | 'closed'
}

async function resolveAssignmentContext(userId: string, assignmentId: number) {
  const rows = (await sql`
    SELECT a.id, a.classroom_id, a.opens_at, a.due_at, a.max_attempts, c.status AS classroom_status
    FROM classroom_assignments a
    JOIN classrooms c ON c.id = a.classroom_id
    JOIN classroom_members m ON m.classroom_id = c.id AND m.user_id = ${userId} AND m.status = 'active'
    WHERE a.id = ${assignmentId}
    LIMIT 1
  `) as AssignmentContextRow[]

  if (rows.length === 0) return { error: 'No encontramos ese cuestionario en tus aulas.', status: 404 as const }

  const row = rows[0]
  const attemptRows = (await sql`
    SELECT COUNT(*)::int AS used FROM quiz_attempts
    WHERE assignment_id = ${assignmentId} AND user_id = ${userId}
  `) as { used: number }[]

  const attemptsUsed = Number(attemptRows[0]?.used ?? 0)
  const state = assignmentState(
    {
      opensAt: row.opens_at ? new Date(row.opens_at).toISOString() : null,
      dueAt: row.due_at ? new Date(row.due_at).toISOString() : null,
      maxAttempts: row.max_attempts === null ? null : Number(row.max_attempts),
    },
    attemptsUsed,
    new Date(),
    row.classroom_status
  )

  if (!canStartAssignment(state)) {
    return { error: ASSIGNMENT_STATE_LABEL[state], status: 403 as const }
  }

  return { classroomId: Number(row.classroom_id), assignmentId, attemptNumber: attemptsUsed + 1 }
}

export async function POST(req: Request) {
  try {
    debugLog('[v0] Save-result API called')

    // Guests count: they're a real users row, so their attempts, mastery and
    // tips are stored exactly like a signed-in student's.
    const viewer = await getViewer()
    const userId = viewer?.id ?? null

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    debugLog('[v0] Request body received, subject:', body.subject)
    const {
      subject,
      mode,
      topics,
      totalQuestions,
      correctAnswers,
      ungradedAnswers: rawUngradedAnswers,
      score,
      answers
    } = body

    const cleanSubject = subject || 'Matemática'

    // Attempts made inside an aula carry the link; free practice doesn't.
    const rawAssignmentId = Number(body?.assignmentId)
    const hasAssignment = Number.isFinite(rawAssignmentId) && rawAssignmentId > 0

    let classroomId: number | null = null
    let assignmentId: number | null = null
    let attemptNumber: number | null = null

    if (hasAssignment) {
      const context = await resolveAssignmentContext(userId, rawAssignmentId)
      if ('error' in context) {
        return NextResponse.json({ error: context.error }, { status: context.status })
      }
      classroomId = context.classroomId
      assignmentId = context.assignmentId
      attemptNumber = context.attemptNumber
    } else {
      const rawClassroomId = Number(body?.classroomId)
      if (Number.isFinite(rawClassroomId) && rawClassroomId > 0) {
        // Free practice inside an aula: tag it so the teacher sees the
        // activity, but only if the student really belongs to that aula.
        const membership = await sql`
          SELECT 1 FROM classroom_members
          WHERE classroom_id = ${rawClassroomId} AND user_id = ${userId} AND status = 'active'
          LIMIT 1
        `
        if (membership.length > 0) classroomId = rawClassroomId
      }
    }

    // 1. Verificar/crear usuario en nuestra DB
    // The user is upserted at sign-in time in auth.ts, so this is a safety net.
    const existingUser = await sql`
      SELECT id FROM users WHERE id = ${userId}
    `

    if (existingUser.length === 0) {
      // Fallback: create minimal user row if somehow missing
      await sql`
        INSERT INTO users (id, email, created_at, updated_at)
        VALUES (${userId}, '', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `
    }

    // 2. Calcular incorrect_answers y passed
    // Las sin calificar se restan explícitamente: `total - correctas` las
    // contaría como errores, que es exactamente el bug que la migración 021
    // viene a cerrar. El cliente manda la cifra; se recuenta igual desde
    // `answers` porque este endpoint no puede confiar en que el número que le
    // llega sea coherente con el detalle que le llega al lado.
    const ungradedFromAnswers = Array.isArray(answers)
      ? answers.filter((a: { gradingStatus?: string }) => a?.gradingStatus === 'ungraded').length
      : 0
    const ungradedAnswers = Number.isFinite(Number(rawUngradedAnswers))
      ? Math.max(Number(rawUngradedAnswers), ungradedFromAnswers)
      : ungradedFromAnswers
    const incorrectAnswers = totalQuestions - correctAnswers - ungradedAnswers
    const passed = score >= 6

    // Map topics to a clean array of strings (names) for the quiz_attempts table
    const topicsStrings: string[] = Array.isArray(topics)
      ? topics.map((t) => (typeof t === 'string' ? t : String(t?.name || t?.id || '')))
      : [typeof topics === 'string' ? topics : String(topics?.name || topics?.id || '')]

    // 3. Crear el quiz_attempt
    debugLog('[v0] Creating quiz attempt...')
    const quizAttempt = await sql`
      INSERT INTO quiz_attempts (
        user_id, subject, mode, topics, total_questions,
        correct_answers, incorrect_answers, ungraded_answers, score, passed,
        classroom_id, assignment_id, attempt_number,
        started_at, completed_at
      )
      VALUES (
        ${userId}, ${cleanSubject}, ${mode}, ${topicsStrings}, ${totalQuestions},
        ${correctAnswers}, ${incorrectAnswers}, ${ungradedAnswers}, ${score}, ${passed},
        ${classroomId}, ${assignmentId}, ${attemptNumber},
        NOW(), NOW()
      )
      RETURNING id
    `
    const quizAttemptId = quizAttempt[0].id
    debugLog('[v0] Quiz attempt created with ID:', quizAttemptId)

    // 4. Guardar cada respuesta. multiple_choice sigue escribiendo las columnas
    // legacy (options/selected_answer/correct_answer) para no romper lectores
    // existentes; el resto usa answer_payload (ver migracion 013).
    debugLog('[v0] Saving', answers.length, 'answers...')
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i]
      const questionType = answer.type || 'multiple_choice'

      const isLegacyMultipleChoice = questionType === 'multiple_choice'
      const options = isLegacyMultipleChoice ? JSON.stringify(answer.options) : null
      const selectedAnswerColumn = isLegacyMultipleChoice ? answer.selectedAnswer : null
      const correctAnswerColumn = isLegacyMultipleChoice ? answer.correctAnswer : null

      let answerPayload: string | null = null
      if (questionType === 'true_false') {
        answerPayload = JSON.stringify({ selectedAnswer: answer.selectedAnswer, correctAnswer: answer.correctAnswer })
      } else if (questionType === 'numeric') {
        answerPayload = JSON.stringify({ selectedValue: answer.selectedValue, correctAnswer: answer.correctAnswer, tolerance: answer.tolerance ?? null })
      } else if (questionType === 'short_answer') {
        answerPayload = JSON.stringify({
          selectedText: answer.selectedText,
          acceptedAnswers: answer.acceptedAnswers,
          // Sólo se escribe cuando NO se pudo corregir: la ausencia del campo
          // es "corregida", que es lo que son todas las filas anteriores.
          ...(answer.gradingStatus === 'ungraded'
            ? { gradingStatus: 'ungraded', gradingReason: 'ai_unavailable' }
            : {}),
        })
      }

      // NULL, no false: en SQL es "desconocido", que es exactamente el caso.
      // Un `WHERE NOT is_correct` futuro las excluye en vez de contarlas como
      // errores — ver el porqué en scripts/021-ungraded-answers.sql.
      const isCorrectColumn = answer.gradingStatus === 'ungraded' ? null : answer.isCorrect

      await sql`
        INSERT INTO quiz_answers (
          quiz_attempt_id,
          question_index,
          question_id,
          question_text,
          question_type,
          options,
          selected_answer,
          correct_answer,
          answer_payload,
          is_correct,
          explanation,
          topic_name,
          created_at
        ) VALUES (
          ${quizAttemptId},
          ${i},
          ${answer.questionId || `q-${i}`},
          ${answer.questionText},
          ${questionType},
          ${options},
          ${selectedAnswerColumn},
          ${correctAnswerColumn},
          ${answerPayload},
          ${isCorrectColumn},
          ${answer.explanation || ''},
          ${answer.topicName || ''},
          NOW()
        )
      `
    }
    debugLog('[v0] All answers saved')

    // 5. Actualizar topic_mastery si la nota es >= 6
    if (score >= 6) {
      const topicsArray = Array.isArray(topics) ? topics : [topics]
      
      for (const topic of topicsArray) {
        const topicId = typeof topic === 'string' ? topic : (topic.id || topic)
        const topicName = typeof topic === 'string' ? topic : (topic.name || topic)
        
        // Verificar si ya existe un registro para este tema
        const existing = await sql`
          SELECT id, highest_score, attempts_count FROM topic_mastery
          WHERE user_id = ${userId} AND subject = ${cleanSubject} AND topic_id = ${topicId}
        `
        
        if (existing.length > 0) {
          // Actualizar si el nuevo score es mayor
          const currentHighest = existing[0].highest_score || 0
          if (score > currentHighest) {
            await sql`
              UPDATE topic_mastery
              SET highest_score = ${score}, attempts_count = attempts_count + 1, 
                  last_attempt_at = NOW(), updated_at = NOW()
              WHERE id = ${existing[0].id}
            `
          } else {
            await sql`
              UPDATE topic_mastery
              SET attempts_count = attempts_count + 1, last_attempt_at = NOW(), updated_at = NOW()
              WHERE id = ${existing[0].id}
            `
          }
        } else {
          // Crear nuevo registro
          await sql`
            INSERT INTO topic_mastery (
              user_id, subject, topic_id, topic_name, highest_score, 
              attempts_count, last_attempt_at, created_at, updated_at
            )
            VALUES (
              ${userId}, ${cleanSubject}, ${topicId}, ${topicName}, ${score}, 
              1, NOW(), NOW(), NOW()
            )
          `
        }
      }
    }

    debugLog('[v0] Save completed successfully')
    return NextResponse.json({
      success: true,
      quizAttemptId,
      classroomId,
      assignmentId,
      attemptNumber,
      message: 'Resultado guardado exitosamente'
    })

  } catch (error) {
    // Un intento que no se guarda es trabajo del alumno perdido; llegaba a
    // Sentry sólo por la integración de consola, sin tags para filtrar.
    captureRouteFailure(error, { endpoint: '/api/quiz/save-result', operation: 'POST' })
    return NextResponse.json(
      { error: 'Error al guardar el resultado', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
