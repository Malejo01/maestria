import type { DatosFicha, MateriaConTemas } from '@/lib/fichas'

/**
 * J3: lo que de la ficha del alumno llega a la IA, y nada más.
 *
 * El sentido de la ficha es que lo que genera MaestrIA se parezca al examen
 * real del alumno. Pero a la IA va SÓLO lo pedagógico: edad, año, orientación,
 * cómo lo evalúan y los temas que le cuestan. El nombre, el contacto, el adulto
 * responsable y la institución no salen nunca: este tipo no tiene dónde
 * guardarlos, así que no hay forma de que un cambio futuro los cuele por
 * descuido en el prompt.
 */
export interface PerfilAlumnos {
  edades: number[]
  anios: string[]
  orientaciones: string[]
  /** Uno solo: el del curso (los alumnos de un grupo son del mismo curso). */
  comoEvalua: string | null
  /** Nombres de los temas que les cuestan, sumados entre todos. */
  temasDificiles: string[]
}

const unicos = (valores: string[]) => [...new Set(valores.map((v) => v.trim()).filter(Boolean))]

/**
 * Combina las fichas de los alumnos de un grupo (1 a 3 en clases
 * particulares). Los temas que les cuestan se suman; las edades, años y
 * orientaciones se juntan sin repetir; "cómo evalúa" se toma de una ficha que
 * tenga elegida ESA materia (son del mismo curso), y si ninguna la eligió, de
 * la primera que lo diga. Devuelve null si ninguna ficha aporta nada.
 */
export function combinarFichas(fichas: DatosFicha[], materia: MateriaConTemas): PerfilAlumnos | null {
  const nombreDeTema = new Map(materia.unidades.flatMap((u) => u.topics.map((t) => [t.id, t.name] as const)))

  const deEstaMateria = fichas.filter((f) => f.materiaId === materia.id)
  const comoEvalua =
    deEstaMateria.find((f) => f.comoEvalua.trim())?.comoEvalua.trim() ??
    fichas.find((f) => f.comoEvalua.trim())?.comoEvalua.trim() ??
    null

  const temas = unicos(
    deEstaMateria.flatMap((f) => f.temasDificiles.map((id) => nombreDeTema.get(id) ?? '')),
  )

  const perfil: PerfilAlumnos = {
    edades: [...new Set(fichas.map((f) => f.edad).filter((e): e is number => e !== null))].sort((a, b) => a - b),
    anios: unicos(fichas.map((f) => f.anioCursa)),
    orientaciones: unicos(fichas.map((f) => f.orientacion)),
    comoEvalua,
    temasDificiles: temas,
  }

  const vacio =
    perfil.edades.length === 0 &&
    perfil.anios.length === 0 &&
    perfil.orientaciones.length === 0 &&
    !perfil.comoEvalua &&
    perfil.temasDificiles.length === 0
  return vacio ? null : perfil
}

/** Un texto escrito por el docente, de una sola línea y acotado, para citarlo en el prompt. */
function citar(texto: string, max = 400): string {
  const limpio = texto.replace(/\s+/g, ' ').replace(/"/g, "'").trim()
  return limpio.length > max ? `${limpio.slice(0, max)}…` : limpio
}

/**
 * La sección del prompt. Los temas que le cuestan van con más peso: si están
 * entre los pedidos, la IA les dedica más preguntas. "Cómo lo evalúan" define
 * el formato, no el contenido: el temario sigue mandando.
 */
export function seccionPerfilAlumnos(perfil: PerfilAlumnos | null | undefined): string {
  if (!perfil) return ''
  const lineas: string[] = []
  if (perfil.edades.length > 0) lineas.push(`- Edad: ${perfil.edades.join(' y ')} años.`)
  if (perfil.anios.length > 0) lineas.push(`- Año que cursa: ${perfil.anios.map((a) => citar(a, 80)).join(' / ')}.`)
  if (perfil.orientaciones.length > 0) {
    lineas.push(`- Orientación del colegio o carrera: ${perfil.orientaciones.map((o) => citar(o, 80)).join(' / ')}. Cuando el tema lo admita, situá algunos enunciados en ese campo.`)
  }
  if (perfil.comoEvalua) {
    lineas.push(`- Cómo toma examen su profesor, en palabras del docente particular: "${citar(perfil.comoEvalua)}". Imitá ese formato y esa exigencia (tipo de ejercicio, si hay o no calculadora, si pide demostrar), sin salirte de los temas pedidos.`)
  }
  if (perfil.temasDificiles.length > 0) {
    lineas.push(
      `- TEMAS QUE LE CUESTAN (prioridad alta): ${perfil.temasDificiles.map((t) => citar(t, 120)).join('; ')}. Si alguno está entre los temas pedidos, dedicale más preguntas que al resto y usá distractores con los errores típicos de ese tema.`,
    )
  }
  if (lineas.length === 0) return ''
  return `
EL ALUMNO REAL (FICHA DEL DOCENTE PARTICULAR):
Este cuestionario es para un alumno particular que prepara un examen concreto. Ajustate a esto:
${lineas.join('\n')}`
}
