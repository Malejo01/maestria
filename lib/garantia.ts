/**
 * Tanda AB · AB8 — La garantía de 14 días: «Si en 14 días ninguno de tus
 * alumnos practicó, te devuelvo el pago.» El reintegro lo hace Mauro a mano
 * desde Mercado Pago; esto sólo arma la lista de candidatos para /admin/planes.
 * Puro; los datos los trae lib/garantia-server.ts.
 */

export const DIAS_DE_GARANTIA = 14

const MS_POR_DIA = 24 * 60 * 60 * 1000

export interface PagoParaLaGarantia {
  pagoId: number
  docente: string
  email: string | null
  monto: number
  acreditadoEl: string
  /** El id del pago en Mercado Pago, para encontrarlo y devolverlo. */
  mpPaymentId: string | null
  /** Intentos de alumnos (no del docente) en sus grupos desde que se acreditó el pago. */
  practicasDesdeElPago: number
}

/** Pagó hace 14 días o menos y ningún alumno practicó desde entonces. */
export function esCandidatoALaGarantia(pago: Pick<PagoParaLaGarantia, 'acreditadoEl' | 'practicasDesdeElPago'>, ahora: Date): boolean {
  const t = new Date(pago.acreditadoEl).getTime()
  if (!Number.isFinite(t) || t > ahora.getTime()) return false
  return ahora.getTime() - t <= DIAS_DE_GARANTIA * MS_POR_DIA && pago.practicasDesdeElPago === 0
}

/** Los días que le quedan a la garantía de ese pago (0 el último día). */
export function diasQueQuedan(acreditadoEl: string, ahora: Date): number {
  const pasaron = Math.floor((ahora.getTime() - new Date(acreditadoEl).getTime()) / MS_POR_DIA)
  return Math.max(0, DIAS_DE_GARANTIA - pasaron)
}
