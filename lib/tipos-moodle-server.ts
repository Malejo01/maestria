import { sql } from '@/lib/db'

/**
 * Ronda T · F2 — La válvula de la migración 042: ¿la base acepta guardar este
 * tipo en `quiz_answers.question_type`? La 013 dejó un CHECK con los cuatro
 * tipos de siempre; la 042 lo amplía. Sin la 042, la respuesta se guarda como
 * `short_answer` con el tipo real en `answer_payload.tipo` (y lo elegido y lo
 * correcto en texto), así no se pierde nada.
 */
export async function laBaseAceptaElTipo(tipo: string): Promise<boolean> {
  try {
    const filas = (await sql`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      WHERE c.conrelid = 'quiz_answers'::regclass AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%question_type%'
    `) as { def: string }[]
    return filas.every((f) => f.def.includes(`'${tipo}'`))
  } catch {
    return false
  }
}
