/**
 * Decisión 1 de la tanda P (confirmada por Mauro el 22/11, ronda T · A4): la
 * Revancha aparece SÓLO en la práctica libre y en el modo autodidacta. En todo
 * lo que tiene nota —tareas, diagnósticos (que son tareas), simulacros que
 * cuentan— no aparece: ahí queda sólo "Practicar otra vez" (P4), que no toca
 * la nota. Tampoco en una práctica extra de una tarea ni en la vista previa
 * del docente.
 *
 * Una sola regla para todas las pantallas: la de resultados (revancha de todo
 * el cuestionario y "Volver a intentar"), la del cuestionario (revancha de una
 * pregunta) y el modal de la explicación.
 */
export interface ContextoDeRevancha {
  assignmentId?: number | null
  practicaExtraId?: number | null
  practicaDeTarea?: number | null
  previewOnly?: boolean
  /** Autodidacta (bloque E): un simulacro que cuenta. */
  simulacroQueCuenta?: boolean
}

export function revanchaPermitida(contexto: ContextoDeRevancha | null | undefined): boolean {
  if (!contexto) return true
  if (contexto.previewOnly) return false
  if (contexto.assignmentId || contexto.practicaExtraId || contexto.practicaDeTarea) return false
  if (contexto.simulacroQueCuenta) return false
  return true
}
