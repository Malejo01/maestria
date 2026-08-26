import type { ReinforceTopic, SubjectModeTotals } from '@/lib/types'

/**
 * Los números de las tarjetas de resumen de /history.
 *
 * Vive acá y no dentro del componente porque es la aritmética que decide qué
 * cree un alumno sobre cómo le está yendo, y equivocarla no rompe nada visible:
 * sale un número plausible y distinto. Eso es exactamente lo que no se puede
 * verificar mirando la pantalla.
 *
 * ─── Por qué el promedio es SUM/SUM y no el promedio de las notas ───────────
 *
 * Desde la migración 021 cada intento se puntúa sobre las respuestas que se
 * **pudieron corregir** (`total = correctas + incorrectas + sin_calificar`, y
 * las sin calificar quedan fuera del numerador y del denominador). Así que las
 * notas de dos intentos pueden ser fracciones de denominador distinto, y
 * promediarlas le da el mismo peso a un 10 sobre 2 preguntas que a un 5 sobre
 * 20. `SUM(correctas) / SUM(calificadas)` pesa cada respuesta una vez, que es
 * lo que un promedio de rendimiento tiene que hacer.
 *
 * El `× 10` lo deja en la misma escala que `scoreOutOfTen` (lib/answer-grading),
 * que es la nota que el alumno ya vio al terminar cada cuestionario.
 */
export interface HistoryStats {
  /** Intentos que caen dentro de los filtros, sobre TODO el historial. */
  total: number
  /** Temas distintos pendientes de reforzar. */
  temasAReforzar: number
  /** 0-10, o `null` cuando no hay ni una respuesta calificada que promediar. */
  promedio: number | null
}

export function computeHistoryStats(
  totals: SubjectModeTotals[],
  reinforce: ReinforceTopic[],
  subjectFilter: string,
  modeFilter: string,
): HistoryStats {
  const rows = totals.filter(
    (t) =>
      (subjectFilter === 'all' || t.subject === subjectFilter) &&
      (modeFilter === 'all' || t.mode === modeFilter),
  )

  const sum = (pick: (t: SubjectModeTotals) => number) => rows.reduce((n, t) => n + pick(t), 0)
  const correct = sum((t) => t.correct)
  const graded = sum((t) => t.graded)

  // Los temas a reforzar no tienen eje de modo —una confusión conceptual no es
  // "teórica" o "práctica"—, así que sólo siguen al filtro de materia.
  //
  // La clave incluye la materia: `topic_id` se deriva del nombre del tema
  // (ver POST /api/user/tips), así que dos materias distintas pueden compartir
  // uno y contarlos como el mismo tema sería subestimar lo que falta.
  const temasAReforzar = new Set(
    reinforce
      .filter((r) => subjectFilter === 'all' || r.subject === subjectFilter)
      .map((r) => `${r.subject}::${r.topicId}`),
  ).size

  return {
    total: sum((t) => t.attempts),
    temasAReforzar,
    promedio: graded === 0 ? null : (correct / graded) * 10,
  }
}
