import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getQuizImpact } from '@/lib/teacher-quizzes-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * GET /api/teacher/quizzes/[id]/impact
 *
 * Dónde está asignado este cuestionario y cuántos alumnos ya lo rindieron.
 *
 * Lo consume el diálogo de confirmación antes de guardar una edición. El pedido
 * fue explícito en que tiene que decir CUÁNTOS alumnos ya rindieron, no un
 * "puede haber alumnos" genérico: un aviso que no da el número no se lee, y a
 * la tercera vez se confirma sin mirar.
 *
 * El guardado vuelve a calcular esto del lado del servidor. Acá se responde
 * para poder MOSTRARLO, no para decidir.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver este recurso' }, { status: 403 })
  }

  const { id } = await params
  const quizId = Number(id)
  if (!Number.isFinite(quizId) || quizId <= 0) {
    return NextResponse.json({ error: 'Id de cuestionario inválido' }, { status: 400 })
  }

  try {
    const propio = await sql`
      SELECT 1 FROM teacher_quizzes WHERE id = ${quizId} AND user_id = ${teacher.id} LIMIT 1
    `
    if (propio.length === 0) {
      return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ impact: await getQuizImpact(quizId) })
  } catch (error) {
    captureRouteFailure(error instanceof Error ? error : new Error(String(error)), {
      endpoint: '/api/teacher/quizzes/[id]/impact',
      operation: 'GET',
    })

    return NextResponse.json(
      {
        error: 'No se pudo consultar el estado del cuestionario',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
