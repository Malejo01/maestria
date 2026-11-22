import { sql } from '@/lib/db'
import { temasSuperados, type RespuestaParaRacha, type TemaAReforzar } from '@/lib/a-reforzar'

/**
 * O2 · "A reforzar" en el servidor: la regla automática (después de guardar
 * un intento) y la marca manual del docente.
 *
 * Válvula de la 031: sin `resolved_at` / `resolved_by` (42703) se pone sólo
 * `resolved = TRUE`, que es de la 009. Nada da 500 por la migración.
 */

function faltaLaMigracion(error: unknown): boolean {
  return (error as { code?: string })?.code === '42703'
}

const iso = (valor: string | Date | null | undefined) =>
  valor instanceof Date ? valor.toISOString() : valor ? new Date(valor).toISOString() : ''

/**
 * Revisa los temas a reforzar del alumno y marca los que ya superó (3 aciertos
 * seguidos en ese tema del programa, en intentos posteriores al error).
 * Devuelve los ids resueltos. Nunca lanza: lo llama save-result después de
 * guardar, y un problema acá no puede tumbar el guardado del intento.
 */
export async function resolverPorAciertos(userId: string): Promise<number[]> {
  try {
    const pendientes = (await sql`
      SELECT id, subject, topic_name, created_at
      FROM student_misconceptions
      WHERE user_id = ${userId} AND resolved = FALSE
      ORDER BY created_at
      LIMIT 200
    `) as { id: number; subject: string; topic_name: string; created_at: string | Date }[]
    if (pendientes.length === 0) return []

    const desde = iso(pendientes[0].created_at)
    const filas = (await sql`
      SELECT a.subject, a.topics, a.started_at, a.completed_at, q.topic_name, q.is_correct, q.question_index
      FROM quiz_attempts a
      JOIN quiz_answers q ON q.quiz_attempt_id = a.id
      WHERE a.user_id = ${userId} AND a.completed_at > ${desde}::timestamptz
      ORDER BY a.completed_at, q.question_index
      LIMIT 3000
    `) as {
      subject: string
      topics: string[] | null
      started_at: string | Date | null
      completed_at: string | Date
      topic_name: string | null
      is_correct: boolean | null
      question_index: number | null
    }[]

    const respuestas: RespuestaParaRacha[] = filas.map((f) => ({
      materia: f.subject,
      temasDelIntento: Array.isArray(f.topics) ? f.topics.filter((t): t is string => typeof t === 'string') : [],
      topicName: f.topic_name,
      correcta: typeof f.is_correct === 'boolean' ? f.is_correct : null,
      empezadoEl: iso(f.started_at ?? f.completed_at),
      terminadoEl: iso(f.completed_at),
      indice: Number(f.question_index ?? 0),
    }))
    const temas: TemaAReforzar[] = pendientes.map((p) => ({ id: Number(p.id), materia: p.subject, tema: p.topic_name, desde: iso(p.created_at) }))

    const ids = temasSuperados(temas, respuestas)
    if (ids.length > 0) await marcarResueltos(userId, ids, 'auto')
    return ids
  } catch (error) {
    console.warn('[a reforzar] no se pudo revisar:', error instanceof Error ? error.message : error)
    return []
  }
}

async function marcarResueltos(userId: string, ids: number[], quien: string) {
  try {
    await sql`
      UPDATE student_misconceptions
      SET resolved = TRUE, resolved_at = NOW(), resolved_by = ${quien}, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ANY(${ids}::int[]) AND resolved = FALSE
    `
  } catch (error) {
    if (!faltaLaMigracion(error)) throw error
    await sql`
      UPDATE student_misconceptions SET resolved = TRUE, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ANY(${ids}::int[]) AND resolved = FALSE
    `
  }
}

/**
 * El docente marca un tema como superado (o lo devuelve a "a reforzar").
 * Quien llama ya verificó que el alumno está en un grupo del docente. Devuelve
 * false si ese tema no es de ese alumno.
 */
export async function marcarTemaDelAlumno(userId: string, misconceptionId: number, superado: boolean, docenteId: string): Promise<boolean> {
  try {
    const filas = (
      superado
        ? await sql`
            UPDATE student_misconceptions
            SET resolved = TRUE, resolved_at = NOW(), resolved_by = ${docenteId}, updated_at = NOW()
            WHERE id = ${misconceptionId} AND user_id = ${userId}
            RETURNING id
          `
        : await sql`
            UPDATE student_misconceptions
            SET resolved = FALSE, resolved_at = NULL, resolved_by = NULL, updated_at = NOW()
            WHERE id = ${misconceptionId} AND user_id = ${userId}
            RETURNING id
          `
    ) as { id: number }[]
    return filas.length > 0
  } catch (error) {
    if (!faltaLaMigracion(error)) throw error
    const filas = (await sql`
      UPDATE student_misconceptions SET resolved = ${superado}, updated_at = NOW()
      WHERE id = ${misconceptionId} AND user_id = ${userId}
      RETURNING id
    `) as { id: number }[]
    return filas.length > 0
  }
}
