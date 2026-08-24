import { sql } from '@/lib/db'

/**
 * Qué se lleva puesto editar un cuestionario ya asignado.
 *
 * ─── Por qué esto hace falta ────────────────────────────────────────────────
 *
 * El alumno NO recibe una copia de las preguntas: `GET /api/student/assignments/[id]`
 * las trae con un JOIN en vivo contra `teacher_quizzes.questions`. No hay
 * snapshot. Editar un cuestionario asignado lo cambia debajo de los pies de
 * quien lo esté resolviendo, y dos alumnos pueden terminar rindiendo exámenes
 * distintos con la misma nota.
 *
 * Lo que SÍ está a salvo son los intentos ya cerrados: `quiz_answers` guarda
 * `question_text`, `options`, `correct_answer` y `answer_payload` por respuesta,
 * así que la historia no se corrompe. El problema es el futuro, no el pasado.
 */
export interface QuizAssignmentImpact {
  assignmentId: number
  classroomId: number
  classroomName: string
  /** Alumnos distintos que ya abrieron o entregaron este cuestionario. */
  studentsStarted: number
  attempts: number
}

export interface QuizImpact {
  assignments: QuizAssignmentImpact[]
  totalAttempts: number
  totalStudents: number
  /** true cuando editar en el lugar cambiaría algo que alguien ya rindió. */
  requiresDecision: boolean
}

export async function getQuizImpact(quizId: number): Promise<QuizImpact> {
  const rows = (await sql`
    SELECT a.id                                AS assignment_id,
           a.classroom_id,
           c.name                              AS classroom_name,
           COUNT(DISTINCT att.user_id)::int    AS students_started,
           COUNT(att.id)::int                  AS attempts
    FROM classroom_assignments a
    JOIN classrooms c ON c.id = a.classroom_id
    LEFT JOIN quiz_attempts att ON att.assignment_id = a.id
    WHERE a.teacher_quiz_id = ${quizId}
    GROUP BY a.id, a.classroom_id, c.name
    ORDER BY c.name
  `) as {
    assignment_id: number
    classroom_id: number
    classroom_name: string
    students_started: number
    attempts: number
  }[]

  const assignments = rows.map((r) => ({
    assignmentId: Number(r.assignment_id),
    classroomId: Number(r.classroom_id),
    classroomName: String(r.classroom_name),
    studentsStarted: Number(r.students_started),
    attempts: Number(r.attempts),
  }))

  const totalAttempts = assignments.reduce((n, a) => n + a.attempts, 0)
  const totalStudents = assignments.reduce((n, a) => n + a.studentsStarted, 0)

  return {
    assignments,
    totalAttempts,
    totalStudents,
    // Asignado pero sin intentos NO requiere decisión: no hay nada que
    // proteger todavía, y obligar a confirmar ahí enseñaría a confirmar sin
    // leer, que es como se pierde el aviso el día que importa.
    requiresDecision: totalAttempts > 0,
  }
}
