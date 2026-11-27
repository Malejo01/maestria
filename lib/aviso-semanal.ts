/**
 * Tanda AC · AC5 — El aviso de los lunes: a las 9 de Argentina, cada docente
 * con al menos un alumno recibe en la campanita el resumen de «Esta semana»
 * (AB5, `textoParaCopiar`) con «Ver Esta semana».
 *
 * Puro: qué semana es (la clave del aviso, para que dos corridas del mismo
 * lunes dejen uno solo), quién recibe y qué dice. El cron está en
 * app/api/cron/aviso-semanal y la lectura en lib/aviso-semanal-server.ts.
 */
import { textoParaCopiar, type ResumenDeLaSemana } from '@/lib/esta-semana'

const MS_POR_DIA = 24 * 60 * 60 * 1000
const ARGENTINA = -3 * 60 * 60 * 1000

/** El lunes (en Argentina) de la semana de `ahora`, AAAA-MM-DD. Dos corridas del mismo lunes dan lo mismo. */
export function lunesDe(ahora: Date): string {
  const local = new Date(ahora.getTime() + ARGENTINA)
  const diasDesdeElLunes = (local.getUTCDay() + 6) % 7
  return new Date(local.getTime() - diasDesdeElLunes * MS_POR_DIA).toISOString().slice(0, 10)
}

export const claveDelAvisoSemanal = (ahora: Date) => `semana|${lunesDe(ahora)}`

/**
 * Docentes que no reciben el aviso: los de la materia de ejemplo (V2) y las
 * cuentas de prueba (las que crean los e2e y los recorridos: nombre «E2E ·…»
 * o ids `aa4-docente-…`, `o13-docente-…`, `e2e-…`).
 */
export function esDocenteDePrueba(d: { id: string; nombre?: string | null; ejemplo?: boolean | null }): boolean {
  if (d.ejemplo) return true
  if (/^(aa4-docente-|o13-docente-|e2e-)/.test(d.id)) return true
  return /^E2E\s*·/.test(d.nombre?.trim() ?? '')
}

/** Recibe aviso: un docente real con al menos un alumno. */
export function recibeElAviso(d: { id: string; nombre?: string | null; ejemplo?: boolean | null }, resumen: Pick<ResumenDeLaSemana, 'total'>): boolean {
  return !esDocenteDePrueba(d) && resumen.total > 0
}

export interface AvisoSemanal {
  clave: string
  titulo: string
  detalle: string
  href: string
}

/** El aviso: el título fijo, el resumen de AB5 tal cual y el link a «Esta semana». */
export function armarAvisoSemanal(resumen: ResumenDeLaSemana, ahora: Date, titulo: string): AvisoSemanal {
  return { clave: claveDelAvisoSemanal(ahora), titulo, detalle: textoParaCopiar(resumen, ahora), href: '/teacher' }
}
