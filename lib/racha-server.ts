import { sql } from '@/lib/db'
import { rachaDelNavegador, siguienteRacha } from '@/lib/racha'

/**
 * O4 · La racha en la base (`rachas_alumno`, migración 032).
 * Válvula: sin la 032 (42P01) todo devuelve null y nadie falla.
 */
function faltaLaTabla(error: unknown): boolean {
  return (error as { code?: string })?.code === '42P01'
}

/** La racha guardada del alumno, o null si no tiene fila (o falta la 032). */
export async function leerRacha(userId: string): Promise<{ racha: number; mejor: number } | null> {
  try {
    const filas = (await sql`SELECT racha, mejor FROM rachas_alumno WHERE user_id = ${userId}`) as { racha: number; mejor: number }[]
    return filas[0] ? { racha: Number(filas[0].racha), mejor: Number(filas[0].mejor) } : null
  } catch (error) {
    if (faltaLaTabla(error)) return null
    throw error
  }
}

/**
 * Después de guardar un intento: aprobar suma, no aprobar vuelve a cero.
 * Atómico en una sola sentencia (dos pestañas que guardan a la vez no pisan
 * la cuenta). Nunca lanza: no puede tumbar el guardado del intento.
 */
export async function anotarIntentoEnLaRacha(userId: string, aprobo: boolean): Promise<number | null> {
  try {
    const inicial = siguienteRacha(0, aprobo)
    const filas = (await sql`
      INSERT INTO rachas_alumno (user_id, racha, mejor, actualizada_el)
      VALUES (${userId}, ${inicial}, ${inicial}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        racha = CASE WHEN ${aprobo} THEN rachas_alumno.racha + 1 ELSE 0 END,
        mejor = GREATEST(rachas_alumno.mejor, CASE WHEN ${aprobo} THEN rachas_alumno.racha + 1 ELSE 0 END),
        actualizada_el = NOW()
      RETURNING racha
    `) as { racha: number }[]
    return filas[0] ? Number(filas[0].racha) : null
  } catch (error) {
    if (!faltaLaTabla(error)) console.warn('[racha] no se pudo anotar:', error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * La primera vez que el alumno entra con la 032: la racha que tenía el
 * navegador pasa a la base, UNA vez. Si ya hay fila (ya se migró, o ya
 * guardó intentos con la base al día), no se toca: manda la base.
 */
export async function migrarRachaDelNavegador(userId: string, valor: unknown): Promise<number | null> {
  const racha = rachaDelNavegador(valor)
  try {
    await sql`
      INSERT INTO rachas_alumno (user_id, racha, mejor, migrada_de_local, actualizada_el)
      VALUES (${userId}, ${racha}, ${racha}, TRUE, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
    return (await leerRacha(userId))?.racha ?? null
  } catch (error) {
    if (faltaLaTabla(error)) return null
    throw error
  }
}

/** Un invitado que crea su cuenta: su racha pasa a la cuenta si la cuenta no tenía. */
export async function pasarRachaDeInvitado(guestId: string, userId: string): Promise<void> {
  try {
    await sql`
      INSERT INTO rachas_alumno (user_id, racha, mejor, migrada_de_local, actualizada_el)
      SELECT ${userId}, racha, mejor, migrada_de_local, NOW() FROM rachas_alumno WHERE user_id = ${guestId}
      ON CONFLICT (user_id) DO NOTHING
    `
  } catch (error) {
    if (!faltaLaTabla(error)) throw error
  }
}
