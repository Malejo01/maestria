import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerValoracion } from '@/lib/valoraciones'
import { borrarValoracion, faltaLaTabla, guardarValoracion, valoracionesDelCuestionario } from '@/lib/valoraciones-server'
import type { Question } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * O8 · /api/teacher/quizzes/[id]/valoraciones — el pulgar del docente en cada
 * pregunta de SU cuestionario.
 *   GET    → `{ valoraciones: [{ indice, valor, motivo }] }`
 *   PUT    `{ indice, valor: 1 | -1, motivo? }` (el pulgar abajo exige motivo)
 *   DELETE `?indice=N` (sacar el pulgar)
 */
async function cuestionarioPropio(id: string, docenteId: string) {
  const quizId = Number(id)
  if (!Number.isInteger(quizId) || quizId <= 0) return null
  const filas = (await sql`
    SELECT id, teacher_program_id, questions FROM teacher_quizzes WHERE id = ${quizId} AND user_id = ${docenteId} LIMIT 1
  `) as { id: number; teacher_program_id: number | null; questions: Question[] }[]
  return filas[0] ?? null
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  try {
    const quiz = await cuestionarioPropio((await params).id, teacher.id)
    if (!quiz) return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    return NextResponse.json({ valoraciones: await valoracionesDelCuestionario(teacher.id, Number(quiz.id)) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes/[id]/valoraciones', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer las valoraciones' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const v = leerValoracion(await req.json().catch(() => null))
  if (!v) return NextResponse.json({ error: 'Valoración inválida: el pulgar abajo necesita un motivo' }, { status: 400 })
  try {
    const quiz = await cuestionarioPropio((await params).id, teacher.id)
    if (!quiz) return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    const preguntas = Array.isArray(quiz.questions) ? quiz.questions : []
    if (v.indice >= preguntas.length) return NextResponse.json({ error: 'Esa pregunta no existe' }, { status: 400 })
    await guardarValoracion(teacher.id, { id: Number(quiz.id), teacherProgramId: quiz.teacher_program_id === null ? null : Number(quiz.teacher_program_id) }, v, String(preguntas[v.indice]?.question ?? ''))
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (faltaLaTabla(error)) return NextResponse.json({ error: 'Las valoraciones todavía no están disponibles (falta la migración 033).' }, { status: 503 })
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes/[id]/valoraciones', operation: 'PUT' })
    return NextResponse.json({ error: 'No se pudo guardar la valoración' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes' }, { status: 403 })
  const indice = Number(new URL(req.url).searchParams.get('indice'))
  if (!Number.isInteger(indice) || indice < 0) return NextResponse.json({ error: 'Índice inválido' }, { status: 400 })
  try {
    const quiz = await cuestionarioPropio((await params).id, teacher.id)
    if (!quiz) return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    await borrarValoracion(teacher.id, Number(quiz.id), indice)
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes/[id]/valoraciones', operation: 'DELETE' })
    return NextResponse.json({ error: 'No se pudo sacar la valoración' }, { status: 500 })
  }
}
