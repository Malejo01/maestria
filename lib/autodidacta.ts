/**
 * Ronda T · E1 — El alumno que se prepara solo para un examen (puro).
 *
 * Con el programa de su materia y la fecha del examen: un diagnóstico, lo que
 * ya sabe y lo que tiene que reforzar tema por tema, un plan hasta el examen
 * (los temas flojos repartidos en los días que quedan, con una práctica diaria
 * de 10 preguntas) y simulacros cronometrados.
 */

export type TipoDeResultado = 'diagnostico' | 'practica' | 'simulacro'

export interface ResultadoDeTema {
  tema: string
  correctas: number
  total: number
}

export type EstadoDelTema = 'sabido' | 'reforzar' | 'sin_datos'

/** Desde esta proporción de aciertos, el tema está sabido (con al menos 2 respuestas). */
export const UMBRAL_SABIDO = 0.7
export const PREGUNTAS_POR_DIA = 10
/** El diagnóstico: una pregunta por tema, entre 5 y 20. */
export const PREGUNTAS_DIAGNOSTICO = { min: 5, max: 20 }

const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * El estado de cada tema del programa, sumando todo lo que hizo (diagnóstico,
 * prácticas y simulacros). Un tema sin respuestas queda "sin datos".
 */
export function estadoPorTema(
  temasDelPrograma: readonly string[],
  resultados: readonly { por_tema: readonly ResultadoDeTema[] }[],
): { tema: string; estado: EstadoDelTema; correctas: number; total: number }[] {
  const suma = new Map<string, { correctas: number; total: number }>()
  for (const r of resultados) {
    for (const t of r.por_tema) {
      const clave = normal(t.tema)
      const actual = suma.get(clave) ?? { correctas: 0, total: 0 }
      suma.set(clave, { correctas: actual.correctas + t.correctas, total: actual.total + t.total })
    }
  }
  return temasDelPrograma.map((tema) => {
    const s = suma.get(normal(tema)) ?? { correctas: 0, total: 0 }
    const estado: EstadoDelTema = s.total < 1 ? 'sin_datos' : s.correctas / s.total >= UMBRAL_SABIDO && s.total >= 2 ? 'sabido' : s.correctas / s.total >= UMBRAL_SABIDO ? 'sin_datos' : 'reforzar'
    return { tema, estado, ...s }
  })
}

/** Los resultados de un cuestionario, por tema (de las respuestas). */
export function resultadoPorTema(respuestas: readonly { topicName?: string; isCorrect?: boolean | null }[]): ResultadoDeTema[] {
  const suma = new Map<string, ResultadoDeTema>()
  for (const r of respuestas) {
    if (!r.topicName || r.isCorrect === null || r.isCorrect === undefined) continue
    const actual = suma.get(r.topicName) ?? { tema: r.topicName, correctas: 0, total: 0 }
    suma.set(r.topicName, { tema: r.topicName, correctas: actual.correctas + (r.isCorrect ? 1 : 0), total: actual.total + 1 })
  }
  return [...suma.values()]
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** "YYYY-MM-DD" de una fecha en Argentina. */
export function diaArgentino(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha)
}

/** Días que faltan desde hoy (en Argentina) hasta el examen. 0 = es hoy; negativo = ya pasó. */
export function diasHastaElExamen(hoy: Date, fechaExamen: string): number {
  const a = Date.parse(`${diaArgentino(hoy)}T00:00:00Z`)
  const b = Date.parse(`${fechaExamen.slice(0, 10)}T00:00:00Z`)
  return Math.round((b - a) / MS_POR_DIA)
}

export interface DiaDelPlan {
  fecha: string
  temas: string[]
  /** Los dos últimos días antes del examen: simulacro. */
  simulacro: boolean
}

/**
 * El plan hasta el examen: los temas a reforzar primero (después los sin
 * datos), repartidos parejo en los días que quedan antes del examen. Los dos
 * últimos días, simulacro (con los temas flojos que queden). Si todo está
 * sabido, se repasa todo. Sin días, el plan está vacío.
 */
export function planHastaElExamen(params: {
  temas: readonly { tema: string; estado: EstadoDelTema }[]
  hoy: Date
  fechaExamen: string
}): DiaDelPlan[] {
  const dias = diasHastaElExamen(params.hoy, params.fechaExamen)
  if (dias < 1) return []

  const flojos = params.temas.filter((t) => t.estado === 'reforzar').map((t) => t.tema)
  const sinDatos = params.temas.filter((t) => t.estado === 'sin_datos').map((t) => t.tema)
  const aRepasar = [...flojos, ...sinDatos]
  const lista = aRepasar.length > 0 ? aRepasar : params.temas.map((t) => t.tema)

  const diasDeSimulacro = dias >= 4 ? 2 : dias >= 2 ? 1 : 0
  const diasDeEstudio = Math.max(1, dias - diasDeSimulacro)
  const porDia = Math.max(1, Math.ceil(lista.length / diasDeEstudio))
  const inicio = Date.parse(`${diaArgentino(params.hoy)}T00:00:00Z`)

  return Array.from({ length: dias }, (_, i) => {
    const fecha = new Date(inicio + i * MS_POR_DIA).toISOString().slice(0, 10)
    const simulacro = i >= dias - diasDeSimulacro
    const temas = simulacro ? flojos.slice(0, 5) : lista.slice((i % diasDeEstudio) * porDia, (i % diasDeEstudio) * porDia + porDia)
    return { fecha, temas: temas.length > 0 ? temas : lista.slice(0, porDia), simulacro }
  })
}

/** Cuántas preguntas tiene el diagnóstico: una por tema, entre 5 y 20. */
export function preguntasDelDiagnostico(temas: number): number {
  return Math.min(PREGUNTAS_DIAGNOSTICO.max, Math.max(PREGUNTAS_DIAGNOSTICO.min, temas))
}

/** Los simulacros que se ofrecen: cantidad de preguntas y minutos. */
export const SIMULACROS = [
  { preguntas: 10, minutos: 15 },
  { preguntas: 20, minutos: 30 },
  { preguntas: 40, minutos: 60 },
] as const

/**
 * Ronda T · E2 — El pase por materia. Gratis: subir el programa, el
 * diagnóstico (dos intentos de generarlo, por si se corta) y dos prácticas.
 * Con el pase de esa materia, todo hasta el examen + 7 días.
 */
export const GRATIS: Record<TipoDeResultado, number> = { diagnostico: 2, practica: 2, simulacro: 0 }
export const DIAS_DE_GRACIA_DEL_PASE = 7

/** Hasta qué día vale un pase que se paga hoy: examen + 7 (si el examen ya pasó, hoy + 7). */
export function paseHastaPara(fechaExamen: string | null, hoy: Date): string {
  const hoyAr = diaArgentino(hoy)
  const examen = fechaExamen && fechaExamen.slice(0, 10) > hoyAr ? fechaExamen.slice(0, 10) : hoyAr
  return new Date(Date.parse(`${examen}T00:00:00Z`) + DIAS_DE_GRACIA_DEL_PASE * MS_POR_DIA).toISOString().slice(0, 10)
}

/**
 * Ronda U · U2 — Qué pasa con el pase cuando el alumno cambia la fecha del
 * examen. Con el pase vigente, se corre a la fecha nueva + 7 días, **una sola
 * vez por pase**, y **nunca se acorta**: si la fecha nueva lo dejaría más
 * corto (o igual), queda como estaba y la vez no se gasta.
 */
export type CorrimientoDelPase = 'corrido' | 'sin-pase' | 'ya-corrido' | 'no-acorta'

export function paseAlCambiarLaFecha(params: {
  paseHasta: string | null | undefined
  /** Cuándo se corrió este pase, si ya se corrió. */
  corridoEl: string | null | undefined
  fechaNueva: string
  hoy: Date
}): { paseHasta: string | null; resultado: CorrimientoDelPase } {
  const actual = params.paseHasta ? String(params.paseHasta).slice(0, 10) : null
  if (!actual || !paseVigente(actual, params.hoy)) return { paseHasta: actual, resultado: 'sin-pase' }
  if (params.corridoEl) return { paseHasta: actual, resultado: 'ya-corrido' }
  const nuevo = paseHastaPara(params.fechaNueva, params.hoy)
  if (nuevo <= actual) return { paseHasta: actual, resultado: 'no-acorta' }
  return { paseHasta: nuevo, resultado: 'corrido' }
}

/** Una fecha de examen válida: AAAA-MM-DD, real, de hoy en adelante y a menos de dos años. */
export function fechaDeExamenValida(fecha: unknown, hoy: Date): fecha is string {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false
  const ms = Date.parse(`${fecha}T00:00:00Z`)
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha) return false
  const hoyAr = diaArgentino(hoy)
  return fecha >= hoyAr && ms - Date.parse(`${hoyAr}T00:00:00Z`) <= 730 * MS_POR_DIA
}

/** El pase vale hasta ese día inclusive (en Argentina). */
export function paseVigente(paseHasta: string | null | undefined, hoy: Date): boolean {
  return Boolean(paseHasta) && diaArgentino(hoy) <= String(paseHasta).slice(0, 10)
}

export interface Acceso {
  /** El día hasta el que vale el pase, si está vigente. */
  pase: string | null
  /** Cuántos quedan gratis de cada uno; null = sin límite (con pase). */
  quedan: Record<TipoDeResultado, number | null>
}

export function accesoALaMateria(params: { paseHasta: string | null | undefined; usos: Partial<Record<TipoDeResultado, number>>; hoy: Date }): Acceso {
  if (paseVigente(params.paseHasta, params.hoy)) {
    return { pase: String(params.paseHasta).slice(0, 10), quedan: { diagnostico: null, practica: null, simulacro: null } }
  }
  const queda = (t: TipoDeResultado) => Math.max(0, GRATIS[t] - (params.usos[t] ?? 0))
  return { pase: null, quedan: { diagnostico: queda('diagnostico'), practica: queda('practica'), simulacro: queda('simulacro') } }
}

export function puedeGenerar(acceso: Acceso, tipo: TipoDeResultado): boolean {
  const q = acceso.quedan[tipo]
  return q === null || q > 0
}
