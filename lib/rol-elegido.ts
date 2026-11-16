/**
 * El rol que la persona eligió en la pantalla de entrada, guardado mientras va
 * y vuelve de Google.
 *
 * La entrada pregunta "¿docente o alumno?" ANTES de pedir el método de ingreso.
 * Entre ese click y el momento en que existe una sesión hay una redirección a
 * Google de por medio, así que la elección tiene que sobrevivir a salir del
 * sitio. Al volver, components/entrada/bienvenida.tsx la lee y no vuelve a
 * preguntar lo que la persona ya contestó.
 *
 * Vive en localStorage y no en el `callbackUrl` porque el proxy puede reescribir
 * ese destino, y porque quien llega por un link de grupo también tiene que
 * quedar marcado como alumno sin pasar por la entrada.
 */
import type { UserRole } from '@/lib/types'

export type RolElegido = 'docente' | 'alumno'

const CLAVE = 'maestria-rol-elegido'

export function esRolElegido(valor: unknown): valor is RolElegido {
  return valor === 'docente' || valor === 'alumno'
}

export function aUserRole(rol: RolElegido): UserRole {
  return rol === 'docente' ? 'DOCENTE' : 'ALUMNO'
}

export function guardarRolElegido(rol: RolElegido): void {
  try {
    localStorage.setItem(CLAVE, rol)
  } catch {
    // Sin almacenamiento, la pantalla de bienvenida pregunta el rol de nuevo.
  }
}

export function leerRolElegido(): RolElegido | null {
  try {
    const valor = localStorage.getItem(CLAVE)
    return esRolElegido(valor) ? valor : null
  } catch {
    return null
  }
}

export function olvidarRolElegido(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que limpiar.
  }
}
