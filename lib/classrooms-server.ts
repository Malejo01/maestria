import { sql } from '@/lib/db'
import { generateJoinCode } from '@/lib/classrooms'

/**
 * Join codes are short by design, so collisions are rare but not impossible.
 * Rather than catch the unique-violation at INSERT time (which would waste the
 * surrounding transaction), probe first and retry a handful of times.
 */
export async function createUniqueJoinCode(maxAttempts = 8): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateJoinCode()
    const rows = await sql`SELECT 1 FROM classrooms WHERE join_code = ${code} LIMIT 1`
    if (rows.length === 0) return code
  }

  throw new Error('No se pudo generar un código de aula único')
}

export interface OwnedClassroomRow {
  id: number
  teacher_id: string
  teacher_program_id: number
  name: string
  join_code: string
  status: 'open' | 'closed'
  created_at: string
  subject_name: string
  nivel: string | null
  grado: string | null
  icon_name: string
  color_name: string
}

/**
 * Loads an aula only if it belongs to this teacher. Every teacher route calls
 * this before touching anything, so ownership is enforced in one place instead
 * of being re-derived (and eventually forgotten) per handler.
 */
export async function getOwnedClassroom(
  classroomId: number,
  teacherId: string
): Promise<OwnedClassroomRow | null> {
  const rows = (await sql`
    SELECT c.id, c.teacher_id, c.teacher_program_id, c.name, c.join_code, c.status, c.created_at,
           p.subject_name, p.nivel, p.grado, p.icon_name, p.color_name
    FROM classrooms c
    JOIN teacher_programs p ON p.id = c.teacher_program_id
    WHERE c.id = ${classroomId} AND c.teacher_id = ${teacherId}
    LIMIT 1
  `) as OwnedClassroomRow[]

  return rows[0] ?? null
}

/** Active roster plus the aggregate the teacher's table shows per student. */
export async function getClassroomMembers(classroomId: number) {
  return (await sql`
    SELECT m.id,
           m.user_id,
           m.display_name,
           m.is_verified,
           m.joined_at,
           COUNT(a.id)::int   AS attempt_count,
           AVG(a.score)       AS average_score,
           MAX(a.completed_at) AS last_attempt_at
    FROM classroom_members m
    LEFT JOIN quiz_attempts a
      ON a.user_id = m.user_id AND a.classroom_id = m.classroom_id
    WHERE m.classroom_id = ${classroomId} AND m.status = 'active'
    GROUP BY m.id, m.user_id, m.display_name, m.is_verified, m.joined_at
    ORDER BY m.display_name
  `) as Record<string, any>[]
}

/**
 * Las asignaciones de un grupo, para el docente: todas, también las que son
 * sólo para un alumno (L0), que vienen marcadas con su destinatario.
 */
export async function getClassroomAssignments(classroomId: number) {
  return (await sql`
    SELECT a.id,
           a.teacher_quiz_id,
           a.opens_at,
           a.due_at,
           a.max_attempts,
           a.created_at,
           q.title,
           q.mode,
           q.question_count,
           to_jsonb(a) ->> 'solo_user_id'       AS solo_user_id,
           to_jsonb(a) ->> 'solo_invitacion_id' AS solo_invitacion_id,
           COUNT(DISTINCT att.user_id)::int AS students_started,
           COUNT(att.id)::int              AS attempt_count
    FROM classroom_assignments a
    JOIN teacher_quizzes q ON q.id = a.teacher_quiz_id
    LEFT JOIN quiz_attempts att ON att.assignment_id = a.id
    WHERE a.classroom_id = ${classroomId}
    GROUP BY a.id, q.title, q.mode, q.question_count
    ORDER BY a.created_at DESC
  `) as Record<string, any>[]
}

/**
 * Parses a client-supplied ISO timestamp. Returns undefined when the field was
 * absent (leave as-is) and null when it was explicitly cleared.
 */
export function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function parseOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}
