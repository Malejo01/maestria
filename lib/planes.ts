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

import type { Modalidad } from '@/lib/modalidad'

export type EstadoPlan = 'exento' | 'prueba' | 'activo' | 'gratis' | 'vencido'
export type NivelPlan = 0 | 1 | 2 | 3 | 4 | 5
export type TipoDePago = 'mensual' | 'pase'

export const NIVELES: readonly NivelPlan[] = [0, 1, 2, 3, 4, 5]
export const NIVEL_TOPE: NivelPlan = 5

/**
 * Lo que duraba la prueba de G2. AA1 (27/11/2026) la apagó para los que llegan
 * desde ahora (`diasDePrueba`, por defecto 0); esta constante queda sólo para
 * el docente que la arrancó antes y no tiene `plan_vence_el` escrito.
 */
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
/** Ronda T · B1: 10 cada 30 días (antes 20). Si la variable está cargada en Vercel, manda ella. */
export const CUESTIONARIOS_GRATIS_POR_DEFECTO = 10
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

/**
 * AA1: cuántos días de prueba tiene el docente que todavía no la arrancó
 * (`MAESTRIA_PRUEBA_DIAS`). Por defecto 0: no hay prueba, el docente nuevo
 * arranca en el plan gratis. Quien ya la arrancó la termina como estaba
 * prevista: su fecha de vencimiento está escrita y esto no la toca.
 */
export function diasDePrueba(env: Entorno = process.env): number {
  return enteroDe(env, 'MAESTRIA_PRUEBA_DIAS', 0)
}

/** Cuántos cuestionarios genera el plan gratis cada 30 días (`MAESTRIA_GRATIS_CUESTIONARIOS_MES`, si no 10). */
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

// ─── Docente nuevo o de antes del rediseño (H3) ──────────────────────────────

/**
 * Cuándo llegó a producción el aviso de G2: el merge del PR #29
 * (`feat/g2-aviso-de-prueba`, commit b537bbc) a `main`, el 16/11/2026 a las
 * 03:13 de Argentina, que es lo que Vercel despliega. Quien se registró antes
 * conoció la versión anterior y lee "Rediseñamos MaestrIA"; quien se registró
 * después nunca la vio, y para él "rediseñamos" no significa nada.
 */
export const CORTE_DOCENTES_PREVIOS = new Date('2026-11-16T06:13:07Z')

/**
 * Si el docente se registró después del rediseño. Sin fecha legible, nuevo:
 * a alguien de antes el texto de nuevo igual le dice algo cierto; al revés, no.
 */
export function esDocenteNuevo(creadoEl: Date | string | null | undefined, corte: Date = CORTE_DOCENTES_PREVIOS): boolean {
  const fecha = aFecha(creadoEl)
  return fecha === null || fecha.getTime() >= corte.getTime()
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
  /** B1: `users.plan_tipo`. Sin la 037, undefined: particular. */
  tipo?: unknown
  /** B1: `users.aula_cursos`. */
  aulaCursos?: unknown
  /**
   * B1: los lugares por tipo, para el gratis ("2 particulares + 1 curso de
   * hasta 35"). Sin esto, el gratis sigue la regla de antes (alumnos ≤ cupo).
   */
  lugares?: LugaresPorTipo
  /** AC1: `users.modalidad` (050). Sin la 050 o sin dato, null: la regla B1. */
  modalidad?: Modalidad | null
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
export function terminoElPeriodo(datos: DatosDelPlan, env: Entorno = process.env): boolean {
  if (datos.esExento || normalizarNivel(datos.nivel) === null) return false
  // AA1: sin prueba, la que nunca arrancó ya terminó: decide el gratis.
  if (pruebaSinArrancar(datos) && diasDePrueba(env) === 0) return true
  const vence = venceElEfectivo(datos)
  return vence !== null && datos.ahora.getTime() >= vence.getTime()
}

/** Nivel 0 sin ninguna fecha: el docente nunca arrancó la prueba (no vio el aviso de G2). */
export function pruebaSinArrancar(datos: Pick<DatosDelPlan, 'nivel' | 'venceEl' | 'pruebaIniciadaEl'>): boolean {
  return normalizarNivel(datos.nivel) === 0 && aFecha(datos.venceEl) === null && aFecha(datos.pruebaIniciadaEl) === null
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
  // AA1: con `MAESTRIA_PRUEBA_DIAS` en 0, la que no arrancó cuenta como terminada.
  if (!terminoElPeriodo(datos, env)) return nivel === 0 ? 'prueba' : 'activo'
  // B1: con los lugares por tipo, el gratis es "2 particulares + 1 curso de
  // hasta 35". Sin ellos, la regla de antes. Las dos aceptan a quien ya cabía.
  if (datos.lugares) return cabeEnElGratis(datos.lugares, env) ? 'gratis' : 'vencido'
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

/**
 * El cupo de alumnos que rige hoy: el del nivel, el del Aula (cursos × 35) o
 * el del gratis. null si no hay tope.
 */
export function cupoVigente(
  estado: EstadoPlan,
  nivel: unknown,
  env: Entorno = process.env,
  aula?: { tipo: unknown; cursos: unknown },
): number | null {
  if (estado === 'exento') return null
  if (estado === 'gratis') return cupoGratis(env)
  if (aula && tipoDePlan(aula.tipo) === 'aula' && estado === 'activo') {
    return cupoDeCursosAula(aula.cursos) * alumnosMaximosPorCurso(env)
  }
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

export type MotivoDeBloqueo =
  | 'vencido'
  | 'sin_cupo'
  | 'tope_cuestionarios'
  /** B1: el plan Aula no tiene más cursos. */
  | 'sin_cursos'
  /** B1: una función individual (ficha, invitación, diagnóstico o tarea de un alumno) en el plan Aula. */
  | 'solo_particular'
  /** B1: el informe para imprimir o la exportación a Moodle en el plan gratis. */
  | 'con_un_plan'

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
  /** El aviso de G2: todavía no arrancó la prueba. Con `MAESTRIA_PRUEBA_DIAS` en 0 (AA1), siempre false. */
  avisoDePruebaPendiente: boolean
  /** AA1: los días de prueba que ofrece el aviso (`MAESTRIA_PRUEBA_DIAS`). Opcional para los resúmenes viejos. */
  diasDePrueba?: number
  /** El cupo del plan gratis, para los textos de "después seguís gratis con hasta N". */
  cupoGratis: number
  /** El tope de cuestionarios del gratis cada 30 días. */
  topeCuestionarios: number
  /** Cuestionarios generados en los últimos 30 días; null si no se contó (fuera del gratis). */
  cuestionarios: number | null
  /** H3: se registró después del rediseño. Decide el texto del aviso de bienvenida. */
  docenteNuevo: boolean
  /** B1: Particular o Aula. */
  tipo: TipoDePlan
  /** B1: los cursos del plan Aula (0 en Particular). */
  aulaCursos: number
  /** B1: hasta cuántos alumnos por curso. */
  alumnosPorCurso: number
  /** B1: las funciones individuales (fichas, invitación, diagnóstico y tareas de un alumno). */
  permiteIndividual: boolean
  /** B1: el informe para imprimir y la exportación a Moodle. */
  permiteImprimirYMoodle: boolean
  /** B2: docente fundadora (fecha), o null. */
  fundadoraDesde: string | null
  /** AC1: cómo da clases (particular, curso o null = B1). Opcional para los resúmenes viejos. */
  modalidad?: Modalidad | null
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
        ? resumen.tipo === 'aula' && resumen.estado === 'activo'
          ? mensajeTopeCuestionariosAula(resumen.topeCuestionarios)
          : mensajeTopeCuestionarios(resumen.topeCuestionarios)
        : motivo === 'sin_cursos'
          ? MENSAJE_SIN_CURSOS
          : motivo === 'solo_particular'
            ? MENSAJE_SOLO_PARTICULAR
            : motivo === 'con_un_plan'
              ? MENSAJE_CON_UN_PLAN
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
  const motivos: MotivoDeBloqueo[] = ['vencido', 'sin_cupo', 'tope_cuestionarios', 'sin_cursos', 'solo_particular', 'con_un_plan']
  if (!motivos.includes(motivo as MotivoDeBloqueo)) return null
  return cuerpo as CuerpoDeBloqueo
}

// ─── Ronda T · B1: Particular y Aula ─────────────────────────────────────────

/**
 * Dos tipos de plan. **Particular** (el de siempre): por bloques de alumnos,
 * con todo lo individual. **Aula**: cursos de hasta 35 alumnos, con tareas y
 * diagnósticos de grupo, informe para imprimir y Moodle, 60 cuestionarios cada
 * 30 días y 10 prácticas extra por alumno por mes, y SIN funciones
 * individuales (ficha, invitación, diagnóstico y tareas de un alumno). El
 * cerco son las funciones individuales, no la cantidad de alumnos.
 *
 * El gratis: 2 particulares + 1 curso de hasta 35, 10 cuestionarios cada 30
 * días, sin informe para imprimir ni Moodle.
 *
 * Válvula: sin la 037, todos son 'particular' y nada cambia.
 */
export type TipoDePlan = 'particular' | 'aula'

export function tipoDePlan(valor: unknown): TipoDePlan {
  return valor === 'aula' ? 'aula' : 'particular'
}

export const ALUMNOS_POR_CURSO_POR_DEFECTO = 35
export const CUESTIONARIOS_AULA_POR_DEFECTO = 60
export const PRACTICAS_EXTRA_AULA_POR_MES = 10
/** El gratis: un curso. */
export const CURSOS_GRATIS = 1

/** Hasta cuántos alumnos por curso (`MAESTRIA_AULA_ALUMNOS_POR_CURSO`, si no 35). */
export function alumnosMaximosPorCurso(env: Entorno = process.env): number {
  return enteroDe(env, 'MAESTRIA_AULA_ALUMNOS_POR_CURSO', ALUMNOS_POR_CURSO_POR_DEFECTO)
}

/** Los cursos pagos del plan Aula: un entero ≥ 0 (un dato roto es 0). */
export function cupoDeCursosAula(aulaCursos: unknown): number {
  const n = typeof aulaCursos === 'string' ? Number(aulaCursos) : aulaCursos
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : 0
}

/** El tope de cuestionarios cada 30 días, o null si no hay (Particular, prueba, exento). */
export function cuestionariosDelMes(tipo: TipoDePlan, estado: EstadoPlan, env: Entorno = process.env): number | null {
  if (estado === 'gratis') return cuestionariosGratisPorMes(env)
  if (tipo === 'aula' && estado === 'activo') return enteroDe(env, 'MAESTRIA_AULA_CUESTIONARIOS_MES', CUESTIONARIOS_AULA_POR_DEFECTO)
  return null
}

/**
 * El tope de prácticas extra (P4) por alumno por mes, además de las 3 por día
 * y por tarea de siempre. null: sin tope mensual.
 */
export function practicasExtraPorAlumnoMes(tipo: TipoDePlan, estado: EstadoPlan): number | null {
  return tipo === 'aula' && estado === 'activo' ? PRACTICAS_EXTRA_AULA_POR_MES : null
}

/** Ficha, invitación individual, diagnóstico y tareas de un alumno: no en el plan Aula vigente. */
export function permiteIndividual(tipo: TipoDePlan, estado: EstadoPlan): boolean {
  return !(tipo === 'aula' && estado === 'activo')
}

/** El informe para imprimir (O9) y la exportación a Moodle: no en el gratis. */
export function permiteImprimirYMoodle(estado: EstadoPlan): boolean {
  return estado !== 'gratis'
}

/**
 * Los lugares que ocupa un docente, por tipo. **Particulares**: los que tienen
 * una invitación con su nombre (los sumó el docente, uno por uno). **Cursos**:
 * los que entraron a un grupo con el código, sin invitación, contados por grupo.
 */
export interface LugaresPorTipo {
  particulares: number
  /** Alumnos por código en cada grupo que tiene alguno. */
  cursos: number[]
}

/** "2 particulares + 1 curso de hasta 35". */
export function cabeEnElGratis(lugares: LugaresPorTipo, env: Entorno = process.env): boolean {
  const conAlumnos = lugares.cursos.filter((n) => n > 0)
  return (
    lugares.particulares <= cupoGratis(env) &&
    conAlumnos.length <= CURSOS_GRATIS &&
    conAlumnos.every((n) => n <= alumnosMaximosPorCurso(env))
  )
}

/**
 * ¿Entra un alumno más a ESTE grupo por código? En el Aula y en el gratis, un
 * curso tiene hasta 35; en el gratis además hay un solo curso (los otros grupos
 * no reciben por código). En Particular, la regla de siempre (el cupo).
 */
export function cursoTieneLugar(params: {
  estado: EstadoPlan
  tipo: TipoDePlan
  /** Alumnos por código que ya tiene este grupo. */
  enEsteCurso: number
  /** Grupos del docente (sin contar éste) que ya tienen alumnos por código. */
  otrosCursosConAlumnos: number
  env?: Entorno
}): boolean {
  const env = params.env ?? process.env
  if (params.estado === 'exento') return true
  if (params.estado === 'vencido') return false
  const porCurso = alumnosMaximosPorCurso(env)
  if (params.estado === 'gratis') {
    return params.enEsteCurso < porCurso && (params.enEsteCurso > 0 || params.otrosCursosConAlumnos < CURSOS_GRATIS)
  }
  if (params.tipo === 'aula' && params.estado === 'activo') return params.enEsteCurso < porCurso
  return true
}

/** Aula: ¿puede abrir un grupo más? (Particular, prueba y gratis: como siempre.) */
export function puedeCrearCurso(tipo: TipoDePlan, estado: EstadoPlan, gruposAbiertos: number, aulaCursos: unknown): boolean {
  if (tipo !== 'aula' || estado !== 'activo') return true
  return gruposAbiertos < cupoDeCursosAula(aulaCursos)
}

export const MENSAJE_CURSO_COMPLETO = 'Este curso está completo. Avisale a tu docente.'
export const MENSAJE_SIN_CURSOS = 'Ya usaste los cursos de tu plan Aula. Para abrir otro, sumá un curso.'
export const MENSAJE_SOLO_PARTICULAR = 'Las fichas, el diagnóstico y las tareas de cada alumno vienen con el plan Particular.'
export const MENSAJE_CON_UN_PLAN = 'El informe para imprimir y la exportación a Moodle vienen con un plan pago.'

export function mensajeTopeCuestionariosAula(tope: number): string {
  return `El plan Aula genera hasta ${tope} cuestionarios cada 30 días, y ya llegaste.`
}

/**
 * AC1 · ¿Entra por el código del grupo un alumno que ocuparía un lugar nuevo?
 * true, o el motivo: 'curso_completo' (B1: el curso del Aula o del gratis
 * llegó a 35, o el gratis ya tiene su curso) o 'sin_lugar' (el cupo).
 *
 * En el gratis, con modalidad 'curso' o sin dato, la regla B1 (curso de hasta
 * 35); con modalidad 'particular' no hay curso: quien entra por el link ocupa
 * un lugar particular y cuenta contra el cupo gratis (2), con todos los que ya
 * están. En el Aula activo, el curso. En lo demás, el cupo del nivel.
 */
export function decidirIngresoPorCodigo(params: {
  estado: EstadoPlan
  tipo: TipoDePlan
  modalidad: Modalidad | null
  nivel: unknown
  /** Todos los alumnos que ya ocupan lugar (particulares y de curso). */
  alumnos: number
  /** Alumnos por código que ya tiene este grupo. */
  enEsteCurso: number
  /** Grupos del docente (sin contar éste) que ya tienen alumnos por código. */
  otrosCursosConAlumnos: number
  env?: Entorno
}): true | 'sin_lugar' | 'curso_completo' {
  const env = params.env ?? process.env
  if (params.estado === 'exento') return true
  const conCursos = params.modalidad !== 'particular'
  if ((params.estado === 'gratis' && conCursos) || (params.tipo === 'aula' && params.estado === 'activo')) {
    return cursoTieneLugar({ ...params, env }) ? true : 'curso_completo'
  }
  return puedeSumarAlumno(params.estado, params.alumnos, params.nivel, env) ? true : 'sin_lugar'
}
