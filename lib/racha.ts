/**
 * O4 · La racha del alumno: cuántos cuestionarios aprobó seguidos.
 *
 * La regla no cambia (era `updateStreak` del store): aprobar suma uno, no
 * aprobar la vuelve a cero. Lo que cambia es dónde vive: en la base
 * (`rachas_alumno`, migración 032), no en el localStorage del navegador.
 */
import { RACHA as T } from '@/lib/textos'

export function siguienteRacha(actual: number, aprobo: boolean): number {
  const base = Number.isInteger(actual) && actual > 0 ? actual : 0
  return aprobo ? base + 1 : 0
}

/** El tope de lo que se acepta del navegador al migrar (un número absurdo no es una racha). */
export const RACHA_MAXIMA_DESDE_EL_NAVEGADOR = 500

/** La racha que el navegador tenía guardada, validada. */
export function rachaDelNavegador(valor: unknown): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? Math.min(n, RACHA_MAXIMA_DESDE_EL_NAVEGADOR) : 0
}

/** Lo que dice la tarjeta de la racha en los resultados. */
export function textoDeRacha(racha: number): string {
  if (racha <= 0) return T.sinRacha
  return T.conRacha(racha)
}
