/**
 * M6 · El buzón de reportes (`feedback_reports`, migración 019), del lado que
 * lo lee. Puro: estados, cómo se nombra cada uno, y de dónde vino el reporte.
 */

export const ESTADOS_DE_REPORTE = ['nuevo', 'visto', 'resuelto'] as const
export type EstadoDeReporte = (typeof ESTADOS_DE_REPORTE)[number]

/**
 * Lo guardado, a uno de los tres estados. La 019 había previsto 'revisado' y
 * 'descartado' (nadie los escribió nunca); se leen como visto y resuelto.
 */
export function estadoDeReporte(guardado: unknown): EstadoDeReporte {
  if (guardado === 'visto' || guardado === 'revisado') return 'visto'
  if (guardado === 'resuelto' || guardado === 'descartado') return 'resuelto'
  return 'nuevo'
}

/** Lo que se escribe sin la 029, cuyo CHECK todavía no admite 'visto' ni 'resuelto'. */
export const ESTADO_SIN_LA_029: Record<EstadoDeReporte, string> = {
  nuevo: 'nuevo',
  visto: 'revisado',
  resuelto: 'descartado',
}

/** Los valores guardados que corresponden a un estado (para filtrar). */
export function valoresDeEstado(estado: EstadoDeReporte): string[] {
  return estado === 'nuevo' ? ['nuevo'] : [estado, ESTADO_SIN_LA_029[estado]]
}

export function esEstadoDeReporte(valor: unknown): valor is EstadoDeReporte {
  return ESTADOS_DE_REPORTE.includes(valor as EstadoDeReporte)
}

/** El paso siguiente: nuevo → visto → resuelto (resuelto se queda). */
export function siguienteEstado(estado: EstadoDeReporte): EstadoDeReporte {
  return estado === 'nuevo' ? 'visto' : 'resuelto'
}

/** El contexto que manda el botón de reportar cuando hay un cuestionario abierto. */
export interface ContextoDeReporte {
  teacherQuizId: number | null
  assignmentId: number | null
  classroomId: number | null
  /** Base 0, como `currentIndex`. Se muestra como "pregunta N" (N = índice + 1). */
  questionIndex: number | null
}

const enteroPositivo = (valor: unknown) => {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Lo que llega del cliente, limpio: enteros válidos o `null`. */
export function contextoDesdeElCuerpo(cuerpo: Record<string, unknown> | null | undefined): ContextoDeReporte {
  const indice = Number(cuerpo?.questionIndex)
  return {
    teacherQuizId: enteroPositivo(cuerpo?.teacherQuizId),
    assignmentId: enteroPositivo(cuerpo?.assignmentId),
    classroomId: enteroPositivo(cuerpo?.classroomId),
    questionIndex: Number.isInteger(indice) && indice >= 0 && indice < 1000 ? indice : null,
  }
}

/** "pregunta 3": el índice guardado es base 0. */
export function numeroDePregunta(indice: number | null | undefined): number | null {
  return typeof indice === 'number' && indice >= 0 ? indice + 1 : null
}
