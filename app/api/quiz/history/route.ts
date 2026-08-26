import { sql } from '@/lib/db'
import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { debugLog } from '@/lib/utils'
import type { ReinforceTopic, SubjectModeTotals } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Forma del SELECT sobre `quiz_attempts` — ver scripts/001-create-tables.sql.
 *
 * Dos columnas no se mapean al tipo que uno esperaría:
 *
 *  - `score` es DECIMAL(4,2), y el driver de Postgres devuelve los numeric como
 *    string para no perder precisión. Por eso todos los consumidores ya lo
 *    envuelven en `Number(...)` (ver app/(app)/history/page.tsx).
 *  - `completed_at` no es NOT NULL en el schema (sólo tiene DEFAULT NOW()), así
 *    que el tipo lo refleja y obliga a decidir qué hacer con el nulo.
 */
interface AttemptRow {
  id: number
  subject: string
  mode: 'teorico' | 'practico' | 'mixto'
  topics: string[]
  total_questions: number
  correct_answers: number
  incorrect_answers: number
  score: string
  passed: boolean
  completed_at: Date | null
}

/**
 * Los dos agregados que alimentan las tarjetas de resumen de /history viajan
 * con la forma declarada en lib/types.ts (`SubjectModeTotals`, `ReinforceTopic`),
 * que es la que consume el cliente: una sola definición para las dos puntas.
 *
 * Sobre `student_misconceptions.resolved`: es letra muerta hoy, ningún camino
 * de código la pone en TRUE (mismo caso que `topic_mastery.mastered_at`, ver
 * deuda-tecnica.md §7). El filtro se deja igual porque es lo que la columna
 * significa, y el día que algo marque un tema como superado esta consulta ya
 * hace lo correcto. Mientras tanto el conteo sólo crece — anotado en el backlog.
 */

export async function GET(req: Request) {
  try {
    debugLog('[v0] History API called')
    
    const session = await auth()
    const userId = session?.user?.id ?? null
    
    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar si el usuario existe (user.id = clerk_id)
    debugLog('[v0] Checking if user exists...')
    const user = await sql`
      SELECT id FROM users WHERE id = ${userId}
    `
    debugLog('[v0] User exists:', user.length > 0)
    
    if (user.length === 0) {
      // Usuario no ha completado ningun quiz aun
      return NextResponse.json({ attempts: [], mastery: [] })
    }

    const { searchParams } = new URL(req.url)
    const subjectFilter = searchParams.get('subject')?.trim() || ''
    const modeFilter = searchParams.get('mode')?.trim() || ''
    const createdAfterFilter = searchParams.get('createdAfter')?.trim() || ''

    // Obtener intentos de quiz (ultimos 20)
    debugLog('[v0] Fetching quiz attempts...')
    const rawAttempts = (await sql`
      SELECT
        id,
        subject,
        mode,
        topics,
        total_questions,
        correct_answers,
        incorrect_answers,
        score,
        passed,
        completed_at
      FROM quiz_attempts
      WHERE user_id = ${userId}
      ORDER BY completed_at DESC
      LIMIT 20
    `) as AttemptRow[]
    const attempts = rawAttempts.filter((attempt) => {
      const matchesSubject = subjectFilter.length === 0 || attempt.subject.toLowerCase().includes(subjectFilter.toLowerCase())
      const matchesMode = modeFilter.length === 0 || attempt.mode === modeFilter
      const createdAfterTime = createdAfterFilter.length > 0 ? new Date(createdAfterFilter).getTime() : Number.NaN
      // `?? 0` conserva el comportamiento previo: `new Date(null)` ya era la época.
      const completedTime = new Date(attempt.completed_at ?? 0).getTime()
      const matchesDate = Number.isNaN(createdAfterTime) || completedTime >= createdAfterTime

      return matchesSubject && matchesMode && matchesDate
    })
    debugLog('[v0] Found', attempts.length, 'attempts')

    // Obtener dominio de temas
    debugLog('[v0] Fetching topic mastery...')
    const mastery = await sql`
      SELECT 
        subject,
        topic_id,
        topic_name,
        highest_score AS max_score,
        attempts_count,
        last_attempt_at
      FROM topic_mastery
      WHERE user_id = ${userId}
      ORDER BY subject, topic_name
    `
    debugLog('[v0] Found', mastery.length, 'mastery records')

    // Sin LIMIT: son los números que van a las tarjetas de resumen. Ver el
    // comentario de SubjectModeTotalsRow.
    const totals = (await sql`
      SELECT
        subject,
        mode,
        COUNT(*)::int                                          AS attempts,
        COALESCE(SUM(correct_answers), 0)::int                 AS correct,
        COALESCE(SUM(correct_answers + incorrect_answers), 0)::int AS graded
      FROM quiz_attempts
      WHERE user_id = ${userId}
      GROUP BY subject, mode
      ORDER BY subject, mode
    `) as SubjectModeTotals[]

    const reinforce = (await sql`
      SELECT DISTINCT subject, topic_id AS "topicId"
      FROM student_misconceptions
      WHERE user_id = ${userId} AND resolved = FALSE
    `) as ReinforceTopic[]

    return NextResponse.json({
      attempts,
      mastery,
      totals,
      reinforce
    })

  } catch (error) {
    console.error('[v0] Error fetching history:', error)
    console.error('[v0] Error details:', error instanceof Error ? error.message : String(error))
    console.error('[v0] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Error al obtener el historial', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
