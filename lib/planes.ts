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
 *
 * EL PLAN GRATIS (tanda H, 16/11/2026)
 *
 * No es un nivel guardado: es un estado DERIVADO. Cuando termina la prueba o
 * vence un plan pago, el docente con `cupoGratis()` alumnos o menos sigue
 * gratis y sin vencimiento; con más, queda en solo lectura (`vencido`). Si
 * desde ahí quita alumnos hasta entrar en el cupo, vuelve solo al gratis. En
 * el gratis se hace todo, con dos topes: los alumnos y los cuestionarios
 * generados en los últimos 30 días corridos. Los 2 gratis no se suman a los
 * bloques: 1 bloque son 5 alumnos en total.
 */

export type EstadoPlan = 'exento' | 'prueba' | 'activo' | 'gratis' | 'vencido'
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

// ─── Plan gratis ─────────────────────────────────────────────────────────────

export const CUPO_GRATIS_POR_DEFECTO = 2
export const CUESTIONARIOS_GRATIS_POR_DEFECTO = 20
/** La ventana del tope de cuestionarios del gratis: 30 días corridos, no el mes calendario. */
export const DIAS_VENTANA_GRATIS = 30

function enteroDe(env: Entorno, clave: string, porDefecto: number): number {
  const crudo = env[clave]?.trim()
  if (!crudo || !/^\d+$/.test(crudo)) return porDefecto
  return Number(crudo)
}

/** Cuántos alumnos entran en el plan gratis (`MAESTRIA_CUPO_GRATIS`, si no 2). */
export function cupoGratis(env: Entorno = process.env): number {
  return enteroDe(env, 'MAESTRIA_CUPO_GRATIS', CUPO_GRATIS_POR_DEFECTO)
}

/** Cuántos cuestionarios genera el plan gratis cada 30 días (`MAESTRIA_GRATIS_CUESTIONARIOS_MES`, si no 20). */
export function cuestionariosGratisPorMes(env: Entorno = process.env): number {
  return enteroDe(env, 'MAESTRIA_GRATIS_CUESTIONARIOS_MES', CUESTIONARIOS_GRATIS_POR_DEFECTO)
}

/**
 * Cuántas de esas fechas caen en la ventana del gratis (los últimos 30 días
 * hasta `ahora`). La consulta de lib/planes-server.ts cuenta con la misma
 * ventana en SQL; esto la deja escrita y probada en un solo lugar.
 */
export function contarEnVentana(fechas: readonly (Date | string)[], ahora: Date): number {
  const desde = sumarDias(ahora, -DIAS_VENTANA_GRATIS).getTime()
  return fechas.filter((valor) => {
    const t = (valor instanceof Date ? valor : new Date(valor)).getTime()
    return Number.isFinite(t) && t > desde && t <= ahora.getTime()
  }).length
}

// ─── Estado ──────────────────────────────────────────────────────────────────

export interface DatosDelPlan {
  /** `users.plan_nivel`. undefined/null cuando la columna no existe o vino vacía. */
  nivel: unknown
  venceEl: Date | string | null | undefined
  pruebaIniciadaEl: Date | string | null | undefined
  esExento: boolean
  ahora: Date
  /**
   * Los alumnos que ocupan lugar hoy (como en G1). Sólo decide algo cuando la
   * prueba o el plan ya terminaron: gratis o solo lectura.
   */
  alumnosActuales: number
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

/**
 * Si la prueba o el plan pago ya terminaron (y entonces lo que decide es el
 * plan gratis). Falso para el exento, con la válvula, o sin fecha.
 */
export function terminoElPeriodo(datos: DatosDelPlan): boolean {
  if (datos.esExento || normalizarNivel(datos.nivel) === null) return false
  const vence = venceElEfectivo(datos)
  return vence !== null && datos.ahora.getTime() >= vence.getTime()
}

/**
 * Orden: exento → plan pago vigente (`activo`) → prueba vigente (`prueba`) →
 * con `cupoGratis` alumnos o menos, `gratis`; si no, `vencido`.
 */
export function estadoDelPlan(datos: DatosDelPlan, env: Entorno = process.env): EstadoPlan {
  if (datos.esExento) return 'exento'
  const nivel = normalizarNivel(datos.nivel)
  // La válvula: sin un nivel que se pueda leer, el docente no se toca.
  if (nivel === null) return 'exento'

  // Un plan sin fecha no vence: una prueba que todavía no arrancó (el docente
  // no vio el aviso), o un nivel pago que se acreditó sin vencimiento.
  if (!terminoElPeriodo(datos)) return nivel === 0 ? 'prueba' : 'activo'
  return datos.alumnosActuales <= cupoGratis(env) ? 'gratis' : 'vencido'
}

/**
 * Si puede generar. `cuestionariosEnVentana` es la cuenta de los últimos 30
 * días y se pasa sólo cuando lo que se pide ES generar un cuestionario (o
 * regenerar una pregunta): crear una materia o un grupo no consume ese tope.
 */
export function puedeGenerar(
  estado: EstadoPlan,
  cuestionariosEnVentana?: number,
  env: Entorno = process.env,
): boolean {
  if (estado === 'vencido') return false
  if (estado === 'gratis' && cuestionariosEnVentana !== undefined) {
    return cuestionariosEnVentana < cuestionariosGratisPorMes(env)
  }
  return true
}

/** El cupo de alumnos que rige hoy: el del nivel, o el del gratis. null si no hay tope. */
export function cupoVigente(estado: EstadoPlan, nivel: unknown, env: Entorno = process.env): number | null {
  if (estado === 'exento') return null
  if (estado === 'gratis') return cupoGratis(env)
  const n = normalizarNivel(nivel)
  return n === null ? null : cupoDeNivel(n)
}

/** Si puede sumar UN alumno más a los que ya tiene. */
export function puedeSumarAlumno(
  estado: EstadoPlan,
  alumnosActuales: number,
  nivel: unknown,
  env: Entorno = process.env,
): boolean {
  if (estado === 'exento') return true
  if (estado === 'vencido') return false
  const cupo = cupoVigente(estado, nivel, env)
  if (cupo === null) return true
  return alumnosActuales < cupo
}

/**
 * Quitar alumnos se puede en cualquier estado, también en solo lectura: es
 * la forma de volver al plan gratis. Lo único que lo impide es no ser el
 * dueño del grupo.
 */
export function puedeQuitarAlumno(esDuenoDelGrupo: boolean): boolean {
  return esDuenoDelGrupo
}

/**
 * Días que le quedan, redondeando para arriba (vence mañana a cualquier hora:
 * 1). Cero si ya venció; null si no vence (exento, gratis, sin fecha).
 */
export function diasRestantes(datos: DatosDelPlan, env: Entorno = process.env): number | null {
  const estado = estadoDelPlan(datos, env)
  if (estado === 'exento' || estado === 'gratis') return null
  const vence = venceElEfectivo(datos)
  if (vence === null) return null
  const falta = vence.getTime() - datos.ahora.getTime()
  return falta <= 0 ? 0 : Math.ceil(falta / MS_POR_DIA)
}

// ─── Lo que viaja a la UI ────────────────────────────────────────────────────

export type MotivoDeBloqueo = 'vencido' | 'sin_cupo' | 'tope_cuestionarios'

/** El resumen que devuelve GET /api/teacher/plan y el cuerpo de un 402. */
export interface ResumenDelPlan {
  estado: EstadoPlan
  /** El nivel guardado. En `gratis` sigue siendo el que tenía (0 o el pago que venció). */
  nivel: NivelPlan | null
  /** El cupo que rige hoy: el del nivel, o el del gratis. */
  cupo: number | null
  alumnos: number
  /** null en `gratis`: no vence. */
  venceEl: string | null
  diasRestantes: number | null
  /** El aviso de G2: todavía no arrancó la prueba. */
  avisoDePruebaPendiente: boolean
  /** El cupo del plan gratis, para los textos de "después seguís gratis con hasta N". */
  cupoGratis: number
  /** El tope de cuestionarios del gratis cada 30 días. */
  topeCuestionarios: number
  /** Cuestionarios generados en los últimos 30 días; null si no se contó (fuera del gratis). */
  cuestionarios: number | null
}

export interface CuerpoDeBloqueo {
  error: string
  plan: ResumenDelPlan & {
    motivo: MotivoDeBloqueo
    /** Lo que se le ofrece: el nivel que alcanza, con sus dos precios y links. */
    siguiente: OpcionDePago | null
  }
}

export function mensajeVencido(cupoGratisVigente: number): string {
  return `Tu plan venció. Podés seguir viendo tus materias, tus grupos y cómo le va a cada alumno, pero para generar, crear o sumar alumnos hace falta un plan. Si quedás con ${cupoGratisVigente} alumnos o menos, seguís gratis.`
}
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
  // para uno más. Tope de cuestionarios del gratis: el que alcanza para los
  // alumnos que ya tiene (con 2, 1 bloque).
  const necesita = motivo === 'sin_cupo' ? resumen.alumnos + 1 : Math.max(resumen.alumnos, 1)
  const deseado =
    motivo === 'vencido' && resumen.nivel !== null && resumen.nivel > 0 && cupoDeNivel(resumen.nivel) >= necesita
      ? resumen.nivel
      : nivelQueAlcanza(necesita)
  const error =
    motivo === 'vencido'
      ? mensajeVencido(resumen.cupoGratis)
      : motivo === 'tope_cuestionarios'
        ? mensajeTopeCuestionarios(resumen.topeCuestionarios)
        : MENSAJE_SIN_CUPO
  return {
    error,
    plan: { ...resumen, motivo, siguiente: deseado === null ? null : opcionDePago(deseado, env) },
  }
}

export function mensajeTopeCuestionarios(tope: number): string {
  return `El plan gratis genera hasta ${tope} cuestionarios cada 30 días, y ya llegaste.`
}

/** Para la UI: lee un 402 y devuelve el bloqueo, o null si el cuerpo no es eso. */
export function leerBloqueo(cuerpo: unknown): CuerpoDeBloqueo | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null
  const plan = (cuerpo as { plan?: unknown }).plan
  if (!plan || typeof plan !== 'object') return null
  const motivo = (plan as { motivo?: unknown }).motivo
  if (motivo !== 'vencido' && motivo !== 'sin_cupo' && motivo !== 'tope_cuestionarios') return null
  return cuerpo as CuerpoDeBloqueo
}
