/**
 * P5 · Las propuestas de O13 (docs/informes/o13-primer-uso-docente.md) que son
 * reglas: puras y con tests.
 */

/**
 * Propuesta 1: con una sola materia, armar una tarea entra directo a ella. La
 * de la URL (`&materia=`) manda siempre; si ya hay una elegida, no se toca.
 */
export function materiaInicialParaArmar(e: {
  materiaDeLaUrl: number | null
  armando: boolean
  yaElegida: boolean
  materias: number[]
}): number | null {
  if (e.materiaDeLaUrl) return e.materiaDeLaUrl
  if (!e.armando || e.yaElegida) return null
  return e.materias.length === 1 ? e.materias[0] : null
}

/**
 * Propuesta 2: "+ Alumno" en la barra recién con una materia. `materias` null =
 * todavía no se sabe (otra pantalla, o no cargó): se muestra como siempre.
 */
export function accionDeLaBarraDocente(materias: number | null): 'agregarAlumno' | 'crearMateria' {
  return materias === 0 ? 'crearMateria' : 'agregarAlumno'
}
