import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import type { Question, TeacherQuizStatus } from '@/lib/types'
import { captureRouteFailure } from '@/lib/observability'

/**
 * Forma del SELECT sobre `teacher_quizzes` — ver
 * scripts/003-teacher-quizzes-and-program-style.sql.
 *
 * `selected_topics` y `questions` son JSONB y quedan `unknown`: esta ruta los
 * reenvía tal cual al cliente sin leerlos, así que afirmar una forma acá sería
 * inventar un contrato que nadie verifica. `mode` y `status` sí llevan su unión
 * porque el CHECK de la tabla la garantiza.
 */
interface TeacherQuizRow {
  id: number
  user_id: string
  teacher_program_id: number
  title: string
  subject_name: string
  mode: 'teorico' | 'practico' | 'mixto'
  status: 'saved' | 'pending_share'
  selected_topics: unknown
  question_count: number
  questions: unknown
  pedagogy_context: string | null
  created_at: Date | null
  updated_at: Date | null
}

function isTeacherRole(role: unknown): boolean {
  return role === 'DOCENTE'
}

async function requireTeacher(userId: string) {
  const rows = await sql`
    SELECT COALESCE(role, 'ALUMNO') AS role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 && isTeacherRole(rows[0].role)
}

export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ quizzes: [] })
    }

    const { searchParams } = new URL(req.url)
    const rawProgramId = searchParams.get('programId')
    const hasProgramFilter = rawProgramId !== null && rawProgramId.trim().length > 0
    const programId = hasProgramFilter ? Number(rawProgramId) : Number.NaN
    const subjectFilter = searchParams.get('subject')?.trim().toLowerCase() || ''
    const modeFilter = searchParams.get('mode')
    const createdAfter = searchParams.get('createdAfter')

    if (hasProgramFilter && (!Number.isFinite(programId) || programId <= 0)) {
      return NextResponse.json({ error: 'programId invalido' }, { status: 400 })
    }

    const rows = (hasProgramFilter
      ? await sql`
          SELECT id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
          FROM teacher_quizzes
          WHERE user_id = ${userId} AND teacher_program_id = ${programId}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
          FROM teacher_quizzes
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
        `) as TeacherQuizRow[]

    const filteredRows = rows.filter((quiz) => {
      const matchesMode = !modeFilter || modeFilter.length === 0 || quiz.mode === modeFilter
      const matchesSubject = subjectFilter.length === 0 || (quiz.subject_name || '').toLowerCase().includes(subjectFilter)
      // `?? 0` conserva el comportamiento previo: `new Date(null)` ya era la época.
      const createdAtTime = new Date(quiz.created_at ?? 0).getTime()
      const createdAfterTime = createdAfter ? new Date(createdAfter).getTime() : Number.NaN
      const matchesDate = Number.isNaN(createdAfterTime) || createdAtTime >= createdAfterTime

      return matchesMode && matchesSubject && matchesDate
    })

    return NextResponse.json({ quizzes: filteredRows })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron obtener los cuestionarios', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden guardar cuestionarios' }, { status: 403 })
    }

    const body = await req.json()

    const teacherProgramId = Number(body?.teacherProgramId)
    const title = String(body?.title ?? '').trim()
    const subjectName = String(body?.subjectName ?? '').trim()
    const mode = body?.mode === 'practico'
      ? 'practico'
      : body?.mode === 'mixto'
        ? 'mixto'
        : 'teorico'
    const status = (body?.status === 'pending_share' ? 'pending_share' : 'saved') as TeacherQuizStatus
    const selectedTopics = Array.isArray(body?.selectedTopics) ? body.selectedTopics : []
    const questionCount = Number(body?.questionCount ?? 0)
    const questions = (Array.isArray(body?.questions) ? body.questions : []) as Question[]
    const pedagogyContext = body?.pedagogyContext ? String(body.pedagogyContext) : null

    if (!Number.isFinite(teacherProgramId) || teacherProgramId <= 0) {
      return NextResponse.json({ error: 'Materia docente invalida' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Debes indicar un titulo' }, { status: 400 })
    }

    if (!subjectName) {
      return NextResponse.json({ error: 'Debes indicar la materia' }, { status: 400 })
    }

    if (!Array.isArray(selectedTopics) || selectedTopics.length === 0) {
      return NextResponse.json({ error: 'Debes seleccionar al menos un tema' }, { status: 400 })
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Debes generar preguntas antes de guardar' }, { status: 400 })
    }

    const programRows = await sql`
      SELECT id
      FROM teacher_programs
      WHERE id = ${teacherProgramId} AND user_id = ${userId}
      LIMIT 1
    `

    if (programRows.length === 0) {
      return NextResponse.json({ error: 'La materia no pertenece al docente autenticado' }, { status: 403 })
    }

    const rows = await sql`
      INSERT INTO teacher_quizzes (
        user_id,
        teacher_program_id,
        title,
        subject_name,
        mode,
        status,
        selected_topics,
        question_count,
        questions,
        pedagogy_context,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${teacherProgramId},
        ${title},
        ${subjectName},
        ${mode},
        ${status},
        ${JSON.stringify(selectedTopics)},
        ${questionCount || questions.length},
        ${JSON.stringify(questions)},
        ${pedagogyContext},
        NOW(),
        NOW()
      )
      RETURNING id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
    `

    return NextResponse.json({ quiz: rows[0] })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo guardar el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
