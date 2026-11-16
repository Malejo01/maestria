/**
 * Planes y bloques: cuántos alumnos puede seguir un docente y hasta cuándo.
 *
 * Puro, con la misma disciplina que lib/ai-rate-limit.ts: no toca la base ni
 * la request. Recibe datos y devuelve una decisión. La lectura de la base vive
 * en lib/planes-server.ts.
 *
 * EL MODELO (tanda G, 16/11/2026)
 *
 *   Nivel 0  prueba de 30 días     10 alumnos
 *   Nivel 1  1 bloque               5
 *   Nivel 2  2 bloques             10
 *   Nivel 3  3 bloques             15
 *   Nivel 4  4 bloques             20
 *   Nivel 5  tope                 150
 *   Exento                         sin límite (la lista de admin)
 *
 * Mensual = 30 días desde la acreditación; pase = 90 días. Ninguno es por mes
 * calendario. Los precios salen de variables de entorno y nunca se escriben
 * acá: si Mauro los cambia, no se toca una línea.
 *
 * LA VÁLVULA DE SEGURIDAD
 *
 * Si el nivel no llega (la migración 026 no corrió, la columna vino nula, la
 * consulta falló), el docente es `exento`. Nunca vencido, nunca sin cupo: el
 * producto no se cierra por un dato que falta. Eso es lo que permite que este
 * código llegue a `main` antes de que la 026 corra en producción; correrla es
 * lo que enciende el cobro.
 */

export type EstadoPlan = 'exento' | 'prueba' | 'activo' | 'vencido'
export type NivelPlan = 0 | 1 | 2 | 3 | 4 | 5
export type TipoDePago = 'mensual' | 'pase'

export const NIVELES: readonly NivelPlan[] = [0, 1, 2, 3, 4, 5]
export const NIVEL_TOPE: NivelPlan = 5

export const DIAS_PRUEBA = 30
export const DIAS_MENSUAL = 30
export const DIAS_PASE = 90
/** Desde cuántos días antes del vencimiento se avisa arriba del panel. */
export const DIAS_DE_AVISO = 7

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** Alumnos por bloque: "pagás una clase por cada cinco alumnos que seguís". */
export const ALUMNOS_POR_BLOQUE = 5

const CUPOS: Record<NivelPlan, number> = { 0: 10, 1: 5, 2: 10, 3: 15, 4: 20, 5: 150 }

/** Un nivel válido, o null si el dato no sirve. */
export function normalizarNivel(nivel: unknown): NivelPlan | null {
  const n = typeof nivel === 'string' && nivel.trim() !== '' ? Number(nivel) : nivel
  if (typeof n !== 'number' || !Number.isInteger(n)) return null
  return (NIVELES as readonly number[]).includes(n) ? (n as NivelPlan) : null
}

export function cupoDeNivel(nivel: NivelPlan): number {
  return CUPOS[nivel]
}

/** Cuántos bloques paga ese nivel; el tope no se mide en bloques. */
export function bloquesDeNivel(nivel: NivelPlan): number | null {
  return nivel >= 1 && nivel <= 4 ? nivel : null
}

// ─── Precios ─────────────────────────────────────────────────────────────────

type Entorno = Record<string, string | undefined>

function montoDe(env: Entorno, clave: string): number | null {
  const crudo = env[clave]?.trim()
  if (!crudo) return null
  const monto = Number(crudo)
  return Number.isFinite(monto) && monto > 0 ? monto : null
}

/** Lo que cuesta ese nivel por 30 días, o null si no se cobra o falta la variable. */
export function precioMensual(nivel: NivelPlan, env: Entorno = process.env): number | null {
  if (nivel === NIVEL_TOPE) return montoDe(env, 'MAESTRIA_PRECIO_MENSUAL_TOPE')
  const bloques = bloquesDeNivel(nivel)
  const porBloque = montoDe(env, 'MAESTRIA_PRECIO_MENSUAL_BLOQUE')
  return bloques === null || porBloque === null ? null : bloques * porBloque
}

/** Lo que cuesta ese nivel por 90 días. El pase se cobra POR BLOQUE. */
export function precioPase(nivel: NivelPlan, env: Entorno = process.env): number | null {
  if (nivel === NIVEL_TOPE) return montoDe(env, 'MAESTRIA_PRECIO_PASE_TOPE')
  const bloques = bloquesDeNivel(nivel)
  const porBloque = montoDe(env, 'MAESTRIA_PRECIO_PASE_BLOQUE')
  return bloques === null || porBloque === null ? null : bloques * porBloque
}

/** El link de MercadoPago de ese nivel, o null: si falta la variable, la opción no se ofrece. */
export function linkDePago(tipo: TipoDePago, nivel: NivelPlan, env: Entorno = process.env): string | null {
  if (nivel === 0) return null
  const url = env[`MAESTRIA_LINK_${tipo === 'mensual' ? 'MENSUAL' : 'PASE'}_${nivel}`]?.trim()
  return url && /^https:\/\//.test(url) ? url : null
}

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** "$ 20.000": siempre pesos argentinos, en es-AR. */
export function formatearPesos(monto: number): string {
  return formatoPesos.format(monto)
}

export interface OpcionDePago {
  nivel: NivelPlan
  cupo: number
  mensual: { monto: number; link: string | null } | null
  pase: { monto: number; link: string | null } | null
}

/** Las dos formas de pagar un nivel, con lo que haya configurado. */
export function opcionDePago(nivel: NivelPlan, env: Entorno = process.env): OpcionDePago {
  const mensual = precioMensual(nivel, env)
  const pase = precioPase(nivel, env)
  return {
    nivel,
    cupo: cupoDeNivel(nivel),
    mensual: mensual === null ? null : { monto: mensual, link: linkDePago('mensual', nivel, env) },
    pase: pase === null ? null : { monto: pase, link: linkDePago('pase', nivel, env) },
  }
}

/**
 * El nivel pago más chico que alcanza para esa cantidad de alumnos, o null si
 * ni el tope alcanza. Es lo que se ofrece en la pantalla de límite.
 */
export function nivelQueAlcanza(alumnos: number): NivelPlan | null {
  for (const nivel of [1, 2, 3, 4, 5] as const) {
    if (cupoDeNivel(nivel) >= alumnos) return nivel
  }
  return null
}

// ─── Estado ──────────────────────────────────────────────────────────────────

export interface DatosDelPlan {
  /** `users.plan_nivel`. undefined/null cuando la columna no existe o vino vacía. */
  nivel: unknown
  venceEl: Date | string | null | undefined
  pruebaIniciadaEl: Date | string | null | undefined
  esExento: boolean
  ahora: Date
}

function aFecha(valor: Date | string | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === '') return null
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_POR_DIA)
}

/**
 * Hasta cuándo vale el plan, o null si no vence (exento, dato roto, prueba que
 * todavía no arrancó, nivel pago sin fecha).
 */
export function venceElEfectivo(datos: DatosDelPlan): Date | null {
  if (datos.esExento) return null
  const nivel = normalizarNivel(datos.nivel)
  if (nivel === null) return null
  const vence = aFecha(datos.venceEl)
  if (vence) return vence
  if (nivel === 0) {
    const inicio = aFecha(datos.pruebaIniciadaEl)
    return inicio ? sumarDias(inicio, DIAS_PRUEBA) : null
  }
  return null
}

export function estadoDelPlan(datos: DatosDelPlan): EstadoPlan {
  if (datos.esExento) return 'exento'
  const nivel = normalizarNivel(datos.nivel)
  // La válvula: sin un nivel que se pueda leer, el docente no se toca.
  if (nivel === null) return 'exento'

  const vence = venceElEfectivo(datos)
  // Un plan sin fecha no vence: una prueba que todavía no arrancó (el docente
  // no vio el aviso), o un nivel pago que se acreditó sin vencimiento.
  if (vence === null) return nivel === 0 ? 'prueba' : 'activo'
  if (datos.ahora.getTime() >= vence.getTime()) return 'vencido'
  return nivel === 0 ? 'prueba' : 'activo'
}

export function puedeGenerar(estado: EstadoPlan): boolean {
  return estado !== 'vencido'
}

/** Si puede sumar UN alumno más a los que ya tiene. */
export function puedeSumarAlumno(estado: EstadoPlan, alumnosActuales: number, nivel: unknown): boolean {
  if (estado === 'exento') return true
  if (estado === 'vencido') return false
  const n = normalizarNivel(nivel)
  if (n === null) return true
  return alumnosActuales < cupoDeNivel(n)
}

/**
 * Días que le quedan, redondeando para arriba (vence mañana a cualquier hora:
 * 1). Cero si ya venció; null si no vence.
 */
export function diasRestantes(datos: DatosDelPlan): number | null {
  if (estadoDelPlan(datos) === 'exento') return null
  const vence = venceElEfectivo(datos)
  if (vence === null) return null
  const falta = vence.getTime() - datos.ahora.getTime()
  return falta <= 0 ? 0 : Math.ceil(falta / MS_POR_DIA)
}

// ─── Lo que viaja a la UI ────────────────────────────────────────────────────

export type MotivoDeBloqueo = 'vencido' | 'sin_cupo'

/** El resumen que devuelve GET /api/teacher/plan y el cuerpo de un 402. */
export interface ResumenDelPlan {
  estado: EstadoPlan
  nivel: NivelPlan | null
  cupo: number | null
  alumnos: number
  venceEl: string | null
  diasRestantes: number | null
  /** El aviso de G2: todavía no arrancó la prueba. */
  avisoDePruebaPendiente: boolean
}

export interface CuerpoDeBloqueo {
  error: string
  plan: ResumenDelPlan & {
    motivo: MotivoDeBloqueo
    /** Lo que se le ofrece: el nivel que alcanza, con sus dos precios y links. */
    siguiente: OpcionDePago | null
  }
}

export const MENSAJE_VENCIDO =
  'Tu plan venció. Podés seguir viendo tus materias, tus grupos y cómo le va a cada alumno, pero para generar, crear o sumar alumnos hace falta renovarlo.'
export const MENSAJE_SIN_CUPO = 'Llegaste al cupo de alumnos de tu plan.'
/** Lo que ve un alumno que intenta entrar a un grupo de un docente sin lugar. */
export const MENSAJE_GRUPO_SIN_LUGAR =
  'Este grupo no tiene lugar para alumnos nuevos por ahora. Avisale a tu docente.'

export function cuerpoDeBloqueo(
  resumen: ResumenDelPlan,
  motivo: MotivoDeBloqueo,
  env: Entorno = process.env,
): CuerpoDeBloqueo {
  // Vencido: se le ofrece renovar lo que tenía (o el nivel que alcanza para
  // los alumnos que ya sigue, si venía de la prueba). Sin cupo: el que alcanza
  // para uno más.
  const necesita = motivo === 'sin_cupo' ? resumen.alumnos + 1 : Math.max(resumen.alumnos, 1)
  const deseado =
    motivo === 'vencido' && resumen.nivel !== null && resumen.nivel > 0 && cupoDeNivel(resumen.nivel) >= necesita
      ? resumen.nivel
      : nivelQueAlcanza(necesita)
  return {
    error: motivo === 'vencido' ? MENSAJE_VENCIDO : MENSAJE_SIN_CUPO,
    plan: { ...resumen, motivo, siguiente: deseado === null ? null : opcionDePago(deseado, env) },
  }
}

/** Para la UI: lee un 402 y devuelve el bloqueo, o null si el cuerpo no es eso. */
export function leerBloqueo(cuerpo: unknown): CuerpoDeBloqueo | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null
  const plan = (cuerpo as { plan?: unknown }).plan
  if (!plan || typeof plan !== 'object') return null
  const motivo = (plan as { motivo?: unknown }).motivo
  if (motivo !== 'vencido' && motivo !== 'sin_cupo') return null
  return cuerpo as CuerpoDeBloqueo
}
