/**
 * O9 · El informe del grupo para imprimir (FASE 4). Puro: arma las tres partes
 * a partir del informe que ya tiene la página del grupo, con el orden y el
 * filtro de la planilla aplicados (los de la URL, M4).
 */
import { ESTADO_INICIAL, type EstadoDePlanilla } from '@/lib/planilla-grupo'
import { INFORME_IMPRESO as T } from '@/lib/textos'

export interface TemaParaImprimir {
  topicName: string
  accuracy: number
  studentCount: number
}

export interface TareaParaImprimir {
  title: string
  submittedCount: number
  individual?: boolean
}

/** Qué orden y filtro se aplicaron, en palabras (va arriba de la planilla impresa). */
export function descripcionDelEstado(estado: EstadoDePlanilla): string | null {
  const partes: string[] = []
  if (estado.orden !== ESTADO_INICIAL.orden || estado.dir !== ESTADO_INICIAL.dir) {
    partes.push(T.ordenadaPor(T.columnas[estado.orden], estado.dir === 'asc' ? T.ascendente : T.descendente))
  }
  if (estado.filtro !== 'todos') partes.push(T.filtro[estado.filtro])
  if (estado.busqueda.trim()) partes.push(T.busqueda(estado.busqueda.trim()))
  return partes.length ? partes.join(' · ') : null
}

/** Los temas flojos del grupo: el porcentaje redondeado y cuántos alumnos. Del más flojo al menos. */
export function temasParaImprimir(temas: readonly TemaParaImprimir[]): string[][] {
  return [...temas]
    .sort((a, b) => a.accuracy - b.accuracy || a.topicName.localeCompare(b.topicName))
    .map((t) => [t.topicName, `${Math.round(t.accuracy * 100)} %`, String(t.studentCount)])
}

/** Las tareas del grupo (no las individuales), con cuántos las hicieron sobre cuántos alumnos. */
export function tareasParaImprimir(tareas: readonly TareaParaImprimir[], alumnos: number): string[][] {
  return tareas.filter((t) => !t.individual).map((t) => [t.title, T.hicieron(t.submittedCount, alumnos)])
}
