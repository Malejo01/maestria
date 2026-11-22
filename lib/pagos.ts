import { createHmac, timingSafeEqual } from 'node:crypto'
import { DIAS_MENSUAL, DIAS_PASE, normalizarNivel, precioMensual, precioPase, sumarDias, type NivelPlan } from './planes'
import { precioAula } from './precios'
import { precioConDescuento, type QueSePaga, type ResultadoDelCodigo } from './codigos-descuento'

/**
 * Ronda T · C2 — El cobro desde la app (puro).
 *
 * El monto lo calcula SIEMPRE el servidor con esto: la lista sale de las
 * variables de entorno (lib/planes.ts, lib/precios.ts) y el descuento del
 * código (C1). Nada del cuerpo de la request entra al monto.
 */
type Entorno = Record<string, string | undefined>

export type PlanAPagar = 'particular' | 'aula' | 'pase_alumno'
export type FormaAPagar = 'mensual' | 'pase'

export interface PedidoDePago {
  plan: PlanAPagar
  forma: FormaAPagar
  /** Particular: el nivel (1 a 5). Aula: los cursos. Pase de alumno: 1. */
  cantidad: number
  /** E2 · Pase de alumno: la materia personal a la que se le acredita. */
  materia?: number
}

export interface Cobro {
  pedido: PedidoDePago
  montoLista: number
  monto: number
  /** Cuántos días acredita. */
  dias: number
  /** Lo que se lee en Mercado Pago y en el resumen: "Plan Particular · 1 bloque · mes". */
  descripcion: string
}

const nombreDelPedido = (p: PedidoDePago) => {
  if (p.plan === 'aula') return `Plan Aula · ${p.cantidad === 1 ? '1 curso' : `${p.cantidad} cursos`}`
  if (p.plan === 'pase_alumno') return 'Pase por materia'
  return `Plan Particular · ${p.cantidad === 5 ? 'tope' : p.cantidad === 1 ? '1 bloque' : `${p.cantidad} bloques`}`
}

/** Valida y normaliza lo que se pide pagar (del cuerpo). null si no tiene sentido. */
export function leerPedido(cuerpo: unknown): PedidoDePago | null {
  const c = (cuerpo ?? {}) as { plan?: unknown; forma?: unknown; cantidad?: unknown; materia?: unknown }
  const plan = c.plan === 'particular' || c.plan === 'aula' || c.plan === 'pase_alumno' ? c.plan : null
  const forma = c.forma === 'mensual' || c.forma === 'pase' ? c.forma : null
  const cantidad = Number(c.cantidad ?? 1)
  if (!plan || !forma || !Number.isInteger(cantidad) || cantidad < 1) return null
  if (plan === 'particular' && (normalizarNivel(cantidad) === null || cantidad === 0)) return null
  if (plan === 'aula' && (cantidad > 50 || forma !== 'mensual')) return null
  if (plan === 'pase_alumno') {
    // E2: el pase es de una materia personal; sin ella no hay a qué acreditarlo.
    const materia = Number(c.materia)
    if (cantidad !== 1 || forma !== 'pase' || !Number.isInteger(materia) || materia <= 0) return null
    return { plan, forma, cantidad, materia }
  }
  return { plan, forma, cantidad }
}

/** El precio de lista de un pedido, o null si falta la variable de entorno. */
export function precioDeLista(p: PedidoDePago, env: Entorno = process.env): number | null {
  if (p.plan === 'particular') {
    const nivel = p.cantidad as NivelPlan
    return p.forma === 'mensual' ? precioMensual(nivel, env) : precioPase(nivel, env)
  }
  if (p.plan === 'aula') return precioAula(p.cantidad, env)
  const crudo = env.MAESTRIA_PRECIO_PASE_ALUMNO?.trim()
  const monto = crudo ? Number(crudo) : NaN
  return Number.isFinite(monto) && monto > 0 ? monto : null
}

/** Qué se paga, para validar el código contra eso. */
export function queSePaga(p: PedidoDePago): QueSePaga {
  return { plan: p.plan, forma: p.forma }
}

/**
 * El cobro: lista, descuento y días. null si no hay precio cargado. Con un
 * código rechazado, quien llama decide (el resumen lo muestra y no lo aplica).
 */
export function armarCobro(p: PedidoDePago, codigo: ResultadoDelCodigo | null, env: Entorno = process.env): Cobro | null {
  const lista = precioDeLista(p, env)
  if (lista === null) return null
  const monto = codigo?.ok ? precioConDescuento(lista, codigo.porcentaje) : lista
  // El pase de alumno dura hasta el examen + 7 (E2, lib/autodidacta.ts): no son días fijos.
  const dias = p.plan === 'pase_alumno' ? 0 : p.forma === 'mensual' ? DIAS_MENSUAL : DIAS_PASE
  const duracion = p.plan === 'pase_alumno' ? 'hasta el examen + 7 días' : p.forma === 'mensual' ? 'mes' : 'pase de 90 días'
  return { pedido: p, montoLista: lista, monto, dias, descripcion: `${nombreDelPedido(p)} · ${duracion}` }
}

/**
 * El nuevo vencimiento: suma los días desde el vencimiento actual si todavía
 * está vigente (no se pierde lo que quedaba); si no, desde ahora.
 */
export function nuevoVencimiento(venceActual: Date | string | null | undefined, dias: number, ahora: Date): Date {
  const actual = venceActual ? new Date(venceActual) : null
  const desde = actual && !Number.isNaN(actual.getTime()) && actual.getTime() > ahora.getTime() ? actual : ahora
  return sumarDias(desde, dias)
}

/**
 * La firma del webhook de Mercado Pago (`x-signature: ts=…,v1=…`): HMAC
 * SHA-256, con la clave secreta, del manifiesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. Comparación en tiempo
 * constante. Sin secreto, sin firma o con una firma que no coincide: false.
 */
export function firmaValida(params: {
  firma: string | null
  requestId: string | null
  dataId: string | null
  secreto: string | undefined
}): boolean {
  if (!params.secreto || !params.firma || !params.dataId) return false
  const partes = Object.fromEntries(
    params.firma.split(',').map((p) => {
      const [k, ...v] = p.split('=')
      return [k.trim(), v.join('=').trim()]
    }),
  ) as { ts?: string; v1?: string }
  if (!partes.ts || !partes.v1) return false
  // Mercado Pago manda el id en minúsculas si es alfanumérico.
  const id = /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId
  const manifiesto = `id:${id};${params.requestId ? `request-id:${params.requestId};` : ''}ts:${partes.ts};`
  const esperado = createHmac('sha256', params.secreto).update(manifiesto).digest('hex')
  const a = Buffer.from(esperado, 'hex')
  const b = Buffer.from(partes.v1, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** El estado de Mercado Pago, en el nuestro. */
export function estadoDelPago(status: unknown): 'aprobado' | 'rechazado' | 'cancelado' | 'pendiente' {
  if (status === 'approved') return 'aprobado'
  if (status === 'rejected') return 'rechazado'
  if (status === 'cancelled' || status === 'refunded' || status === 'charged_back') return 'cancelado'
  return 'pendiente'
}
