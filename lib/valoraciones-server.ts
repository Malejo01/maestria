import { sql } from '@/lib/db'
import { esMotivo, MOTIVOS, type Motivo, type PreguntaAEvitar, type Valoracion, MAX_A_EVITAR } from '@/lib/valoraciones'

/**
 * O8 · Las valoraciones en la base (`pregunta_valoraciones`, migración 033).
 * Válvula: sin la 033 (42P01) las lecturas dan vacío y la escritura avisa.
 */
export function faltaLaTabla(error: unknown): boolean {
  return (error as { code?: string })?.code === '42P01'
}

/** Las valoraciones de un cuestionario del docente, por índice. */
export async function valoracionesDelCuestionario(docenteId: string, quizId: number): Promise<Valoracion[]> {
  try {
    const filas = (await sql`
      SELECT indice, valor, motivo FROM pregunta_valoraciones
      WHERE docente_id = ${docenteId} AND teacher_quiz_id = ${quizId}
      ORDER BY indice
    `) as { indice: number; valor: number; motivo: string | null }[]
    return filas.map((f) => ({ indice: Number(f.indice), valor: Number(f.valor) === 1 ? 1 : -1, motivo: esMotivo(f.motivo) ? f.motivo : null }))
  } catch (error) {
    if (faltaLaTabla(error)) return []
    throw error
  }
}

/** Guarda (o cambia) la valoración de una pregunta. Lanza si falta la 033: la ruta lo informa. */
export async function guardarValoracion(
  docenteId: string,
  quiz: { id: number; teacherProgramId: number | null },
  v: Valoracion,
  enunciado: string,
): Promise<void> {
  await sql`
    INSERT INTO pregunta_valoraciones (docente_id, teacher_quiz_id, teacher_program_id, indice, valor, motivo, enunciado, creado_el)
    VALUES (${docenteId}, ${quiz.id}, ${quiz.teacherProgramId}, ${v.indice}, ${v.valor}, ${v.motivo}, ${enunciado.slice(0, 2000)}, NOW())
    ON CONFLICT (docente_id, teacher_quiz_id, indice) DO UPDATE SET
      valor = EXCLUDED.valor, motivo = EXCLUDED.motivo, enunciado = EXCLUDED.enunciado,
      teacher_program_id = EXCLUDED.teacher_program_id, creado_el = NOW()
  `
}

export async function borrarValoracion(docenteId: string, quizId: number, indice: number): Promise<void> {
  try {
    await sql`DELETE FROM pregunta_valoraciones WHERE docente_id = ${docenteId} AND teacher_quiz_id = ${quizId} AND indice = ${indice}`
  } catch (error) {
    if (!faltaLaTabla(error)) throw error
  }
}

/**
 * Los últimos 10 pulgares abajo de la materia, del docente dueño de la
 * materia (los únicos que pueden valorar sus cuestionarios). Para el prompt.
 * Nunca lanza: si falla, la generación sigue sin la sección.
 */
export async function preguntasAEvitar(teacherProgramId: number | null | undefined): Promise<PreguntaAEvitar[]> {
  if (!teacherProgramId) return []
  try {
    const filas = (await sql`
      SELECT v.enunciado, v.motivo
      FROM pregunta_valoraciones v
      JOIN teacher_programs p ON p.id = v.teacher_program_id AND p.user_id = v.docente_id
      WHERE v.teacher_program_id = ${teacherProgramId} AND v.valor = -1
      ORDER BY v.creado_el DESC
      LIMIT ${MAX_A_EVITAR}
    `) as { enunciado: string; motivo: string }[]
    return filas.filter((f) => esMotivo(f.motivo) && f.enunciado).map((f) => ({ enunciado: f.enunciado, motivo: f.motivo as Motivo }))
  } catch (error) {
    if (!faltaLaTabla(error)) console.warn('[valoraciones] no se pudieron leer:', error instanceof Error ? error.message : error)
    return []
  }
}

/** Para /admin/ai-usage: pulgares abajo por motivo y el total de pulgares arriba. */
export async function resumenDeValoraciones(): Promise<{ porMotivo: Record<Motivo, number>; arriba: number } | null> {
  try {
    const filas = (await sql`
      SELECT valor, motivo, COUNT(*)::int AS n FROM pregunta_valoraciones GROUP BY valor, motivo
    `) as { valor: number; motivo: string | null; n: number }[]
    const porMotivo = Object.fromEntries(MOTIVOS.map((m) => [m, 0])) as Record<Motivo, number>
    let arriba = 0
    for (const f of filas) {
      if (Number(f.valor) === 1) arriba += Number(f.n)
      else if (esMotivo(f.motivo)) porMotivo[f.motivo] += Number(f.n)
    }
    return { porMotivo, arriba }
  } catch (error) {
    if (faltaLaTabla(error)) return null
    throw error
  }
}
