/**
 * El mensaje que el docente le manda al alumno cuando la tarea está lista.
 *
 * Es texto para pegar en WhatsApp, así que es puro: sin formato, sin emojis y
 * con el link en su propio renglón para que la app lo vuelva tocable. La
 * regla más importante es NO inventar: no dice "para esta semana" si el
 * docente no puso fecha, ni nombra a un alumno si la tarea va para varios.
 */
import { temaCorto } from '@/lib/alumnos-docente'

export interface DatosDelMensaje {
  /** Nombre del alumno, sólo si la tarea va para una sola persona. */
  nombre: string | null
  /** Los temas de la tarea, tal como están en el temario. */
  temas: string[]
  materia: string
  link: string
  /** Hasta cuándo se puede hacer, si el docente puso fecha. */
  hasta: Date | null
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** "el viernes 12/12": día de la semana para ubicarse, fecha para no confundirse. */
export function fechaParaMensaje(fecha: Date): string {
  return `el ${DIAS[fecha.getDay()]} ${fecha.getDate()}/${fecha.getMonth() + 1}`
}

/** De qué es la tarea, en minúscula y sin vueltas: "límites", "límites y derivadas", o la materia. */
export function deQueEs(temas: string[], materia: string): string {
  const cortos = [...new Set(temas.map((tema) => temaCorto(tema).toLowerCase()).filter(Boolean))]
  if (cortos.length === 1) return cortos[0]
  if (cortos.length === 2) return `${cortos[0]} y ${cortos[1]}`
  // Con tres temas o más la lista no entra en una frase: se nombra la materia.
  return materia
}

export function armarMensaje({ nombre, temas, materia, link, hasta }: DatosDelMensaje): string {
  const primerNombre = nombre?.trim().split(/\s+/)[0]
  const saludo = primerNombre ? `Hola ${primerNombre}` : 'Hola'
  const plazo = hasta ? ` Tenés tiempo hasta ${fechaParaMensaje(hasta)}.` : ''

  return [
    `${saludo}, te dejo la tarea de ${deQueEs(temas, materia)}.${plazo}`,
    link,
    'Entrás con tu nombre, no necesitás cuenta.',
  ].join('\n')
}

/** Link que abre WhatsApp con el mensaje ya escrito, para elegir a quién mandárselo. */
export function linkDeWhatsApp(mensaje: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
}

/**
 * A quién nombrar en el saludo: sólo si en esa materia hay exactamente una
 * persona. Con dos o más, el mismo mensaje va para todos y no lleva nombre.
 */
export function aQuienSaludar(alumnosDeLaMateria: { nombre: string }[]): string | null {
  return alumnosDeLaMateria.length === 1 ? alumnosDeLaMateria[0].nombre : null
}
