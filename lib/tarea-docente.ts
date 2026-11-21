import type { QuizConfig, TeacherQuiz } from '@/lib/types'

/**
 * Una tarea del docente tal como llega de /api/teacher/quizzes (filas de
 * `teacher_quizzes`), y cómo se la corre. Antes vivía en use-panel-docente; L1
 * la saca para que la ficha y el diálogo del diagnóstico abran una tarea igual
 * que *Mis tareas*.
 */
export function tareaDesdeFila(quiz: Record<string, unknown>): TeacherQuiz {
  const rawMode = quiz.mode
  const normalizedMode = rawMode === 'practico' ? 'practico' : rawMode === 'mixto' ? 'mixto' : 'teorico'

  return {
    id: Number(quiz.id),
    userId: String(quiz.user_id || ''),
    teacherProgramId: Number(quiz.teacher_program_id || 0),
    title: String(quiz.title || 'Cuestionario docente'),
    subjectName: String(quiz.subject_name || ''),
    mode: normalizedMode,
    status: quiz.status === 'pending_share' ? 'pending_share' : 'saved',
    selectedTopics: Array.isArray(quiz.selected_topics) ? (quiz.selected_topics as { id: string; name: string }[]) : [],
    questionCount: Number(quiz.question_count || 0),
    questions: Array.isArray(quiz.questions) ? (quiz.questions as TeacherQuiz['questions']) : [],
    pedagogyContext: quiz.pedagogy_context ? String(quiz.pedagogy_context) : undefined,
    createdAt: String(quiz.created_at || new Date().toISOString()),
    updatedAt: String(quiz.updated_at || new Date().toISOString()),
    // L1: sin la 027 la columna no existe y todo es tarea.
    tipo: quiz.tipo === 'diagnostico' ? 'diagnostico' : 'tarea',
  }
}

/**
 * La configuración con la que el docente corre una tarea, para probarla o
 * verla como alumno. Un diagnóstico se ve como lo rinde el alumno: sin
 * devolución hasta el final (J5). No lleva grupo ni asignación: nunca cuenta
 * como intento de un alumno.
 */
export function configDeTarea(quiz: TeacherQuiz): QuizConfig {
  return {
    subject: `teacher-${quiz.teacherProgramId}`,
    subjectName: quiz.subjectName,
    topics: quiz.selectedTopics,
    mode: quiz.mode,
    questionCount: quiz.questionCount,
    pedagogyContext: quiz.pedagogyContext,
    teacherQuizId: quiz.id,
    quizTitle: quiz.title,
    ...(quiz.tipo === 'diagnostico' ? { devolucion: 'al_final' as const } : {}),
  }
}

export type FiltroDeTipo = 'todas' | 'tarea' | 'diagnostico'

/** L1: el filtro *Tareas · Diagnósticos* de Mis tareas. */
export function filtrarPorTipo<T extends Pick<TeacherQuiz, 'tipo'>>(tareas: T[], filtro: FiltroDeTipo): T[] {
  if (filtro === 'todas') return tareas
  return tareas.filter((t) => (t.tipo ?? 'tarea') === filtro)
}

/**
 * A dónde vuelve la revisión de una tarea: sólo a una pantalla del docente.
 * Llega por la URL (`?volver=`), así que cualquiera la puede escribir.
 */
export function destinoDeVuelta(volver: string | null | undefined): string {
  if (!volver || !volver.startsWith('/teacher')) return '/teacher'
  if (/[\u0000-\u001f\u007f\\]/.test(volver)) return '/teacher'
  return volver
}

/** La ruta que revisa y edita una tarea, volviendo a donde se estaba. */
export function rutaDeRevision(quizId: number, volver: string): string {
  return `/teacher/tareas/${quizId}/revisar?volver=${encodeURIComponent(volver)}`
}
