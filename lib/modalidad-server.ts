import { sql } from '@/lib/db'
import { captureRouteFailure } from '@/lib/observability'
import type { Modalidad } from '@/lib/modalidad'

/**
 * AC1 · Guarda la modalidad del docente en `users.modalidad` (050). Devuelve
 * la que quedó, o null si no se pudo (la válvula: sin la 050, nada cambia y el
 * docente sigue con la regla B1). Nunca lanza.
 */
export async function guardarModalidad(userId: string, modalidad: Modalidad): Promise<Modalidad | null> {
  try {
    const filas = (await sql`
      UPDATE users SET modalidad = ${modalidad}, updated_at = NOW() WHERE id = ${userId} RETURNING modalidad
    `) as { modalidad: Modalidad }[]
    return filas[0]?.modalidad ?? null
  } catch (error) {
    if ((error as { code?: string })?.code !== '42703') {
      captureRouteFailure(error, { endpoint: 'lib/modalidad-server', operation: 'guardarModalidad' })
    }
    return null
  }
}
