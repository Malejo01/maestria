import { sql } from '@/lib/db'
import { armarBanco, facetasDelBanco, unidadesDelPrograma, type FilaDelBanco, type FiltrosDelBanco, type PreguntaDelBanco, type UnidadesPorMateria } from '@/lib/banco'

/**
 * Ronda W · W1 — El banco de preguntas del docente, leído de sus cuestionarios
 * (`teacher_quizzes.questions`) con los pulgares de O8. Sin migración: si un
 * día hace falta un índice para que sea rápido, se agrega aparte. Las
 * materias de ejemplo (V2) no entran.
 */
export async function leerBanco(docenteId: string, filtros: FiltrosDelBanco = {}, limite = 300) {
  const [filas, programas] = await Promise.all([
    sql`
      SELECT q.id AS quiz_id, (e.indice - 1)::int AS indice, q.title, q.teacher_program_id, q.subject_name, q.created_at, e.pregunta,
             (SELECT v.valor FROM pregunta_valoraciones v
               WHERE v.docente_id = ${docenteId} AND v.teacher_quiz_id = q.id AND v.indice = e.indice - 1 LIMIT 1) AS valor
      FROM teacher_quizzes q
      LEFT JOIN teacher_programs p ON p.id = q.teacher_program_id
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(q.questions) = 'array' THEN q.questions ELSE '[]'::jsonb END)
        WITH ORDINALITY AS e(pregunta, indice)
      WHERE q.user_id = ${docenteId}
        AND COALESCE((to_jsonb(p) ->> 'ejemplo')::boolean, false) = false
      ORDER BY q.created_at DESC
      LIMIT 3000
    ` as unknown as Promise<Record<string, unknown>[]>,
    sql`
      SELECT id, subject_name, units FROM teacher_programs
      WHERE user_id = ${docenteId} AND COALESCE((to_jsonb(teacher_programs) ->> 'ejemplo')::boolean, false) = false
    ` as unknown as Promise<{ id: number; subject_name: string; units: unknown }[]>,
  ])
  const unidades: UnidadesPorMateria = new Map(programas.map((p) => [Number(p.id), unidadesDelPrograma(p.units)]))
  const nombreDe = new Map(programas.map((p) => [Number(p.id), String(p.subject_name)]))
  const crudas: FilaDelBanco[] = filas.map((f) => ({
    quizId: Number(f.quiz_id),
    indice: Number(f.indice),
    titulo: String(f.title ?? ''),
    materiaId: f.teacher_program_id === null ? null : Number(f.teacher_program_id),
    materia: nombreDe.get(Number(f.teacher_program_id)) ?? String(f.subject_name ?? ''),
    creadoEl: new Date(f.created_at as string).toISOString(),
    pregunta: (f.pregunta ?? {}) as Record<string, unknown>,
    valor: f.valor === null || f.valor === undefined ? null : Number(f.valor),
  }))
  const todo = armarBanco(crudas, unidades)
  const filtrado = armarBanco(crudas, unidades, filtros)
  return { preguntas: filtrado.slice(0, limite) as PreguntaDelBanco[], total: filtrado.length, facetas: facetasDelBanco(todo) }
}
