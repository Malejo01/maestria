import { cookies } from 'next/headers'
import { sql } from '@/lib/db'
import { COOKIE_DE_ORIGEN, leerCookieDeOrigen, type PersonaConOrigen } from '@/lib/origen'

/**
 * Ronda V · V1 — El canal de la primera visita, al registrarse. Lee la cookie
 * del middleware y lo guarda en `users` sólo si todavía no tenía (nunca pisa).
 *
 * Válvula: sin la 044 (o sin cookie), no hace nada. Nunca lanza: el registro
 * no puede fallar por esto.
 */
export async function registrarOrigen(userId: string): Promise<void> {
  try {
    const origen = leerCookieDeOrigen((await cookies()).get(COOKIE_DE_ORIGEN)?.value)
    if (!origen) return
    await sql`
      UPDATE users
      SET origen = ${origen.origen}, origen_ref = ${origen.ref}, origen_el = ${origen.el ?? null}::date
      WHERE id = ${userId} AND origen IS NULL AND origen_ref IS NULL
    `
  } catch (error) {
    console.warn('[origen] no se guardó el canal (¿falta la 044?):', (error as { code?: string })?.code ?? error)
  }
}

/** Todas las personas con su canal y su rol (los invitados cuentan como alumnos). Sin la 044, todas "sin dato". */
export async function personasConOrigen(): Promise<PersonaConOrigen[]> {
  const filas = (await sql`
    SELECT id, role, to_jsonb(users) ->> 'origen' AS origen FROM users
  `) as { id: string; role: string | null; origen: string | null }[]
  return filas.map((f) => ({ origen: f.origen, rol: f.role === 'DOCENTE' ? 'DOCENTE' : 'ALUMNO', id: f.id }) as PersonaConOrigen & { id: string })
}
