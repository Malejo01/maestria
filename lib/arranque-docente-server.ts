import { sql } from '@/lib/db'
import { estadoDelArranque, type EstadoDelArranque } from '@/lib/arranque-docente'

/** Lo que hace falta para volver a armar el mensaje de la última tarea mandada (lib/compartir-tarea.ts). */
export interface UltimaTareaMandada {
  materia: string
  temas: string[]
  codigo: string
  /** Hasta cuándo, si el docente puso fecha (ISO). */
  hasta: string | null
  /** Los nombres del grupo, para saludar sólo si hay uno. */
  alumnos: { nombre: string }[]
}

export interface ArranqueDelDocente extends EstadoDelArranque {
  ultimaTarea: UltimaTareaMandada | null
}

/**
 * AB4 · Lee lo que hace falta para el arranque guiado. Sólo lecturas, sobre las
 * mismas tablas e índices que el onboarding de siempre. Lo de ejemplo (V2) y
 * las materias personales (E1) no cuentan.
 */
export async function leerArranque(teacherId: string, ahora: Date = new Date()): Promise<ArranqueDelDocente> {
  const [materias, armadas, mandadas, practicas, ultima] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS total FROM teacher_programs p
      WHERE p.user_id = ${teacherId} AND p.status = 'active'
        AND COALESCE((to_jsonb(p) ->> 'personal')::boolean, false) = false
        AND COALESCE((to_jsonb(p) ->> 'ejemplo')::boolean, false) = false
    ` as unknown as Promise<{ total: number }[]>,
    sql`
      SELECT COUNT(*)::int AS total FROM teacher_quizzes q WHERE q.user_id = ${teacherId}
        AND NOT EXISTS (SELECT 1 FROM teacher_programs p WHERE p.id = q.teacher_program_id AND COALESCE((to_jsonb(p) ->> 'ejemplo')::boolean, false))
    ` as unknown as Promise<{ total: number }[]>,
    sql`
      SELECT COUNT(*)::int AS total FROM classroom_assignments a JOIN classrooms c ON c.id = a.classroom_id
      WHERE c.teacher_id = ${teacherId} AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
    ` as unknown as Promise<{ total: number }[]>,
    sql`
      SELECT att.user_id, MIN(att.completed_at) AS primero
      FROM quiz_attempts att
      JOIN classroom_assignments a ON a.id = att.assignment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE c.teacher_id = ${teacherId} AND att.user_id <> ${teacherId}
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      GROUP BY att.user_id
    ` as unknown as Promise<{ user_id: string; primero: string | Date }[]>,
    sql`
      SELECT q.subject_name, q.selected_topics, c.id AS grupo_id, c.join_code, a.due_at
      FROM classroom_assignments a
      JOIN classrooms c ON c.id = a.classroom_id
      JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
      WHERE c.teacher_id = ${teacherId} AND c.status = 'open'
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT 1
    ` as unknown as Promise<{ subject_name: string; selected_topics: unknown; grupo_id: number; join_code: string; due_at: string | Date | null }[]>,
  ])

  const estado = estadoDelArranque(
    {
      materias: Number(materias[0]?.total ?? 0),
      tareasArmadas: Number(armadas[0]?.total ?? 0),
      tareasMandadas: Number(mandadas[0]?.total ?? 0),
      primerasPracticas: practicas.map((p) => p.primero),
    },
    ahora,
  )

  let ultimaTarea: UltimaTareaMandada | null = null
  const fila = ultima[0]
  // Sólo hace falta mientras se ve la lista con el paso 3 hecho (volver a mandarla).
  if (fila && estado.mostrar === 'lista') {
    const miembros = (await sql`
      SELECT m.display_name FROM classroom_members m
      WHERE m.classroom_id = ${fila.grupo_id} AND m.status = 'active' AND m.user_id <> ${teacherId}
    `) as { display_name: string }[]
    ultimaTarea = {
      materia: fila.subject_name,
      temas: temasDe(fila.selected_topics),
      codigo: fila.join_code,
      hasta: fila.due_at ? new Date(fila.due_at).toISOString() : null,
      alumnos: miembros.map((m) => ({ nombre: String(m.display_name ?? '') })),
    }
  }

  return { ...estado, ultimaTarea }
}

/** `teacher_quizzes.selected_topics` es JSONB de varias versiones: nombres sueltos u objetos con `name`. */
export function temasDe(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor
    .map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t !== null ? String((t as { name?: unknown }).name ?? '') : ''))
    .map((t) => t.trim())
    .filter(Boolean)
}
