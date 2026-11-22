import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'
import type { Question, TeacherQuiz } from '@/lib/types'

/**
 * N2 · Guardar las preguntas corregidas de un cuestionario desde *Mis tareas*.
 *
 * Es el mismo PATCH de *Revisar y editar*, con la misma regla: si el
 * cuestionario ya tiene intentos, el servidor responde 409 y se guarda como
 * COPIA (las asignaciones pasan a la copia; los intentos viejos y sus
 * respuestas quedan con el original, intactos). Acá la copia es automática
 * porque el docente ya vio y eligió cada cambio en el diálogo de antes →
 * después: no hay una segunda decisión que tomar.
 */
export type ResultadoDeGuardado =
  | { ok: true; quiz: TeacherQuiz; copiado: boolean; reasignadas: number }
  | { ok: false; bloqueo: CuerpoDeBloqueo }
  | { ok: false; error: string }

async function patch(quizId: number, questions: Question[], strategy: 'in_place' | 'copy') {
  const res = await fetch(`/api/teacher/quizzes/${quizId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, strategy }),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { res, data }
}

export async function guardarPreguntas(quiz: TeacherQuiz, questions: Question[]): Promise<ResultadoDeGuardado> {
  try {
    let { res, data } = await patch(quiz.id, questions, 'in_place')
    if (res.status === 409 && data?.requiresDecision) ({ res, data } = await patch(quiz.id, questions, 'copy'))

    const bloqueo = res.status === 402 ? leerBloqueo(data) : null
    if (bloqueo) return { ok: false, bloqueo }
    if (!res.ok || !data?.quiz) return { ok: false, error: typeof data?.error === 'string' ? data.error : `HTTP ${res.status}` }

    const guardado = data.quiz as Record<string, unknown>
    const delServidor = (guardado.questions as Question[]) ?? questions
    return {
      ok: true,
      quiz: { ...quiz, id: Number(guardado.id), questionCount: Number(guardado.question_count ?? delServidor.length), questions: delServidor },
      copiado: Boolean(data.copiado),
      reasignadas: Number(data.reasignadas ?? 0),
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error de red' }
  }
}
