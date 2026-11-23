import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { sql } from '@/lib/db'
import { preguntasDeLaCopia, tituloDeCopia } from '@/lib/duplicar-tarea'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda W · W2 — POST: duplica una tarea del docente (sin volver a generar):
 * una copia con las mismas preguntas, de la misma materia, guardada como
 * tarea. Devuelve la copia, para mandarla con el diálogo de siempre.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Tarea inválida' }, { status: 400 })
  try {
    const [original] = (await sql`
      SELECT id, teacher_program_id, title, subject_name, mode, selected_topics, questions, pedagogy_context
      FROM teacher_quizzes WHERE id = ${id} AND user_id = ${teacher.id}
    `) as Record<string, unknown>[]
    if (!original) return NextResponse.json({ error: 'Esa tarea no es tuya' }, { status: 404 })
    const titulos = (await sql`
      SELECT title FROM teacher_quizzes WHERE user_id = ${teacher.id} AND teacher_program_id = ${original.teacher_program_id}
    `) as { title: string }[]
    const preguntas = preguntasDeLaCopia(original.questions)
    if (preguntas.length === 0) return NextResponse.json({ error: 'La tarea no tiene preguntas' }, { status: 400 })
    const [copia] = (await sql`
      INSERT INTO teacher_quizzes (user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at)
      VALUES (${teacher.id}, ${original.teacher_program_id}, ${tituloDeCopia(String(original.title ?? ''), titulos.map((t) => t.title))}, ${original.subject_name},
              ${original.mode}, 'saved', ${JSON.stringify(original.selected_topics ?? [])}, ${preguntas.length}, ${JSON.stringify(preguntas)}, ${original.pedagogy_context ?? null}, NOW(), NOW())
      RETURNING id, user_id, teacher_program_id, title, subject_name, mode, status, selected_topics, question_count, questions, pedagogy_context, created_at, updated_at,
                to_jsonb(teacher_quizzes) ->> 'tipo' AS tipo
    `) as Record<string, unknown>[]
    return NextResponse.json({ quiz: copia })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes/[id]/duplicar', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo duplicar la tarea' }, { status: 500 })
  }
}
