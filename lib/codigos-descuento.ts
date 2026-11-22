/**
 * Ronda T · C1 — Códigos de descuento (puro).
 *
 * Mauro crea un código en /admin/codigos (el primero: FUNDADORA-SIL, 50 % del
 * plan Particular, 6 meses, 1 uso, marca Fundadora) y quien paga lo escribe en
 * el resumen del pago (C2). El monto lo calcula SIEMPRE el servidor con esto.
 *
 * Un "uso" es una persona: quien ya lo usó puede volver a aplicarlo mientras
 * duren sus meses (desde su primer uso) sin gastar otro uso. El precio final se
 * redondea a $100.
 */
export type AplicaA = 'particular' | 'aula' | 'pase_alumno' | 'todos'
export type FormaDePago = 'mensual' | 'pase' | 'ambos'
/** Lo que se está pagando: el tipo de plan y la forma. */
export type QueSePaga = { plan: Exclude<AplicaA, 'todos'>; forma: Exclude<FormaDePago, 'ambos'> }

export const APLICA_A: readonly AplicaA[] = ['particular', 'aula', 'pase_alumno', 'todos']
export const FORMAS: readonly FormaDePago[] = ['mensual', 'pase', 'ambos']

export interface CodigoDeDescuento {
  id: number
  codigo: string
  porcentaje: number
  aplica: AplicaA
  forma: FormaDePago
  /** Meses que dura desde el primer uso de cada persona; null = sin límite. */
  meses: number | null
  usosMaximos: number
  /** Personas que ya lo usaron. */
  usosHechos: number
  venceEl: string | null
  fundadora: boolean
  activo: boolean
  nota: string | null
}

export type MotivoDeRechazo = 'no_existe' | 'inactivo' | 'vencido' | 'agotado' | 'no_aplica' | 'se_termino'

export type ResultadoDelCodigo =
  | { ok: true; codigo: CodigoDeDescuento; porcentaje: number; nuevoUso: boolean }
  | { ok: false; motivo: MotivoDeRechazo }

/** "  fundadora-sil " → "FUNDADORA-SIL". */
export function normalizarCodigo(texto: unknown): string {
  return String(texto ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

/** El formato de un código: letras, números y guiones, de 3 a 40. */
export function codigoValido(texto: string): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(texto)
}

const MS_POR_MES = 30 * 24 * 60 * 60 * 1000

/**
 * ¿Vale este código para esto, para esta persona, ahora?
 *
 * `primerUsoDeLaPersona`: cuándo lo usó esta persona por primera vez, o null
 * si nunca. Con eso: si ya lo usó, no gasta un uso nuevo (y vale mientras le
 * duren los meses); si no, necesita un uso libre.
 */
export function validarCodigo(params: {
  codigo: CodigoDeDescuento | null
  que: QueSePaga
  primerUsoDeLaPersona: Date | string | null
  ahora: Date
}): ResultadoDelCodigo {
  const { codigo, que, ahora } = params
  if (!codigo) return { ok: false, motivo: 'no_existe' }
  if (!codigo.activo) return { ok: false, motivo: 'inactivo' }
  if (codigo.venceEl && new Date(codigo.venceEl).getTime() <= ahora.getTime()) return { ok: false, motivo: 'vencido' }
  if (codigo.aplica !== 'todos' && codigo.aplica !== que.plan) return { ok: false, motivo: 'no_aplica' }
  if (codigo.forma !== 'ambos' && codigo.forma !== que.forma) return { ok: false, motivo: 'no_aplica' }

  const primerUso = params.primerUsoDeLaPersona ? new Date(params.primerUsoDeLaPersona) : null
  if (primerUso) {
    if (codigo.meses !== null && ahora.getTime() > primerUso.getTime() + codigo.meses * MS_POR_MES) {
      return { ok: false, motivo: 'se_termino' }
    }
    return { ok: true, codigo, porcentaje: codigo.porcentaje, nuevoUso: false }
  }
  if (codigo.usosHechos >= codigo.usosMaximos) return { ok: false, motivo: 'agotado' }
  return { ok: true, codigo, porcentaje: codigo.porcentaje, nuevoUso: true }
}

/** El precio con el descuento, redondeado a $100 (nunca menos de 0). */
export function precioConDescuento(monto: number, porcentaje: number): number {
  // En enteros: con decimales, 15.000 × 0,67 da 10.049,999… y redondea mal.
  const p = Math.min(100, Math.max(0, Math.round(porcentaje)))
  return Math.max(0, Math.round((monto * (100 - p)) / 10000) * 100)
}

export const MOTIVO_DEL_RECHAZO: Record<MotivoDeRechazo, string> = {
  no_existe: 'Ese código no existe. Revisá cómo lo escribiste.',
  inactivo: 'Ese código ya no está activo.',
  vencido: 'Ese código venció.',
  agotado: 'Ese código ya se usó todas las veces que se podía.',
  no_aplica: 'Ese código no vale para este plan.',
  se_termino: 'Tu descuento con ese código ya terminó.',
}

/** Para leer una fila de la base (o del cuerpo del admin) sin confiar en su forma. */
export function codigoDesdeFila(fila: Record<string, unknown>): CodigoDeDescuento {
  const aplica = APLICA_A.includes(fila.aplica as AplicaA) ? (fila.aplica as AplicaA) : 'todos'
  const forma = FORMAS.includes(fila.forma as FormaDePago) ? (fila.forma as FormaDePago) : 'ambos'
  const fecha = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
  return {
    id: Number(fila.id),
    codigo: String(fila.codigo ?? ''),
    porcentaje: Number(fila.porcentaje ?? 0),
    aplica,
    forma,
    meses: fila.meses === null || fila.meses === undefined ? null : Number(fila.meses),
    usosMaximos: Number(fila.usos_maximos ?? 1),
    usosHechos: Number(fila.usos_hechos ?? 0),
    venceEl: fecha(fila.vence_el),
    fundadora: Boolean(fila.fundadora),
    activo: fila.activo !== false,
    nota: typeof fila.nota === 'string' ? fila.nota : null,
  }
}
