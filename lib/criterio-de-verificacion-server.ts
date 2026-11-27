import { sql } from '@/lib/db'
import type { DocenteParaElCriterio } from '@/lib/criterio-de-verificacion'

/**
 * AA2 · Los datos del criterio de verificación, de las tablas que ya existen.
 * Sin migración: las columnas de la 026 (plan) y de la 044 (origen) se leen
 * con `to_jsonb(users) ->> …`, así una base sin ellas da "sin dato" en vez de
 * romper. Los grupos y los alumnos de ejemplo (V2) no cuentan.
 */
export async function docentesParaElCriterio(): Promise<DocenteParaElCriterio[]> {
  const filas = (await sql`
    WITH docentes AS (
      SELECT id, created_at, to_jsonb(users) AS j
      FROM users
      WHERE role = 'DOCENTE' AND COALESCE(is_guest, false) = false AND COALESCE((to_jsonb(users) ->> 'ejemplo')::boolean, false) = false
    ),
    primeras AS (
      SELECT c.teacher_id, att.user_id, MIN(att.completed_at) AS primero
      FROM quiz_attempts att
      JOIN classroom_assignments a ON a.id = att.assignment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE att.user_id <> c.teacher_id AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      GROUP BY c.teacher_id, att.user_id
    ),
    alumnos AS (
      SELECT c.teacher_id, COUNT(DISTINCT m.user_id)::int AS total
      FROM classroom_members m
      JOIN classrooms c ON c.id = m.classroom_id
      WHERE c.status = 'open' AND m.status = 'active' AND m.user_id <> c.teacher_id
        AND COALESCE((to_jsonb(c) ->> 'ejemplo')::boolean, false) = false
      GROUP BY c.teacher_id
    )
    SELECT d.id, d.created_at AS registro,
      d.j ->> 'origen' AS origen,
      d.j ->> 'origen_ref' AS origen_ref,
      d.j ->> 'plan_nivel' AS plan_nivel,
      d.j ->> 'plan_vence_el' AS plan_vence_el,
      EXISTS (
        SELECT 1 FROM teacher_programs p
        WHERE p.user_id = d.id
          AND COALESCE((to_jsonb(p) ->> 'personal')::boolean, false) = false
          AND COALESCE((to_jsonb(p) ->> 'ejemplo')::boolean, false) = false
      ) AS tiene_materia,
      COALESCE((SELECT array_agg(x.primero) FROM primeras x WHERE x.teacher_id = d.id), '{}') AS primeras,
      COALESCE((SELECT total FROM alumnos y WHERE y.teacher_id = d.id), 0) AS alumnos
    FROM docentes d
  `) as {
    registro: string | Date | null
    origen: string | null
    origen_ref: string | null
    plan_nivel: string | null
    plan_vence_el: string | null
    tiene_materia: boolean
    primeras: (string | Date)[] | null
    alumnos: number
  }[]

  const ahora = Date.now()
  return filas.map((f) => {
    const nivel = Number(f.plan_nivel)
    const vence = f.plan_vence_el ? new Date(f.plan_vence_el).getTime() : NaN
    return {
      origen: f.origen,
      origenRef: f.origen_ref,
      registro: f.registro,
      tieneMateria: f.tiene_materia === true,
      primerasPracticas: Array.isArray(f.primeras) ? f.primeras : [],
      alumnos: Number(f.alumnos) || 0,
      pagando: Number.isInteger(nivel) && nivel >= 1 && Number.isFinite(vence) && vence > ahora,
    }
  })
}
