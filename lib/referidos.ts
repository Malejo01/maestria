/**
 * Ronda V · V3 — Referidos.
 *
 * Cada docente tiene un código (`IRINA-K7Q2`). Su link es `/?ref=CODIGO`: la
 * primera visita lo guarda (V1) y, al registrarse, queda anotado quién lo
 * trajo (`referidos`, migración 046).
 *
 * - **El docente nuevo:** 10 % en su **primer** pago de un plan docente. El
 *   código del que lo trajo funciona como un código de C1 en "¿Tenés un
 *   código?" (y viene puesto si llegó por el link).
 * - **El que lo trajo:** cuando el nuevo paga su primer plan, 30 días más en
 *   su plan, una vez por referido. Si en ese momento no tiene un plan con
 *   vencimiento, el premio queda pendiente y se suma en su próximo pago. La
 *   campanita le avisa.
 *
 * LA VÁLVULA: nada de esto se activa hasta que Mauro carga
 * `MAESTRIA_REFERIDOS_ACTIVO=1`. Sin la variable (o sin la 046): no se anota,
 * no hay descuento, no hay premio y no se muestra el código.
 *
 * Todo esto es puro.
 */
import type { CodigoDeDescuento, QueSePaga, ResultadoDelCodigo } from '@/lib/codigos-descuento'

export const DESCUENTO_DEL_REFERIDO = 10
export const DIAS_DEL_PREMIO = 30

type Entorno = Record<string, string | undefined>

export function referidosActivo(env: Entorno = process.env): boolean {
  return env.MAESTRIA_REFERIDOS_ACTIVO?.trim() === '1'
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Un código para el docente: su primer nombre (sin tildes, hasta 10 letras) y
 * 4 caracteres al azar sin los que se confunden (0/O, 1/I). `aleatorio` se
 * inyecta para los tests.
 */
export function codigoParaDocente(nombre: string | null | undefined, aleatorio: () => number = Math.random): string {
  const base =
    String(nombre ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .split(/\s+/)[0]
      ?.replace(/[^A-Z]/g, '')
      .slice(0, 10) || 'DOCENTE'
  const sufijo = Array.from({ length: 4 }, () => LETRAS[Math.floor(aleatorio() * LETRAS.length) % LETRAS.length]).join('')
  return `${base.length >= 2 ? base : 'DOCENTE'}-${sufijo}`
}

/** El código del referido como uno de C1: 10 %, planes docentes, una vez. */
export function comoCodigoDeDescuento(codigo: string): CodigoDeDescuento {
  return {
    id: 0,
    codigo,
    porcentaje: DESCUENTO_DEL_REFERIDO,
    aplica: 'todos',
    forma: 'ambos',
    meses: null,
    usosMaximos: 1,
    usosHechos: 0,
    venceEl: null,
    fundadora: false,
    activo: true,
    nota: 'Referido (V3)',
  }
}

/**
 * Si el texto es el código de referido de otro docente, el resultado como
 * código de C1; si no es un código de referido, null (sigue la búsqueda de
 * C1). Un docente no se puede referir a sí mismo, y el 10 % es sólo el primer
 * pago de un plan docente (no el pase de alumno).
 */
export function validarReferido(params: {
  activo: boolean
  codigo: string
  /** El dueño del código, si existe. */
  referenteId: string | null
  quienPaga: string
  /** Si quien paga ya tiene algún pago acreditado. */
  yaPago: boolean
  que: QueSePaga
}): ResultadoDelCodigo | null {
  if (!params.activo || !params.referenteId) return null
  if (params.referenteId === params.quienPaga) return { ok: false, motivo: 'no_aplica' }
  if (params.que.plan === 'pase_alumno') return { ok: false, motivo: 'no_aplica' }
  if (params.yaPago) return { ok: false, motivo: 'se_termino' }
  return { ok: true, codigo: comoCodigoDeDescuento(params.codigo), porcentaje: DESCUENTO_DEL_REFERIDO, nuevoUso: true }
}

/**
 * Qué hacer con el premio del que trajo a alguien que acaba de pagar:
 * sumarlo ya (tiene un plan con vencimiento) o dejarlo pendiente.
 */
export function premioDelReferente(params: { planVenceEl: string | Date | null | undefined; ahora: Date }): 'sumar' | 'pendiente' {
  if (!params.planVenceEl) return 'pendiente'
  const vence = new Date(params.planVenceEl)
  if (Number.isNaN(vence.getTime())) return 'pendiente'
  // Vencido hace más de 30 días: ya está en el gratis; queda para su próximo pago.
  return vence.getTime() >= params.ahora.getTime() - DIAS_DEL_PREMIO * 86_400_000 ? 'sumar' : 'pendiente'
}
