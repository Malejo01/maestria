import { sql } from '@/lib/db'
import { ordenarEmbudo, ubicarEnElEmbudo, type DocenteEnElEmbudo } from '@/lib/embudo'

/**
 * O12 · Las fechas de cada paso del embudo, por docente, de las tablas que ya
 * existen. Un docente es quien tiene `role = 'DOCENTE'` (no invitados).
 *   materia      → su primer `teacher_programs`
 *   grupo        → su primer `classrooms`
 *   tarea        → la primera `classroom_assignments` de sus grupos
 *   primerAlumno → el primer intento de OTRO usuario en una tarea suya
 *   cincoAlumnos → cuando el quinto alumno distinto hizo su primer intento ahí
 */
const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null)

export async function embudoDeDocentes(ahora = new Date()): Promise<DocenteEnElEmbudo[]> {
  const filas = (await sql`
    WITH docentes AS (
      SELECT id, name, email, created_at FROM users WHERE role = 'DOCENTE' AND COALESCE(is_guest, false) = false
    ),
    intentos AS (
      SELECT c.teacher_id, att.user_id, MIN(att.completed_at) AS primero
      FROM quiz_attempts att
      JOIN classroom_assignments a ON a.id = att.assignment_id
      JOIN classrooms c ON c.id = a.classroom_id
      WHERE att.user_id <> c.teacher_id
      GROUP BY c.teacher_id, att.user_id
    ),
    numerados AS (
      SELECT teacher_id, primero, ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY primero) AS n FROM intentos
    )
    SELECT d.id, d.name, d.email, d.created_at AS registro,
      (SELECT MIN(p.created_at) FROM teacher_programs p WHERE p.user_id = d.id AND COALESCE((to_jsonb(p) ->> 'personal')::boolean, false) = false) AS materia,
      (SELECT MIN(c.created_at) FROM classrooms c WHERE c.teacher_id = d.id) AS grupo,
      (SELECT MIN(a.created_at) FROM classroom_assignments a JOIN classrooms c ON c.id = a.classroom_id WHERE c.teacher_id = d.id) AS tarea,
      (SELECT primero FROM numerados x WHERE x.teacher_id = d.id AND x.n = 1) AS primer_alumno,
      (SELECT primero FROM numerados x WHERE x.teacher_id = d.id AND x.n = 5) AS cinco_alumnos
    FROM docentes d
  `) as {
    id: string
    name: string | null
    email: string | null
    registro: string | Date | null
    materia: string | Date | null
    grupo: string | Date | null
    tarea: string | Date | null
    primer_alumno: string | Date | null
    cinco_alumnos: string | Date | null
  }[]

  return ordenarEmbudo(
    filas.map((f) =>
      ubicarEnElEmbudo(
        {
          id: f.id,
          nombre: f.name,
          email: f.email,
          fechas: {
            registro: iso(f.registro),
            materia: iso(f.materia),
            grupo: iso(f.grupo),
            tarea: iso(f.tarea),
            primerAlumno: iso(f.primer_alumno),
            cincoAlumnos: iso(f.cinco_alumnos),
          },
        },
        ahora,
      ),
    ),
  )
}
