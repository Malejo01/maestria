import { sql } from '@/lib/db'
import { armarTemas, temaMasFlojoDe } from '@/lib/alumnos-docente'
import type { Evidencia } from '@/lib/evidencia-del-muro'

type Fila = Record<string, unknown>

/**
 * AB6 · Lo que practicaron los alumnos del docente en sus grupos abiertos (sin
 * contarlo a él ni a los grupos de ejemplo): cuántos, cuántos ejercicios,
 * desde cuándo y el tema más flojo de todos juntos, con el mismo criterio de
 * la ficha (`temaMasFlojoDe`: «flojo» pide 5 respuestas corregidas). Sólo lee.
 */
export async function leerEvidencia(teacherId: string): Promise<Evidencia> {
  const [totales, temas] = await Promise.all([
    sql`
      SELECT COUNT(DISTINCT att.user_id)::int AS alumnos,
             COALESCE(SUM(att.total_questions), 0)::int AS ejercicios,
             MIN(att.completed_at) AS desde
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open' AND att.user_id <> ${teacherId}
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
    ` as unknown as Promise<Fila[]>,
    sql`
      SELECT t.tema,
             SUM(att.correct_answers)::int AS correctas,
             SUM(att.total_questions - COALESCE(att.ungraded_answers, 0))::int AS calificadas
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      CROSS JOIN LATERAL unnest(att.topics) AS t(tema)
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open' AND att.user_id <> ${teacherId}
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      GROUP BY t.tema
    ` as unknown as Promise<Fila[]>,
  ])
  const fila = totales[0] ?? {}
  const flojo = temaMasFlojoDe(
    armarTemas(temas.map((t) => ({ tema: String(t.tema), correctas: Number(t.correctas), calificadas: Number(t.calificadas) }))),
  )
  return {
    alumnos: Number(fila.alumnos ?? 0),
    ejercicios: Number(fila.ejercicios ?? 0),
    desde: fila.desde ? new Date(fila.desde as string).toISOString() : null,
    temaMasFlojo: flojo?.tema ?? null,
  }
}
