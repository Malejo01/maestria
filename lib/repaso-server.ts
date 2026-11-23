import { sql } from '@/lib/db'
import { elegirParaRepasar, practicoHace, VENTANA_DIAS_REPASO, type FilaGuardada } from '@/lib/repaso'
import type { Question } from '@/lib/types'

/**
 * Ronda X · X2 — Lo guardado del alumno para el repaso espaciado.
 *
 * No entra lo de una tarea que todavía se puede hacer: repasar sus preguntas
 * sería ver las respuestas antes de rendirla. De una tarea, sólo lo de las que
 * ya vencieron (las sin fecha de cierre quedan afuera: decisión conservadora).
 */
async function filasDelAlumno(userId: string): Promise<FilaGuardada[]> {
  const filas = (await sql`
    SELECT a.question_id, a.question_text, a.question_type, a.options, a.correct_answer, a.answer_payload, a.is_correct,
           a.explanation, a.topic_name, COALESCE(t.completed_at, a.created_at) AS el, t.subject AS materia
    FROM quiz_answers a
    JOIN quiz_attempts t ON t.id = a.quiz_attempt_id
    LEFT JOIN classroom_assignments asg ON asg.id = t.assignment_id
    WHERE t.user_id = ${userId}
      AND a.created_at > NOW() - make_interval(days => ${VENTANA_DIAS_REPASO})
      AND (t.assignment_id IS NULL OR (asg.due_at IS NOT NULL AND asg.due_at < NOW()))
    ORDER BY a.created_at DESC
    LIMIT 3000
  `) as (Omit<FilaGuardada, 'el'> & { el: string | Date })[]
  return filas.map((f) => ({ ...f, el: new Date(f.el).toISOString(), materia: String(f.materia ?? '') }))
}

/** Lo que toca repasar hoy (de todo, o de una materia del autodidacta). */
export async function paraRepasarHoy(userId: string, materia?: string, ahora = new Date()): Promise<Question[]> {
  return elegirParaRepasar(await filasDelAlumno(userId), ahora, { materia })
}

/** Para la campanita: cuántas tocan hoy, y si practicó en la última semana. */
export async function repasoParaAvisar(userId: string, ahora = new Date()): Promise<{ cuantas: number; practicoEnLaSemana: boolean }> {
  const filas = await filasDelAlumno(userId)
  return { cuantas: elegirParaRepasar(filas, ahora).length, practicoEnLaSemana: practicoHace(filas, ahora) }
}
