/**
 * Tanda AB · AB4 — El arranque guiado del docente nuevo.
 *
 * El análisis Founder (docs/founder/summary.md) dice que el profe no compra en
 * frío: quiere ver a sus 2 alumnos practicar gratis. Esta lista lo lleva hasta
 * ahí en la primera semana, en tres pasos que se tildan solos:
 *
 *   1. Subí tu programa          → tiene una materia propia
 *   2. Revisá y aprobá tu primer cuestionario → tiene una tarea guardada
 *   3. Mandáselo a 2 alumnos     → mandó una tarea a un grupo
 *
 * Y termina (`completo`) cuando 2 alumnos distintos practicaron en sus grupos.
 * Como el onboarding de siempre (lib/onboarding-docente.ts), el progreso NO se
 * guarda: se deduce de los datos que ya existen, sin migración.
 *
 * Puro: los datos los trae lib/arranque-docente-server.ts.
 */

export const ALUMNOS_PARA_ARRANCAR = 2
/** Cuántos días se ve el «Listo» después de que practicó el segundo alumno. */
export const DIAS_DEL_LISTO = 7

const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface DatosDelArranque {
  /** Materias propias activas (ni de ejemplo ni personales). */
  materias: number
  /** Tareas guardadas (mandadas o no). */
  tareasArmadas: number
  /** Tareas mandadas a un grupo. */
  tareasMandadas: number
  /** El primer intento de cada alumno distinto en sus grupos (sin contarlo a él ni a los de ejemplo). */
  primerasPracticas: readonly (string | Date)[]
}

/** 0 a 3: cuántos pasos seguidos están hechos. `completo`: ya practicaron 2. */
export type PasoDelArranque = 0 | 1 | 2 | 3 | 'completo'

export interface EstadoDelArranque {
  paso: PasoDelArranque
  hechos: { programa: boolean; aprobado: boolean; mandado: boolean }
  /** Alumnos distintos que practicaron. */
  practicaron: number
  /** Qué se dibuja: la lista, el «Listo» o nada. */
  mostrar: 'lista' | 'listo' | null
}

function aMs(valor: string | Date): number | null {
  const t = (valor instanceof Date ? valor : new Date(valor)).getTime()
  return Number.isFinite(t) ? t : null
}

export function estadoDelArranque(d: DatosDelArranque, ahora: Date): EstadoDelArranque {
  const practicas = d.primerasPracticas
    .map(aMs)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)
  const practicaron = practicas.length
  // Mandar una tarea es haberla aprobado: la tarea mandada ya pasó por la revisión.
  const hechos = {
    programa: d.materias > 0,
    aprobado: d.tareasArmadas > 0 || d.tareasMandadas > 0,
    mandado: d.tareasMandadas > 0,
  }

  if (practicaron >= ALUMNOS_PARA_ARRANCAR) {
    const completoEl = practicas[ALUMNOS_PARA_ARRANCAR - 1]
    const reciente = ahora.getTime() - completoEl < DIAS_DEL_LISTO * MS_POR_DIA
    return { paso: 'completo', hechos, practicaron, mostrar: reciente ? 'listo' : null }
  }

  const orden = [hechos.programa, hechos.aprobado, hechos.mandado]
  const primero = orden.indexOf(false)
  const paso = (primero === -1 ? 3 : primero) as 0 | 1 | 2 | 3
  return { paso, hechos, practicaron, mostrar: 'lista' }
}

/** El paso que toca ahora (1, 2 o 3), o null si ya están los tres. */
export function pasoActual(estado: EstadoDelArranque): 1 | 2 | 3 | null {
  if (estado.paso === 'completo' || estado.paso === 3) return null
  return (estado.paso + 1) as 1 | 2 | 3
}
