import { sql } from '@/lib/db'
import type { Lectura } from '@/lib/avisos/tipos'

/**
 * P3 · Hasta cuándo alguien marcó sus avisos como leídos, para cualquier rol
 * (migración 035, `avisos_lectura`).
 *
 * La válvula, sin la 035 (42P01):
 *   - docente → la columna de la 034 (`users.avisos_docente_visto_el`), como
 *     antes; sin la 034 tampoco, sin "no leídos".
 *   - alumno o invitado → la campanita sin "no leídos" ni "Marcar todo".
 */
const faltaLaTabla = (e: unknown) => (e as { code?: string })?.code === '42P01'
const faltaColumna = (e: unknown) => ['42703', '42P01'].includes((e as { code?: string })?.code ?? '')
const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null)

async function lecturaDeLa034(userId: string): Promise<Lectura> {
  try {
    const filas = (await sql`SELECT avisos_docente_visto_el AS v FROM users WHERE id = ${userId}`) as { v: string | Date | null }[]
    return { vistoEl: iso(filas[0]?.v), puedeMarcar: true }
  } catch (error) {
    if (faltaColumna(error)) return { vistoEl: null, puedeMarcar: false }
    throw error
  }
}

export async function leerLectura(userId: string, { esDocente }: { esDocente: boolean }): Promise<Lectura> {
  try {
    const filas = (await sql`SELECT visto_el FROM avisos_lectura WHERE user_id = ${userId}`) as { visto_el: string | Date }[]
    return { vistoEl: iso(filas[0]?.visto_el), puedeMarcar: true }
  } catch (error) {
    if (!faltaLaTabla(error)) throw error
    return esDocente ? lecturaDeLa034(userId) : { vistoEl: null, puedeMarcar: false }
  }
}

/** "Marcar todo como leído": desde ahora, lo anterior está leído. */
export async function marcarTodoLeido(userId: string, { esDocente }: { esDocente: boolean }): Promise<void> {
  try {
    await sql`
      INSERT INTO avisos_lectura (user_id, visto_el) VALUES (${userId}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET visto_el = NOW()
    `
  } catch (error) {
    if (!faltaLaTabla(error)) throw error
    if (!esDocente) return
    try {
      await sql`UPDATE users SET avisos_docente_visto_el = NOW() WHERE id = ${userId}`
    } catch (e) {
      if (!faltaColumna(e)) throw e
    }
  }
}
