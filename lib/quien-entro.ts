import { isAdminEmail } from '@/lib/ai-rate-limit'
import type { UserRole } from '@/lib/types'

/** Lo que el caparazón necesita saber de quién está mirando. */
export interface QuienEntro {
  nombre: string
  email: string | null
  rol: UserRole | null
  esInvitado: boolean
  /**
   * H4: si está en la lista de admin (`ADMIN_EMAILS`, la misma `isAdminEmail`
   * de /admin/planes y /admin/ai-usage). Sólo decide si el menú de la cuenta
   * muestra los links a esas pantallas; ellas se protegen solas (404 al resto).
   */
  esAdmin: boolean
}

/**
 * Del viewer del servidor al caparazón. Se resuelve en el servidor porque la
 * lista de admin es una variable de entorno que el navegador no ve.
 */
export function quienEntroDe(
  viewer: { displayName: string; email: string | null; role: UserRole | null; isGuest: boolean } | null,
): QuienEntro | null {
  if (!viewer) return null
  return {
    nombre: viewer.displayName,
    email: viewer.email,
    rol: viewer.role,
    esInvitado: viewer.isGuest,
    esAdmin: !viewer.isGuest && isAdminEmail(viewer.email),
  }
}
