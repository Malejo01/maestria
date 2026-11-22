/**
 * O8 · Pulgar arriba / abajo del docente en cada pregunta (FASE 3, loop de
 * calidad). Puro: los motivos, validar lo que llega, y la sección "Evitá esto"
 * del prompt con su regla de recorte.
 */
import { VALORACIONES as T } from '@/lib/textos'

export const MOTIVOS = ['fuera_del_programa', 'mal_redactada', 'respuesta_incorrecta', 'muy_facil', 'muy_dificil', 'tipo_equivocado'] as const
export type Motivo = (typeof MOTIVOS)[number]

export const esMotivo = (v: unknown): v is Motivo => MOTIVOS.includes(v as Motivo)

export interface Valoracion {
  indice: number
  valor: 1 | -1
  motivo: Motivo | null
}

/** Lo que llega al PUT: índice entero, valor 1/-1, y motivo sólo (y obligatorio) en el pulgar abajo. */
export function leerValoracion(cuerpo: unknown): Valoracion | null {
  const c = cuerpo as { indice?: unknown; valor?: unknown; motivo?: unknown } | null
  const indice = Number(c?.indice)
  if (!Number.isInteger(indice) || indice < 0 || indice > 500) return null
  if (c?.valor === 1) return { indice, valor: 1, motivo: null }
  if (c?.valor === -1 && esMotivo(c.motivo)) return { indice, valor: -1, motivo: c.motivo }
  return null
}

/** Un pulgar abajo, como entra al prompt. */
export interface PreguntaAEvitar {
  enunciado: string
  motivo: Motivo
}

/** Cuántos entran como máximo, y cuánto texto (el prompt ya es largo). */
export const MAX_A_EVITAR = 10
export const MAX_CARACTERES_A_EVITAR = 1800
export const MAX_CARACTERES_POR_ENUNCIADO = 220

/**
 * La sección "Evitá esto" del prompt. Regla de recorte, en orden:
 *   1. los más nuevos primero (llegan ordenados), hasta 10;
 *   2. cada enunciado, hasta 220 caracteres (con "…");
 *   3. se agregan renglones mientras el total no pase 1.800 caracteres: el que
 *      no entra entero, no entra (no se corta a la mitad).
 * Sin nada que evitar, cadena vacía.
 */
export function seccionEvitar(aEvitar: readonly PreguntaAEvitar[]): string {
  const renglones: string[] = []
  let largo = 0
  for (const p of aEvitar.slice(0, MAX_A_EVITAR)) {
    const limpio = p.enunciado.replace(/\s+/g, ' ').trim()
    if (!limpio || !esMotivo(p.motivo)) continue
    const corto = limpio.length > MAX_CARACTERES_POR_ENUNCIADO ? `${limpio.slice(0, MAX_CARACTERES_POR_ENUNCIADO - 1)}…` : limpio
    const renglon = `- «${corto}» (${T.motivos[p.motivo].toLowerCase()})`
    if (largo + renglon.length + 1 > MAX_CARACTERES_A_EVITAR) break
    renglones.push(renglon)
    largo += renglon.length + 1
  }
  if (renglones.length === 0) return ''
  return `\n\nEVITÁ ESTO. El docente marcó estas preguntas de la materia como malas, con el motivo. No generes preguntas con los mismos problemas (no son temas prohibidos: son defectos a no repetir):\n${renglones.join('\n')}`
}
