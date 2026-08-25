import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { GUEST_COOKIE_NAME, verifyGuestToken } from '@/lib/guest-session'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * POST /api/student/guest/claim
 *
 * Absorbs the progress a student made as a guest into the Google account they
 * just signed in with. Requires BOTH identities in the same request: a valid
 * NextAuth session and a valid guest cookie — which is exactly the state right
 * after "entré como invitado, después me creé la cuenta".
 *
 * Everything is moved by re-pointing user_id, so nothing is copied or lost:
 *  - quiz_attempts    → straight UPDATE (no uniqueness to worry about)
 *  - topic_mastery    → merged, keeping the better score and the sum of tries
 *  - misconceptions   → straight UPDATE
 *  - memberships      → moved, upgrading the row to verified; if the account
 *                       was already in that aula, the guest row is dropped
 *
 * The guest row is then marked as claimed (never deleted, so the merge stays
 * auditable) and its cookie cleared, which retires that identity for good.
 */
export async function POST() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'Iniciá sesión para conservar tu progreso.' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const guestId = await verifyGuestToken(cookieStore.get(GUEST_COOKIE_NAME)?.value)

  if (!guestId || guestId === userId) {
    return NextResponse.json({ claimed: false, reason: 'sin_invitado' })
  }

  try {
    const guestRows = (await sql`
      SELECT id, claimed_by_user_id FROM users WHERE id = ${guestId} AND is_guest = true LIMIT 1
    `) as { id: string; claimed_by_user_id: string | null }[]

    if (guestRows.length === 0 || guestRows[0].claimed_by_user_id) {
      const alreadyDone = NextResponse.json({ claimed: false, reason: 'ya_reclamado' })
      alreadyDone.cookies.delete(GUEST_COOKIE_NAME)
      return alreadyDone
    }

    const movedAttempts = await sql`
      UPDATE quiz_attempts SET user_id = ${userId} WHERE user_id = ${guestId} RETURNING id
    `

    // topic_mastery is UNIQUE(user_id, subject, topic_id): merge instead of
    // moving, so a topic practised under both identities keeps one row with
    // the best score and the combined attempt count.
    await sql`
      INSERT INTO topic_mastery (user_id, subject, topic_id, topic_name, highest_score, attempts_count, last_attempt_at, mastered_at, created_at, updated_at)
      SELECT ${userId}, subject, topic_id, topic_name, highest_score, attempts_count, last_attempt_at, mastered_at, NOW(), NOW()
      FROM topic_mastery
      WHERE user_id = ${guestId}
      ON CONFLICT (user_id, subject, topic_id) DO UPDATE
        SET highest_score  = GREATEST(topic_mastery.highest_score, EXCLUDED.highest_score),
            attempts_count = topic_mastery.attempts_count + EXCLUDED.attempts_count,
            last_attempt_at = GREATEST(
              COALESCE(topic_mastery.last_attempt_at, EXCLUDED.last_attempt_at),
              COALESCE(EXCLUDED.last_attempt_at, topic_mastery.last_attempt_at)
            ),
            mastered_at = LEAST(
              COALESCE(topic_mastery.mastered_at, EXCLUDED.mastered_at),
              COALESCE(EXCLUDED.mastered_at, topic_mastery.mastered_at)
            ),
            updated_at = NOW()
    `
    await sql`DELETE FROM topic_mastery WHERE user_id = ${guestId}`

    await sql`UPDATE student_misconceptions SET user_id = ${userId} WHERE user_id = ${guestId}`

    // Memberships the account already has win; the guest's duplicates go away.
    await sql`
      DELETE FROM classroom_members g
      WHERE g.user_id = ${guestId}
        AND EXISTS (
          SELECT 1 FROM classroom_members existing
          WHERE existing.classroom_id = g.classroom_id AND existing.user_id = ${userId}
        )
    `
    const movedMemberships = await sql`
      UPDATE classroom_members
      SET user_id = ${userId},
          is_verified = true,
          display_name = COALESCE(${session?.user?.name ?? null}, display_name),
          updated_at = NOW()
      WHERE user_id = ${guestId}
      RETURNING id
    `

    // El consumo de IA del invitado se muda a la cuenta real: si no, crear
    // cuenta sería la forma de resetear el contador, y el gasto quedaría
    // huérfano en el dashboard.
    await sql`UPDATE ai_usage_log SET user_id = ${userId}, is_guest = false WHERE user_id = ${guestId}`

    await sql`
      UPDATE users SET claimed_by_user_id = ${userId}, updated_at = NOW() WHERE id = ${guestId}
    `

    const response = NextResponse.json({
      claimed: true,
      movedAttempts: movedAttempts.length,
      movedMemberships: movedMemberships.length,
    })
    response.cookies.delete(GUEST_COOKIE_NAME)
    return response
  } catch (error) {
    // Si el claim falla a mitad de camino el progreso del invitado queda en el
    // limbo y el alumno no tiene forma de contarlo: este evento es la única señal.
    captureRouteFailure(error, { endpoint: '/api/student/guest/claim', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo transferir tu progreso', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
