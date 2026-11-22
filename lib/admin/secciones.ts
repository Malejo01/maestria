import { ADMIN } from '@/lib/textos'

/**
 * P1 · Las secciones del panel de administrador, en el orden de la barra.
 *
 * Una sola lista para la barra lateral, las pestañas del celular, las tarjetas
 * de la portada y el test de permisos (que recorre cada `href` y espera un 404
 * para quien no está en ADMIN_EMAILS). Sumar una página de admin es sumarla acá.
 */
export type SeccionAdmin = 'inicio' | 'reportes' | 'embudo' | 'usoDeIA' | 'planes' | 'codigos' | 'docentes'

export interface EntradaAdmin {
  id: SeccionAdmin
  href: string
  texto: string
}

export const SECCIONES_ADMIN: readonly EntradaAdmin[] = [
  { id: 'inicio', href: '/admin', texto: ADMIN.secciones.inicio },
  { id: 'reportes', href: '/admin/reportes', texto: ADMIN.secciones.reportes },
  { id: 'embudo', href: '/admin/embudo', texto: ADMIN.secciones.embudo },
  { id: 'usoDeIA', href: '/admin/ai-usage', texto: ADMIN.secciones.usoDeIA },
  { id: 'planes', href: '/admin/planes', texto: ADMIN.secciones.planes },
  { id: 'codigos', href: '/admin/codigos', texto: ADMIN.secciones.codigos },
  { id: 'docentes', href: '/admin/docentes', texto: ADMIN.secciones.docentes },
]

/** Qué sección está abierta. `/admin/docentes/abc` sigue siendo Docentes. */
export function seccionActiva(pathname: string): SeccionAdmin | null {
  const limpio = pathname.replace(/\/+$/, '') || '/'
  if (limpio === '/admin') return 'inicio'
  const encontrada = SECCIONES_ADMIN.find((s) => s.id !== 'inicio' && (limpio === s.href || limpio.startsWith(`${s.href}/`)))
  return encontrada?.id ?? null
}
