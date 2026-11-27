/**
 * Tanda AB · AB6 — La evidencia del muro del 3.er alumno.
 *
 * El docente en el plan gratis quiere sumar un tercer alumno. Antes de la
 * oferta, lo que ya pasó con sus 2: «Tus 2 alumnos hicieron 46 ejercicios en
 * 9 días. El tema más flojo: funciones.» Si todavía no practicaron, un texto
 * honesto que no empuja a pagar: «Todavía no practicaron: probá primero con
 * tus 2 alumnos.» Puro; los datos los trae lib/evidencia-del-muro-server.ts.
 */

export interface Evidencia {
  /** Alumnos distintos que practicaron en sus grupos. */
  alumnos: number
  /** Ejercicios respondidos por ellos. */
  ejercicios: number
  /** La primera práctica (ISO), o null. */
  desde: string | null
  /** El tema en el que peor les va a todos juntos (con el criterio de la ficha), o null. */
  temaMasFlojo: string | null
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Desde la primera práctica hasta hoy, contando los dos días (al menos 1). */
export function diasDeEvidencia(desde: string | null, ahora: Date): number | null {
  if (!desde) return null
  const t = new Date(desde).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(1, Math.ceil((ahora.getTime() - t) / MS_POR_DIA))
}

const temaEnFrase = (tema: string) => (tema.split(/[:.(]/)[0].trim() || tema.trim()).toLowerCase()

/** Hay evidencia si alguien practicó al menos un ejercicio. */
export function hayEvidencia(e: Evidencia | null | undefined): e is Evidencia {
  return Boolean(e && e.alumnos > 0 && e.ejercicios > 0)
}

export function fraseDeEvidencia(e: Evidencia | null | undefined, ahora: Date, cupoGratis: number): string {
  if (!hayEvidencia(e)) return `Todavía no practicaron: probá primero con tus ${cupoGratis} alumnos.`
  const dias = diasDeEvidencia(e.desde, ahora)
  const quienes = e.alumnos === 1 ? 'Tu alumno hizo' : `Tus ${e.alumnos} alumnos hicieron`
  const cuantos = `${e.ejercicios} ${e.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}`
  const cuando = dias === null ? '' : ` en ${dias} ${dias === 1 ? 'día' : 'días'}`
  const tema = e.temaMasFlojo ? ` El tema más flojo: ${temaEnFrase(e.temaMasFlojo)}.` : ''
  return `${quienes} ${cuantos}${cuando}.${tema}`
}
