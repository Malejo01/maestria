/**
 * Tanda AB · AB5 — «Esta semana»: quién practicó y qué le falta.
 *
 * El análisis Founder (docs/founder/offer.md) promete «cada lunes ves quién
 * practicó y qué tema le falta a cada uno». Esto arma la tarjeta del panel y
 * el texto para pegar en el WhatsApp del profe. Puro: los datos los trae
 * lib/esta-semana-server.ts.
 *
 * Las mismas reglas que lib/compartir-tarea.ts: texto plano, sin emojis, y NO
 * inventar. Sin respuestas corregidas no hay porcentaje; sin tema flojo
 * medido no se nombra ninguno; un alumno que no practicó dice eso y nada más.
 */

export const DIAS_DE_LA_SEMANA = 7

export interface AlumnoDeLaSemana {
  nombre: string
  /** Intentos en los últimos 7 días (prácticas y tareas en sus grupos). */
  intentos: number
  /** Ejercicios respondidos en esos intentos. */
  ejercicios: number
  correctas: number
  /** Respuestas corregidas (sin las que espera el docente). */
  calificadas: number
  /** El tema más flojo de su ficha (de todo lo que practicó con el docente), o null si no hay. */
  temaMasFlojo: string | null
}

export interface FilaDeLaSemana extends AlumnoDeLaSemana {
  practico: boolean
  /** 0 a 100, o null sin respuestas corregidas. */
  porcentaje: number | null
}

export interface ResumenDeLaSemana {
  filas: FilaDeLaSemana[]
  total: number
  practicaron: number
  frase: string
  /** Nadie practicó (y hay alumnos): se ofrece reenviar el link. */
  nadie: boolean
}

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre.trim()

/** Lo que se lee del tema en una frase: lo de antes de los dos puntos, en minúscula y sin cortar a la mitad. */
const LARGO_EN_FRASE = 60
export function temaParaFrase(tema: string): string {
  const titulo = (tema.split(/[:.(]/)[0].trim() || tema.trim()).toLowerCase()
  if (titulo.length <= LARGO_EN_FRASE) return titulo
  const corte = titulo.slice(0, LARGO_EN_FRASE)
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), 20)).replace(/[,;\s]+$/, '')}…`
}

/** Cierra una oración sin dejar «….»: si ya termina en puntos suspensivos, no suma otro punto. */
const cerrar = (texto: string) => (texto.endsWith('…') ? texto : `${texto}.`)

function porcentajeDe(correctas: number, calificadas: number): number | null {
  return calificadas > 0 ? Math.round((100 * correctas) / calificadas) : null
}

/** «3 de tus 4 alumnos practicaron esta semana.», con el singular y el «todos» bien dichos. */
export function cuantosPracticaron(practicaron: number, total: number): string {
  if (total === 0) return 'Todavía no tenés alumnos en tus grupos.'
  if (practicaron === 0) return 'Nadie practicó todavía. ¿Les reenviás el link?'
  if (total === 1) return 'Tu alumno practicó esta semana.'
  if (practicaron === total) return `Tus ${total} alumnos practicaron esta semana.`
  return `${practicaron} de tus ${total} alumnos ${practicaron === 1 ? 'practicó' : 'practicaron'} esta semana.`
}

/**
 * A quién nombrar en la frase de arriba: alguien con un tema flojo medido.
 * Primero los que practicaron esta semana, el de menor porcentaje (es a quien
 * hay que mirar); si ninguno de ellos tiene tema flojo, el primero que tenga.
 */
function aQuienNombrar(filas: FilaDeLaSemana[]): FilaDeLaSemana | null {
  const conTema = filas.filter((f) => f.temaMasFlojo)
  if (conTema.length === 0) return null
  const practicaron = conTema
    .filter((f) => f.practico)
    .sort((a, b) => (a.porcentaje ?? 101) - (b.porcentaje ?? 101) || a.nombre.localeCompare(b.nombre, 'es'))
  return practicaron[0] ?? conTema[0]
}

export function resumenDeLaSemana(alumnos: readonly AlumnoDeLaSemana[]): ResumenDeLaSemana {
  const filas = alumnos.map((a) => ({
    ...a,
    practico: a.intentos > 0,
    porcentaje: a.intentos > 0 ? porcentajeDe(a.correctas, a.calificadas) : null,
  }))
  const total = filas.length
  const practicaron = filas.filter((f) => f.practico).length
  const nadie = total > 0 && practicaron === 0
  let frase = cuantosPracticaron(practicaron, total)
  const nombrado = nadie ? null : aQuienNombrar(filas)
  if (nombrado?.temaMasFlojo) frase += ` ${cerrar(`A ${primerNombre(nombrado.nombre)} le falta ${temaParaFrase(nombrado.temaMasFlojo)}`)}`
  return { filas, total, practicaron, frase, nadie }
}

/** «12 ejercicios, 58 % bien. Le falta: logaritmos.» — o «no practicó». */
export function renglonDelAlumno(f: FilaDeLaSemana): string {
  const nombre = primerNombre(f.nombre)
  if (!f.practico) return `${nombre}: no practicó.`
  const ejercicios = `${f.ejercicios} ${f.ejercicios === 1 ? 'ejercicio' : 'ejercicios'}`
  const bien = f.porcentaje === null ? '' : `, ${f.porcentaje} % bien`
  const falta = f.temaMasFlojo ? ` ${cerrar(`Le falta: ${temaParaFrase(f.temaMasFlojo)}`)}` : ''
  return `${nombre}: ${ejercicios}${bien}.${falta}`
}

const fecha = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

/** El texto plano para «Copiar resumen»: para pegar en el WhatsApp del profe o mandárselo a quien quiera. */
export function textoParaCopiar(resumen: ResumenDeLaSemana, ahora: Date): string {
  const desde = new Date(ahora.getTime() - DIAS_DE_LA_SEMANA * 24 * 60 * 60 * 1000)
  const renglones = [`Esta semana en MaestrIA (del ${fecha(desde)} al ${fecha(ahora)})`, resumen.frase]
  if (resumen.filas.length > 0) renglones.push('', ...resumen.filas.map(renglonDelAlumno))
  return renglones.join('\n')
}
