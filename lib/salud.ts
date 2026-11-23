/**
 * Ronda Y · Y1 — La salud del sistema (puro): tasas de las generaciones y las
 * alertas para la campanita del admin.
 *
 *   - Más del 10 % de las generaciones de la última hora fallaron (con al
 *     menos 5: una sola fallida de una no es un incendio).
 *   - Un pago para revisar: Mercado Pago cobró un monto distinto del pedido, o
 *     el pago quedó pendiente con un pago de Mercado Pago ya asociado.
 */
export const UMBRAL_DE_FALLAS = 0.1
export const MINIMO_PARA_ALERTAR = 5
/** Una generación "pendiente" hace más de esto se cuenta como fallida (se colgó). */
export const MINUTOS_COLGADA = 10

export interface CuentaDeGeneraciones {
  total: number
  fallidas: number
  /** null sin la 049. */
  crudas: number | null
  descartadas: number | null
}

/** Una proporción, o null si no hay sobre qué calcularla. */
export function tasa(parte: number | null, total: number | null): number | null {
  if (parte === null || total === null || !Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return null
  return parte / total
}

export function resumenDeGeneraciones(g: CuentaDeGeneraciones): { tasaDeFallas: number | null; tasaDeDescarte: number | null } {
  return { tasaDeFallas: tasa(g.fallidas, g.total), tasaDeDescarte: tasa(g.descartadas, g.crudas) }
}

export function fallanDemasiado(g: CuentaDeGeneraciones): boolean {
  const t = tasa(g.fallidas, g.total)
  return g.total >= MINIMO_PARA_ALERTAR && t !== null && t > UMBRAL_DE_FALLAS
}

export interface PagoARevisar {
  id: number
  docente: string
  monto: number
  motivo: 'montoDistinto' | 'pendienteEnMercadoPago'
  /** Desde cuándo está así (ISO). */
  desde: string
}

export interface AlertaDelSistema {
  clave: string
  tipo: 'generaciones' | 'pago'
  fecha: string
  pagoId?: number
  fallidas?: number
  total?: number
  docente?: string
  monto?: number
  motivo?: PagoARevisar['motivo']
}

/** La hora (UTC) truncada: la alerta de generaciones es una por hora. */
const horaDe = (ahora: Date) => `${ahora.toISOString().slice(0, 13)}:00:00.000Z`

export function alertasDelSistema(e: { ultimaHora: CuentaDeGeneraciones; pagos: readonly PagoARevisar[]; ahora: Date }): AlertaDelSistema[] {
  const alertas: AlertaDelSistema[] = []
  if (fallanDemasiado(e.ultimaHora)) {
    const hora = horaDe(e.ahora)
    alertas.push({ clave: `alerta-generaciones|${hora}`, tipo: 'generaciones', fecha: hora, fallidas: e.ultimaHora.fallidas, total: e.ultimaHora.total })
  }
  for (const p of e.pagos) {
    alertas.push({ clave: `alerta-pago|${p.id}`, tipo: 'pago', fecha: p.desde, pagoId: p.id, docente: p.docente, monto: p.monto, motivo: p.motivo })
  }
  return alertas
}

/** "12,5 %" — para mostrar una tasa. */
export function porcentaje(t: number | null): string | null {
  if (t === null) return null
  return `${(Math.round(t * 1000) / 10).toLocaleString('es-AR')} %`
}
