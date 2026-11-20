import { sql } from '@/lib/db'

/**
 * L0 en el servidor: si está la 028, y el traspaso del destinatario cuando una
 * invitación se usa. La regla de quién ve qué es lib/destinatario.ts.
 */

/** Postgres: tabla o columna inexistente. */
function faltaElEsquema(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42P01' || code === '42703'
}

/** ¿Están las columnas de la 028? Sin ellas no hay dónde guardar un destinatario individual. */
export async function destinatarioDisponible(): Promise<boolean> {
  try {
    await sql`SELECT solo_user_id, solo_invitacion_id FROM classroom_assignments LIMIT 0`
    await sql`SELECT user_id, invitation_id FROM diagnosticos LIMIT 0`
    return true
  } catch (error) {
    if (faltaElEsquema(error)) return false
    throw error
  }
}

/**
 * Las consultas que pasan lo individual de una invitación a su alumno: las
 * asignaciones (`solo_invitacion_id` → `solo_user_id`) y los diagnósticos.
 * Van SIN await, para meterlas en la misma transacción que la ficha; y antes
 * de borrar la invitación, que se llevaría todo en cascada.
 */
export function consultasDeTraspaso(invitacionId: number, userId: string) {
  return [
    sql`
      UPDATE classroom_assignments SET solo_user_id = ${userId}, solo_invitacion_id = NULL, updated_at = NOW()
      WHERE solo_invitacion_id = ${invitacionId}
    `,
    sql`
      UPDATE diagnosticos SET user_id = ${userId}, invitation_id = NULL
      WHERE invitation_id = ${invitacionId}
    `,
  ]
}

/**
 * Un invitado que crea su cuenta se lleva lo individual que tenía. Sin la 028
 * no hay nada que llevar.
 */
export async function traspasarDeInvitadoACuenta(guestId: string, userId: string): Promise<void> {
  if (!(await destinatarioDisponible())) return
  await sql.transaction([
    sql`UPDATE classroom_assignments SET solo_user_id = ${userId}, updated_at = NOW() WHERE solo_user_id = ${guestId}`,
    sql`UPDATE diagnosticos SET user_id = ${userId} WHERE user_id = ${guestId}`,
  ])
}
