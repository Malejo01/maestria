/**
 * N1 · Avisarle a quien reportó que su reporte se resolvió. Puro: quién ve
 * avisos, cómo se arma el texto y cómo se agrupan varios en uno solo.
 *
 * El dato sale de `feedback_reports` (migración 030: `resuelto_el`,
 * `aviso_visto_el`, `respuesta`, `respondido_por`); el servidor trae sólo los
 * reportes del propio viewer (lib/reportes-server.ts, `avisosPendientes`).
 */
import { AVISO_DE_REPORTE as T } from '@/lib/textos'

/** Un reporte resuelto cuyo aviso todavía no se vio. */
export interface AvisoPendiente {
  id: number
  /** Cuándo se reportó (ISO). */
  reportadoEl: string
  /** Título del cuestionario de la pregunta reportada, si se sabe. */
  cuestionario: string | null
  /** El mensaje del admin, si dejó uno. */
  respuesta: string | null
  /** El nombre de pila del admin que lo resolvió. */
  respondidoPor: string | null
}

export interface RenglonDeAviso {
  id: number
  texto: string
  mensaje: string | null
}

export interface AvisoArmado {
  /** Los ids que "Entendido" marca como vistos. */
  ids: number[]
  /** Con un solo reporte, el texto entero; con varios, el encabezado de la lista. */
  titulo: string
  renglones: RenglonDeAviso[]
}

/** "20/11", en hora de Argentina (un reporte de las 23:30 no pasa al día siguiente). */
export function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return ''
  // Por partes y con relleno a mano: el ICU de algunos entornos da "30/9" con '2-digit'.
  const partes = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).formatToParts(fecha)
  const parte = (tipo: string) => (partes.find((p) => p.type === tipo)?.value ?? '').padStart(2, '0')
  return `${parte('day')}/${parte('month')}`
}

/**
 * Quién ve avisos: cualquiera con sesión (cuenta o invitado), menos el admin.
 * Sus propios reportes son pruebas o notas para sí mismo: los 8 de Mauro no
 * le aparecen.
 */
export function veAvisos(viewer: { isGuest: boolean; esAdmin: boolean } | null): boolean {
  if (!viewer) return false
  return viewer.isGuest || !viewer.esAdmin
}

const limpio = (texto: string | null | undefined) => {
  const t = (texto ?? '').trim()
  return t ? t : null
}

function mensajeDe(a: AvisoPendiente): string | null {
  const texto = limpio(a.respuesta)
  if (!texto) return null
  return T.mensaje(limpio(a.respondidoPor), texto)
}

/**
 * Los pendientes, en un solo aviso. Uno: "Gracias por avisarnos. Lo que
 * reportaste el 20/11 sobre una pregunta de «…» ya está corregido." Varios:
 * el agradecimiento arriba y un renglón por reporte, del más viejo al más
 * nuevo. Sin pendientes, `null`.
 */
export function armarAviso(pendientes: AvisoPendiente[]): AvisoArmado | null {
  const vistos = new Set<number>()
  const unicos = pendientes
    .filter((a) => Number.isInteger(a.id) && a.id > 0 && !vistos.has(a.id) && (vistos.add(a.id), true))
    .sort((a, b) => a.reportadoEl.localeCompare(b.reportadoEl) || a.id - b.id)
  if (unicos.length === 0) return null

  if (unicos.length === 1) {
    const a = unicos[0]
    return {
      ids: [a.id],
      titulo: T.uno(fechaCorta(a.reportadoEl), limpio(a.cuestionario)),
      renglones: [{ id: a.id, texto: '', mensaje: mensajeDe(a) }],
    }
  }

  return {
    ids: unicos.map((a) => a.id),
    titulo: T.varios(unicos.length),
    renglones: unicos.map((a) => ({
      id: a.id,
      texto: T.renglon(fechaCorta(a.reportadoEl), limpio(a.cuestionario)),
      mensaje: mensajeDe(a),
    })),
  }
}

/** Los ids que llegan al POST de "Entendido": enteros positivos, sin repetir, hasta 50. */
export function idsDesdeElCuerpo(cuerpo: unknown): number[] {
  const crudos = (cuerpo as { ids?: unknown } | null)?.ids
  if (!Array.isArray(crudos)) return []
  const ids = new Set<number>()
  for (const valor of crudos) {
    const n = Number(valor)
    if (Number.isInteger(n) && n > 0) ids.add(n)
    if (ids.size >= 50) break
  }
  return [...ids]
}

/** El mensaje del admin al resolver: recortado, vacío → null, hasta 1000 caracteres. */
export function mensajeDelAdmin(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  return t ? t.slice(0, 1000) : null
}

/** "Mauro Lizarraga" → "Mauro". El aviso dice "Mauro te dejó un mensaje". */
export function nombreDePila(nombre: string | null | undefined): string | null {
  const primero = (nombre ?? '').trim().split(/\s+/)[0]
  return primero ? primero : null
}
