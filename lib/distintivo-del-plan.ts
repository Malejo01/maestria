import { DIAS_DE_AVISO, bloquesDeNivel, type ResumenDelPlan } from './planes'
import { DISTINTIVO_DEL_PLAN as T } from './textos'

/**
 * Ronda T · B2 — El estado del plan en el avatar (puro).
 *
 *   Pago (Particular o Aula)   birrete
 *   Fundadora                  birrete con estrella, para siempre
 *   Prueba                     reloj
 *   Gratis                     nada
 *   Vencido                    punto ámbar
 *   A 7 días de vencer         birrete con punto ámbar
 *   Exento (admin)             nada: el botón Admin ya lo identifica
 *
 * Nunca sólo el ícono: el avatar lleva el estado en su `aria-label`, y el menú
 * de la cuenta lo dice en palabras, con la barra de cupo.
 */
export type Distintivo = 'birrete' | 'birrete-estrella' | 'reloj' | null

export interface EstadoEnElAvatar {
  distintivo: Distintivo
  /** El punto ámbar: vencido o a 7 días de vencer. */
  punto: boolean
  /** Lo que se lee junto al nombre: "plan Particular, vence el 22/12". */
  estado: string | null
  /** El renglón del menú. */
  titulo: string | null
  detalle: string | null
  /** La barra de cupo (alumnos o, en el Aula, cuestionarios del mes). */
  cupo: { usados: number; total: number; texto: string } | null
  /** "Elegir un plan", "Renovar", "Pasate a un plan". */
  accion: { texto: string; href: string } | null
  fundadora: boolean
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }) : null

const PRECIOS = '/precios'

export function estadoEnElAvatar(resumen: ResumenDelPlan | null | undefined): EstadoEnElAvatar {
  const vacio: EstadoEnElAvatar = {
    distintivo: null,
    punto: false,
    estado: null,
    titulo: null,
    detalle: null,
    cupo: null,
    accion: null,
    fundadora: false,
  }
  if (!resumen || resumen.estado === 'exento') return vacio

  const fundadora = Boolean(resumen.fundadoraDesde)
  const porVencer =
    resumen.estado === 'activo' && resumen.diasRestantes !== null && resumen.diasRestantes <= DIAS_DE_AVISO
  const vence = fecha(resumen.venceEl)

  if (resumen.estado === 'activo') {
    const esAula = resumen.tipo === 'aula'
    const nombre = esAula ? T.planAula : T.planParticular
    const unidades = esAula
      ? T.cursos(resumen.aulaCursos)
      : resumen.nivel === 5
        ? T.tope
        : T.bloques(bloquesDeNivel(resumen.nivel ?? 1) ?? 1)
    const cupo =
      resumen.cupo !== null
        ? { usados: resumen.alumnos, total: resumen.cupo, texto: T.deAlumnos(resumen.alumnos, resumen.cupo) }
        : null
    const cuestionarios =
      esAula && resumen.cuestionarios !== null ? T.deCuestionarios(resumen.cuestionarios, resumen.topeCuestionarios) : null
    return {
      distintivo: fundadora ? 'birrete-estrella' : 'birrete',
      punto: porVencer,
      estado: [T.estadoPago(nombre), vence ? T.venceEl(vence) : null].filter(Boolean).join(', '),
      titulo: [nombre, unidades].join(' · '),
      detalle: porVencer
        ? T.venceEnDias(resumen.diasRestantes ?? 0)
        : [cuestionarios, vence ? T.venceEl(vence) : null].filter(Boolean).join(' · ') || null,
      cupo,
      accion: porVencer ? { texto: T.renovar, href: PRECIOS } : null,
      fundadora,
    }
  }

  if (resumen.estado === 'prueba') {
    const dias = resumen.diasRestantes
    return {
      distintivo: fundadora ? 'birrete-estrella' : 'reloj',
      punto: false,
      estado: dias !== null ? T.estadoPrueba(dias) : T.prueba,
      titulo: dias !== null ? T.pruebaQuedan(dias) : T.prueba,
      detalle: null,
      cupo: resumen.cupo !== null ? { usados: resumen.alumnos, total: resumen.cupo, texto: T.deAlumnos(resumen.alumnos, resumen.cupo) } : null,
      accion: { texto: T.elegirUnPlan, href: PRECIOS },
      fundadora,
    }
  }

  if (resumen.estado === 'gratis') {
    const quedan =
      resumen.cuestionarios !== null ? Math.max(0, resumen.topeCuestionarios - resumen.cuestionarios) : null
    return {
      distintivo: fundadora ? 'birrete-estrella' : null,
      punto: false,
      estado: T.gratis,
      titulo: T.gratisTitulo,
      detalle: quedan !== null ? T.teQuedan(quedan, resumen.topeCuestionarios) : null,
      cupo: null,
      accion: { texto: T.pasateAUnPlan, href: PRECIOS },
      fundadora,
    }
  }

  // vencido
  return {
    distintivo: fundadora ? 'birrete-estrella' : null,
    punto: true,
    estado: T.estadoVencido,
    titulo: T.vencioTitulo,
    detalle: T.vencioDetalle,
    cupo: null,
    accion: { texto: T.renovar, href: PRECIOS },
    fundadora,
  }
}

/** El nombre del avatar para un lector de pantalla: "Mauro · plan Particular, vence el 22/12". */
export function etiquetaDelAvatar(nombre: string, estado: EstadoEnElAvatar, abrirMenu: string): string {
  const partes = [nombre.trim() || null, estado.fundadora ? T.fundadora : null, estado.estado].filter(Boolean)
  return `${partes.join(' · ')}. ${abrirMenu}`
}

/**
 * Para la animación de "se acreditó un plan": la huella de lo que se vio la
 * última vez. Cambia cuando cambia el estado, el tipo o el vencimiento.
 */
export function huellaDelPlan(resumen: ResumenDelPlan | null | undefined): string | null {
  if (!resumen || resumen.estado === 'exento') return null
  return [resumen.estado, resumen.tipo, resumen.venceEl ?? '', resumen.fundadoraDesde ? 'f' : ''].join('|')
}

/**
 * Si el birrete "cae" ahora: se vio una huella antes, y la de ahora es un plan
 * pago con un vencimiento distinto (o recién pasado a pago, o recién marcada
 * fundadora). La primera vez que se mira no anima: puede ser un plan viejo.
 */
export function seAcreditoUnPlan(anterior: string | null, actual: string | null): boolean {
  if (!anterior || !actual || anterior === actual) return false
  const [estadoActual, , , fundadoraActual] = actual.split('|')
  const [, , , fundadoraAnterior] = anterior.split('|')
  if (fundadoraActual === 'f' && fundadoraAnterior !== 'f') return true
  return estadoActual === 'activo'
}
