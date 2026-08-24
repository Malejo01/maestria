import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getQuizImpact } from '@/lib/teacher-quizzes-server'

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden ver este recurso' }, { status: 403 })
    }

    const { id } = await params
    const quizId = Number(id)
    if (!Number.isFinite(quizId) || quizId <= 0) {
      return NextResponse.json({ error: 'Id de cuestionario invalido' }, { status: 400 })
    }

    const rows = await sql`
      SELECT id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
      FROM teacher_quizzes
      WHERE id = ${quizId} AND user_id = ${userId}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ quiz: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo obtener el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden editar cuestionarios' }, { status: 403 })
    }

    const { id } = await params
    const quizId = Number(id)
    if (!Number.isFinite(quizId) || quizId <= 0) {
      return NextResponse.json({ error: 'Id de cuestionario invalido' }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context
      FROM teacher_quizzes
      WHERE id = ${quizId} AND user_id = ${userId}
      LIMIT 1
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    const existing = existingRows[0]
    const body = await req.json()

    const title = body?.title ? String(body.title).trim() : String(existing.title)
    const status = body?.status === 'pending_share' ? 'pending_share' : body?.status === 'saved' ? 'saved' : String(existing.status)
    const questions = Array.isArray(body?.questions) ? body.questions : existing.questions
    const selectedTopics = Array.isArray(body?.selectedTopics) ? body.selectedTopics : existing.selected_topics

    // ─── Copy-on-write cuando ya hay alumnos que rindieron ───────────────────
    //
    // El alumno recibe las preguntas por JOIN en vivo contra esta misma fila
    // (ver lib/teacher-quizzes-server.ts), así que un UPDATE le cambia el
    // examen debajo de los pies. Cuando ya hay intentos, editar en el lugar
    // deja de ser una edición y pasa a ser reescribir algo que alguien rindió.
    //
    // El chequeo vive ACÁ y no sólo en el diálogo del docente: la confirmación
    // de la UI es cortesía, la garantía tiene que estar del lado del servidor.
    // Y nunca es automático — se responde 409 con el detalle para que el
    // docente decida, que es exactamente lo que pidió el pedido.
    const cambianLasPreguntas = Array.isArray(body?.questions)
    const strategy = body?.strategy === 'copy' ? 'copy' : 'in_place'

    if (cambianLasPreguntas) {
      const impact = await getQuizImpact(quizId)

      if (impact.requiresDecision && strategy !== 'copy') {
        return NextResponse.json(
          {
            error: 'Este cuestionario ya fue rendido. Elegí qué hacer antes de guardar.',
            requiresDecision: true,
            impact,
          },
          { status: 409 },
        )
      }

      if (strategy === 'copy') {
        // La copia nace con las preguntas nuevas; el original queda congelado
        // sosteniendo los intentos ya hechos, que siguen siendo auditables.
        const copiaRows = await sql`
          INSERT INTO teacher_quizzes (
            user_id, teacher_program_id, title, subject_name, mode, status,
            selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
          )
          VALUES (
            ${userId}, ${existing.teacher_program_id}, ${title}, ${existing.subject_name},
            ${existing.mode}, ${status}, ${JSON.stringify(selectedTopics)},
            ${Array.isArray(questions) ? questions.length : Number(existing.question_count)},
            ${JSON.stringify(questions)}, ${existing.pedagogy_context}, NOW(), NOW()
          )
          RETURNING id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
        `

        const copia = copiaRows[0]

        // Las asignaciones pasan a apuntar a la copia: de acá en adelante el
        // aula sirve la versión corregida. Los intentos ya hechos conservan su
        // `assignment_id`, así que la nota vieja no se mueve.
        const reasignadas = await sql`
          UPDATE classroom_assignments
             SET teacher_quiz_id = ${copia.id}, updated_at = NOW()
           WHERE teacher_quiz_id = ${quizId}
          RETURNING id
        `

        return NextResponse.json({
          quiz: copia,
          copiado: true,
          originalId: quizId,
          reasignadas: reasignadas.length,
        })
      }
    }

    const rows = await sql`
      UPDATE teacher_quizzes
      SET
        title = ${title},
        status = ${status},
        selected_topics = ${JSON.stringify(selectedTopics)},
        question_count = ${Array.isArray(questions) ? questions.length : Number(existing.question_count)},
        questions = ${JSON.stringify(questions)},
        updated_at = NOW()
      WHERE id = ${quizId} AND user_id = ${userId}
      RETURNING id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
    `

    return NextResponse.json({ quiz: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden eliminar cuestionarios' }, { status: 403 })
    }

    const { id } = await params
    const quizId = Number(id)
    if (!Number.isFinite(quizId) || quizId <= 0) {
      return NextResponse.json({ error: 'Id de cuestionario invalido' }, { status: 400 })
    }

    const rows = await sql`
      DELETE FROM teacher_quizzes
      WHERE id = ${quizId} AND user_id = ${userId}
      RETURNING id
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo eliminar el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden duplicar cuestionarios' }, { status: 403 })
    }

    const { id } = await params
    const quizId = Number(id)
    if (!Number.isFinite(quizId) || quizId <= 0) {
      return NextResponse.json({ error: 'Id de cuestionario invalido' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || '')
    if (action !== 'duplicate') {
      return NextResponse.json({ error: 'Accion no soportada' }, { status: 400 })
    }

    const sourceRows = await sql`
      SELECT teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context
      FROM teacher_quizzes
      WHERE id = ${quizId} AND user_id = ${userId}
      LIMIT 1
    `

    if (sourceRows.length === 0) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    const source = sourceRows[0]

    const newRows = await sql`
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
        ${source.teacher_program_id},
        ${`${source.title} (copia)`},
        ${source.subject_name},
        ${source.mode},
        ${source.status},
        ${source.selected_topics},
        ${source.question_count},
        ${source.questions},
        ${source.pedagogy_context},
        NOW(),
        NOW()
      )
      RETURNING id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at
    `

    return NextResponse.json({ quiz: newRows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo duplicar el cuestionario', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
