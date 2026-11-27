/**
 * Tanda AC · AC1 — La modalidad del docente: cómo da clases.
 *
 *   'particular'  Doy clases particulares. Todos sus alumnos nuevos, también
 *                 los que entran por el link de un grupo, cuentan como
 *                 particulares: en el plan gratis, 2.
 *   'curso'       Doy clases en un curso. La regla B1 de siempre: gratis con
 *                 2 particulares + 1 curso de hasta 35.
 *   null          Sin dato (todos los docentes de antes de la 050): B1, igual
 *                 que 'curso'. No cambia nada para los que ya estaban.
 *
 * La modalidad decide quién ENTRA nuevo (por el link o con «+ Alumno»); no
 * cambia el estado del plan. Un docente particular que ya tiene más de 2 los
 * conserva y sólo se frena el siguiente.
 *
 * Puro (sin base ni request); la lectura y la escritura están en
 * lib/modalidad-server.ts. Lo de localStorage es para el camino de la entrada,
 * antes de que exista la cuenta, igual que lib/rol-elegido.ts.
 */

export const MODALIDADES = ['particular', 'curso'] as const
export type Modalidad = (typeof MODALIDADES)[number]

export function esModalidad(valor: unknown): valor is Modalidad {
  return typeof valor === 'string' && (MODALIDADES as readonly string[]).includes(valor)
}

/** Un valor que vino de la base o de la URL: la modalidad, o null si no sirve. */
export function normalizarModalidad(valor: unknown): Modalidad | null {
  const limpio = typeof valor === 'string' ? valor.trim().toLowerCase() : valor
  return esModalidad(limpio) ? limpio : null
}

/** Cómo entró el alumno: el docente lo sumó con su nombre (invitación) o entró solo con el código del grupo. */
export type IngresoDelAlumno = 'invitacion' | 'codigo'
export type TipoDeLugar = 'particular' | 'curso'

/**
 * Qué lugar ocupa un alumno según la modalidad del docente y cómo entró.
 * Con 'particular' siempre es particular; con 'curso' o sin dato, B1: el que
 * sumó el docente es particular y el que entró por el código, de curso.
 */
export function tipoDeLugar(modalidad: Modalidad | null, ingreso: IngresoDelAlumno): TipoDeLugar {
  if (modalidad === 'particular') return 'particular'
  return ingreso === 'invitacion' ? 'particular' : 'curso'
}

/** Si los alumnos que entran por el código de un grupo cuentan como curso (B1) o como particulares. */
export function usaCursos(modalidad: Modalidad | null): boolean {
  return tipoDeLugar(modalidad, 'codigo') === 'curso'
}

/**
 * ¿Entra un alumno NUEVO por el link de un docente particular en el gratis?
 * Cuenta a todos los que ya ocupan lugar contra el cupo gratis. Con más de 2
 * (los que ya tenía), no se saca a nadie: sólo se frena el siguiente.
 */
export function entraOtroParticular(alumnosActuales: number, cupoGratis: number): boolean {
  return alumnosActuales < cupoGratis
}

// ─── El camino de la entrada (antes de tener cuenta) ─────────────────────────

const CLAVE = 'maestria-modalidad-elegida'

export function guardarModalidadElegida(modalidad: Modalidad): void {
  try {
    localStorage.setItem(CLAVE, modalidad)
  } catch {
    // Sin almacenamiento, la bienvenida pregunta.
  }
}

export function leerModalidadElegida(): Modalidad | null {
  try {
    return normalizarModalidad(localStorage.getItem(CLAVE))
  } catch {
    return null
  }
}

export function olvidarModalidadElegida(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que olvidar.
  }
}
