import { sql } from '@/lib/db'
import { leerMiembros, leerMisAlumnos } from '@/lib/alumnos-docente-server'
import { DIAS_DE_LA_SEMANA, resumenDeLaSemana, type AlumnoDeLaSemana, type ResumenDeLaSemana } from '@/lib/esta-semana'

/** La última tarea mandada, para volver a armar su mensaje (lib/compartir-tarea.ts) si nadie practicó. */
export interface TareaParaReenviar {
  materia: string
  temas: string[]
  codigo: string
  hasta: string | null
  alumnos: { nombre: string }[]
}

export interface EstaSemana {
  resumen: ResumenDeLaSemana
  ultimaTarea: TareaParaReenviar | null
}

type Fila = Record<string, unknown>

/**
 * AB5 · Los datos de «Esta semana». Los alumnos y su tema más flojo salen del
 * mismo listado que Mis alumnos (`leerMisAlumnos`, que arma la ficha de cada
 * uno); lo de los últimos 7 días, de `quiz_attempts` en sus grupos abiertos.
 * Los alumnos ficticios de la materia de ejemplo (V2) no cuentan. Sólo lee.
 */
export async function leerEstaSemana(teacherId: string): Promise<EstaSemana> {
  const [listado, miembros, semana, ultima] = await Promise.all([
    leerMisAlumnos(teacherId),
    leerMiembros(teacherId),
    sql`
      SELECT att.user_id,
             COUNT(*)::int AS intentos,
             COALESCE(SUM(att.total_questions), 0)::int AS ejercicios,
             COALESCE(SUM(att.correct_answers), 0)::int AS correctas,
             COALESCE(SUM(att.total_questions - COALESCE(att.ungraded_answers, 0)), 0)::int AS calificadas
      FROM quiz_attempts att
      JOIN classrooms c ON c.id = att.classroom_id
      WHERE c.teacher_id = ${teacherId}
        AND c.status = 'open'
        AND att.user_id <> ${teacherId}
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
        AND att.completed_at >= NOW() - make_interval(days => ${DIAS_DE_LA_SEMANA})
      GROUP BY att.user_id
    ` as unknown as Promise<Fila[]>,
    sql`
      SELECT q.subject_name, q.selected_topics, c.id AS grupo_id, c.join_code, a.due_at
      FROM classroom_assignments a
      JOIN classrooms c ON c.id = a.classroom_id
      JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open'
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ` as unknown as Promise<Fila[]>,
  ])

  const deEjemplo = new Set(miembros.filter((m) => m.ejemplo).map((m) => m.userId))
  const porAlumno = new Map(semana.map((f) => [String(f.user_id), f]))
  const alumnos: AlumnoDeLaSemana[] = listado.alumnos
    .filter((fila) => !fila.userId || !deEjemplo.has(fila.userId))
    .map((fila) => {
      const s = fila.userId ? porAlumno.get(fila.userId) : undefined
      return {
        nombre: fila.nombre,
        intentos: Number(s?.intentos ?? 0),
        ejercicios: Number(s?.ejercicios ?? 0),
        correctas: Number(s?.correctas ?? 0),
        calificadas: Number(s?.calificadas ?? 0),
        temaMasFlojo: fila.temaMasFlojo,
      }
    })
  const resumen = resumenDeLaSemana(alumnos)

  let ultimaTarea: TareaParaReenviar | null = null
  const fila = ultima[0]
  if (fila && resumen.nadie) {
    const nombres = (await sql`
      SELECT m.display_name FROM classroom_members m
      WHERE m.classroom_id = ${fila.grupo_id as number} AND m.status = 'active' AND m.user_id <> ${teacherId}
    `) as Fila[]
    ultimaTarea = {
      materia: String(fila.subject_name),
      temas: temasDe(fila.selected_topics),
      codigo: String(fila.join_code),
      hasta: fila.due_at ? new Date(fila.due_at as string).toISOString() : null,
      alumnos: nombres.map((n) => ({ nombre: String(n.display_name ?? '') })),
    }
  }

  return { resumen, ultimaTarea }
}

/** `teacher_quizzes.selected_topics`: nombres sueltos u objetos con `name`, según la versión. */
function temasDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor
    .map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t !== null ? String((t as { name?: unknown }).name ?? '') : ''))
    .map((t) => t.trim())
    .filter(Boolean)
}
