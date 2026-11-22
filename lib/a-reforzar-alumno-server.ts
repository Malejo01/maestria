import { sql } from '@/lib/db'
import type { WeakPoint } from '@/lib/types'

/**
 * P7 · "A reforzar" de un alumno, leído de la base. Es la misma función para
 * Mi progreso (/history) y para la ficha que ve el docente: así muestran los
 * mismos temas (antes Mi progreso leía lo que guardaba el navegador).
 *
 * "A reforzar" = sus `student_misconceptions` sin resolver, una fila por
 * materia y tema, con cuántas veces apareció y el último tipo de error y tip.
 * Lo superado (O2) no está acá: va en "Ya lo dominás".
 */
export async function temasAReforzar(userId: string, materia?: string): Promise<WeakPoint[]> {
  const filas = (await sql`
    SELECT subject, topic_id, topic_name, COUNT(*)::int AS veces,
      (ARRAY_AGG(misconception_type ORDER BY created_at DESC))[1] AS tipo,
      (ARRAY_AGG(NULLIF(tip, '') ORDER BY created_at DESC) FILTER (WHERE tip <> ''))[1] AS ultimo_tip,
      MAX(created_at) AS ultima
    FROM student_misconceptions
    WHERE user_id = ${userId}
      AND resolved = FALSE
      AND (${materia ?? null}::text IS NULL OR subject = ${materia ?? null})
    GROUP BY subject, topic_id, topic_name
    ORDER BY ultima DESC
  `) as { subject: string; topic_id: string; topic_name: string; veces: number; tipo: string | null; ultimo_tip: string | null }[]
  return filas.map((f) => ({
    topic: f.topic_id,
    topicName: f.topic_name,
    subject: f.subject,
    count: Number(f.veces),
    ...(f.tipo ? { misconceptionType: f.tipo } : {}),
    ...(f.ultimo_tip ? { lastTip: f.ultimo_tip } : {}),
  }))
}

/** El tipo con el que entran los temas que venían del navegador (sin tip escrito). */
export const TIPO_DEL_NAVEGADOR = 'Error en la práctica'

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Lo que manda el navegador, validado: sólo materia, tema y (si hay) tipo y tip. Hasta 100. */
export function debilesValidos(crudo: unknown): { subject: string; topic: string; topicName: string; tipo: string; tip: string }[] {
  if (!Array.isArray(crudo)) return []
  const salida: { subject: string; topic: string; topicName: string; tipo: string; tip: string }[] = []
  for (const d of crudo.slice(0, 100)) {
    const v = d as Record<string, unknown>
    const subject = texto(v?.subject, 200)
    const topicName = texto(v?.topicName, 300) ?? texto(v?.topic, 300)
    if (!subject || !topicName) continue
    salida.push({
      subject,
      topicName,
      topic: texto(v?.topic, 200) ?? topicName.toLowerCase().replace(/\s+/g, '-'),
      tipo: texto(v?.misconceptionType, 200) ?? TIPO_DEL_NAVEGADOR,
      tip: texto(v?.lastTip, 2000) ?? '',
    })
  }
  return salida
}

/**
 * P7 · Lo que tenía el navegador pasa a la base, como la racha en O4. Un tema
 * que la base ya conoce para ese alumno y esa materia (pendiente O superado)
 * no se toca: manda la base. Devuelve cuántos entraron.
 */
export async function migrarDebilesDelNavegador(userId: string, crudo: unknown): Promise<number> {
  let migrados = 0
  for (const d of debilesValidos(crudo)) {
    const filas = (await sql`
      INSERT INTO student_misconceptions (user_id, subject, topic_id, topic_name, misconception_type, tip)
      SELECT ${userId}, ${d.subject}, ${d.topic}, ${d.topicName}, ${d.tipo}, ${d.tip}
      WHERE NOT EXISTS (
        SELECT 1 FROM student_misconceptions
        WHERE user_id = ${userId} AND subject = ${d.subject}
          AND (topic_id = ${d.topic} OR lower(topic_name) = lower(${d.topicName}))
      )
      RETURNING id
    `) as { id: number }[]
    migrados += filas.length
  }
  return migrados
}
