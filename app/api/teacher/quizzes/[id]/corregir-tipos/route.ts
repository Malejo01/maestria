import { areaDeLaMateria } from '@/lib/area-para-generar-server'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { sumUsage, type AiSdkUsage } from '@/lib/ai-usage'
import { captureRouteFailure } from '@/lib/observability'
import { bloqueoParaGenerar } from '@/lib/planes-server'
import { generarConGemini, proponerCorrecciones } from '@/lib/corregir-tipos-server'
import { correccionPorRegla, preguntasMarcadas } from '@/lib/corregir-tipos'
import type { Question } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/teacher/quizzes/[id]/corregir-tipos — N2.
 *
 * Por cada pregunta cuyo tipo no encaja con la consigna (`problemaDeTipo`, M2),
 * una propuesta antes → después: primero la regla determinista, y lo que la
 * regla no puede, el modelo (verificado: sin marcas, mismo tema, y un
 * verdadero o falso con el mismo valor de verdad).
 *
 * NO ESCRIBE NADA. El guardado pasa por el PATCH del cuestionario después de
 * que el docente ve el diálogo y elige qué aplicar (y ese PATCH respeta los
 * intentos ya hechos: copia y mueve las asignaciones).
 *
 * Cuerpo opcional `{ questions }`: desde *Revisar y editar*, las preguntas como
 * están en pantalla (con cambios sin guardar). Sin cuerpo, las guardadas.
 *
 * Cuenta como UNA llamada del bucket `quiz_generation` (lib/ai-rate-limit.ts),
 * aunque corrija varias: es una generación chica. Si la regla alcanza para
 * todas, no se gasta IA ni cuenta.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'Solo docentes pueden corregir preguntas' }, { status: 403 })

  const quizId = Number((await params).id)
  if (!Number.isInteger(quizId) || quizId <= 0) return NextResponse.json({ error: 'Id de cuestionario inválido' }, { status: 400 })

  let markFailed: (() => Promise<void>) | null = null
  try {
    const filas = (await sql`
      SELECT id, questions, subject_name, teacher_program_id FROM teacher_quizzes WHERE id = ${quizId} AND user_id = ${teacher.id} LIMIT 1
    `) as { id: number; questions: Question[]; subject_name?: string | null; teacher_program_id?: number | null }[]
    if (!filas[0]) return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })

    const cuerpo = (await req.json().catch(() => null)) as { questions?: unknown } | null
    const enPantalla = Array.isArray(cuerpo?.questions) && cuerpo.questions.length <= 200 ? (cuerpo.questions as Question[]) : null
    const preguntas = enPantalla ?? (Array.isArray(filas[0].questions) ? filas[0].questions : [])

    const marcadas = preguntasMarcadas(preguntas)
    if (marcadas.length === 0) return NextResponse.json({ propuestas: [] })

    // Sólo si hay algo que la regla no arregla se pasa por el plan y el límite.
    const necesitaIa = marcadas.some(({ indice }) => !correccionPorRegla(preguntas[indice]))
    const usos: (AiSdkUsage | undefined)[] = []
    let finish: ((usage?: AiSdkUsage | null) => Promise<void>) | null = null
    if (necesitaIa) {
      const bloqueo = await bloqueoParaGenerar(teacher.id, teacher.email)
      if (bloqueo) return bloqueo
      const guard = await guardAiCall({ bucket: 'quiz_generation', errorBody: () => ({ propuestas: [] }) })
      if (!guard.ok) return guard.response
      markFailed = guard.fail
      finish = guard.finish
    }

    // Ronda T · A4: el área de la materia del cuestionario (o la inferida de su nombre).
    const area = await areaDeLaMateria(filas[0].teacher_program_id ?? null, filas[0].subject_name ?? '')
    const propuestas = await proponerCorrecciones(preguntas, generarConGemini, (u) => usos.push(u), area)
    if (finish) await finish(sumUsage(...usos))
    return NextResponse.json({ propuestas })
  } catch (error) {
    if (markFailed) await markFailed()
    captureRouteFailure(error, { endpoint: '/api/teacher/quizzes/[id]/corregir-tipos', operation: 'POST' })
    return NextResponse.json({ error: 'No pudimos armar las correcciones. Probá de nuevo en un momento.' }, { status: 502 })
  }
}
