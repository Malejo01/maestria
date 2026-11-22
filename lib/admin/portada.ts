import { estadoDelPlan, sumarDias, terminoElPeriodo, venceElEfectivo, type DatosDelPlan, type EstadoPlan } from '@/lib/planes'

/**
 * P1 · Las cuentas puras de la portada de /admin (y de /admin/docentes).
 * Lo que toca la base está en `portada-server.ts`.
 */

export interface PlanCrudo {
  email: string | null
  nivel: unknown
  venceEl: string | Date | null
  pruebaIniciadaEl: string | Date | null
  /** Alumnos activos: sólo distingue gratis de vencido cuando el período terminó. */
  alumnos: number
}

export interface ResumenDePlanes {
  prueba: number
  /** Prueba o plan pago que vence en los próximos 7 días (y todavía no venció). */
  vencenEstaSemana: number
  /** El período (prueba o pago) ya terminó: gratis o vencido. */
  vencidos: number
}

const DIAS_DE_LA_SEMANA = 7

export function datosDelPlan(p: PlanCrudo, esExento: boolean, ahora: Date): DatosDelPlan {
  return { nivel: p.nivel, venceEl: p.venceEl, pruebaIniciadaEl: p.pruebaIniciadaEl, esExento, ahora, alumnosActuales: p.alumnos }
}

export function estadoDe(p: PlanCrudo, esExento: boolean, ahora: Date): EstadoPlan {
  return estadoDelPlan(datosDelPlan(p, esExento, ahora))
}

/**
 * La tarjeta de Planes: en prueba, que vencen esta semana, vencidos. Un docente
 * en prueba que vence en 3 días cuenta en las dos primeras: son preguntas
 * distintas ("¿cuántos están probando?" y "¿a quién escribirle esta semana?").
 */
export function resumirPlanes(planes: readonly PlanCrudo[], esExento: (email: string | null) => boolean, ahora: Date): ResumenDePlanes {
  const limite = sumarDias(ahora, DIAS_DE_LA_SEMANA)
  let prueba = 0
  let vencenEstaSemana = 0
  let vencidos = 0
  for (const p of planes) {
    const exento = esExento(p.email)
    const datos = datosDelPlan(p, exento, ahora)
    const estado = estadoDelPlan(datos)
    if (estado === 'exento') continue
    if (estado === 'prueba') prueba++
    if (terminoElPeriodo(datos)) {
      vencidos++
      continue
    }
    const vence = venceElEfectivo(datos)
    if (vence && vence.getTime() <= limite.getTime()) vencenEstaSemana++
  }
  return { prueba, vencenEstaSemana, vencidos }
}

/** El color del estado del plan en las listas de admin (como en /admin/planes). */
export const CLASE_DEL_PLAN: Record<EstadoPlan, string> = {
  exento: 'text-texto-suave',
  prueba: 'text-accion',
  activo: 'text-logrado',
  gratis: 'text-texto',
  vencido: 'text-flojo',
}
