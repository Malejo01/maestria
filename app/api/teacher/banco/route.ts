import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { leerBanco } from '@/lib/banco-server'
import { QUESTION_TYPE_VALUES } from '@/lib/quiz-generation'
import type { QuestionType } from '@/lib/types'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda W · W1 — GET /api/teacher/banco?texto=&materia=&unidad=&tema=&tipo=&valoracion=
 * Las preguntas del banco del docente, filtradas, y lo que se puede elegir en cada filtro.
 */
export async function GET(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const q = new URL(req.url).searchParams
  const tipo = q.get('tipo')
  const valoracion = q.get('valoracion')
  const materia = Number(q.get('materia'))
  try {
    return NextResponse.json(
      await leerBanco(teacher.id, {
        texto: q.get('texto')?.slice(0, 100) || undefined,
        materiaId: Number.isInteger(materia) && materia > 0 ? materia : null,
        unidad: q.get('unidad') || null,
        tema: q.get('tema') || null,
        tipo: tipo && (QUESTION_TYPE_VALUES as readonly string[]).includes(tipo) ? (tipo as QuestionType) : null,
        valoracion: valoracion === 'arriba' || valoracion === 'abajo' || valoracion === 'sin' ? valoracion : null,
      }),
    )
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/banco', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer el banco' }, { status: 500 })
  }
}
