/**
 * El onboarding del docente: cuatro hitos, y no termina hasta que hay un
 * alumno con una tarea asignada.
 *
 *   Tu materia → Tu temario → Tu primer alumno → Tu primera tarea
 *
 * El progreso NO se guarda: se deduce de los datos que el docente ya creó
 * (materias, temas, miembros de sus grupos, tareas mandadas). Es una decisión,
 * no un atajo:
 *
 *  - Un campo de progreso es una columna que describe un final, y este repo ya
 *    pagó tres veces por columnas así que nadie escribe (docs/roadmap.md,
 *    "El esquema modela el ciclo completo; el código implementa sólo la mitad").
 *    Un hito deducido no se puede desincronizar de la realidad: si el docente
 *    borra su única materia, el hito se desmarca solo.
 *  - "Si abandona a mitad y vuelve mañana, retoma donde estaba" sale gratis:
 *    los datos siguen ahí, en cualquier dispositivo.
 *  - No necesita migración.
 *
 * Este módulo es la regla, pura y testeada. Los datos los trae
 * lib/onboarding-docente-server.ts.
 */

export const HITOS = ['materia', 'temario', 'alumno', 'tarea'] as const
export type Hito = (typeof HITOS)[number]

/** Lo que hay que saber del docente para deducir en qué hito está. */
export interface DatosOnboarding {
  /** Materias activas. */
  materias: number
  /** Temas sumados en todas sus materias: una materia sin temas todavía no tiene temario. */
  temas: number
  /** Personas activas en sus grupos, sin contarlo a él. */
  alumnos: number
  /** Tareas armadas y guardadas, mandadas o no. */
  tareasArmadas: number
  /** Tareas mandadas a algún grupo. */
  tareasMandadas: number
}

export interface EstadoOnboarding {
  hechos: Record<Hito, boolean>
  /** Cuántos de los cuatro están hechos. */
  cantidadHechos: number
  /** El primer hito sin hacer, o null si están los cuatro. */
  siguiente: Hito | null
  completo: boolean
  /**
   * Dentro del último hito hay dos momentos: armar la tarea y mandarla. Vale
   * true cuando ya hay una armada y sólo falta mandarla.
   */
  faltaSoloMandar: boolean
  /**
   * El alumno todavía no entró, pero el docente no tiene por qué quedarse
   * esperando: puede ir armando la tarea mientras tanto.
   */
  puedeAdelantarLaTarea: boolean
}

export function calcularOnboarding(datos: DatosOnboarding): EstadoOnboarding {
  const hechos: Record<Hito, boolean> = {
    materia: datos.materias > 0,
    // Sin materia no hay temario, tenga los temas que tenga un dato huérfano.
    temario: datos.materias > 0 && datos.temas > 0,
    alumno: datos.alumnos > 0,
    tarea: datos.tareasMandadas > 0,
  }

  const siguiente = HITOS.find((hito) => !hechos[hito]) ?? null
  const cantidadHechos = HITOS.filter((hito) => hechos[hito]).length
  const tieneTemario = hechos.materia && hechos.temario

  return {
    hechos,
    cantidadHechos,
    siguiente,
    completo: siguiente === null,
    faltaSoloMandar: !hechos.tarea && datos.tareasArmadas > 0,
    puedeAdelantarLaTarea: siguiente === 'alumno' && tieneTemario && datos.tareasArmadas === 0,
  }
}

/** Cuenta los temas de un `teacher_programs.units` sin confiar en su forma: es JSONB escrito por varias versiones. */
export function contarTemas(units: unknown): number {
  if (!Array.isArray(units)) return 0
  return units.reduce<number>((total, unidad) => {
    const temas = (unidad as { topics?: unknown } | null)?.topics
    return total + (Array.isArray(temas) ? temas.length : 0)
  }, 0)
}
