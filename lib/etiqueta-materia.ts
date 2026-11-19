import { extractGradoNumber } from '@/lib/grado'

/**
 * H6: cómo se nombra una materia en un selector o un filtro.
 *
 * Un profesor de secundaria da la misma materia en dos o tres años, y en
 * producción hay un docente con cuatro "Matemática". Las tarjetas de Mis
 * materias muestran nivel y año, pero los filtros mostraban sólo el nombre:
 * "Matemática · Matemática · Matemática", sin forma de saber cuál es cuál.
 *
 * La regla:
 *   - nombre único entre las materias del docente → el nombre, sin nada más;
 *   - nombre repetido → nombre, año y nivel: "Matemática · 3.º Sec.";
 *   - repetido y sin nivel cargado → "Matemática (sin nivel)";
 *   - si aun así dos quedan iguales (mismo nombre, nivel y año), se numeran
 *     en el orden en que llegan: "Matemática · 3.º Sec. (2)".
 *
 * Los nombres se comparan sin mayúsculas, tildes ni espacios de más:
 * "Matematica" y "Matemática" se leen igual en un filtro.
 */
export interface MateriaConNivel {
  id: number | string
  nombre: string
  nivel?: string | null
  grado?: string | null
}

const NIVEL_CORTO: Record<string, string> = {
  primario: 'Prim.',
  secundario: 'Sec.',
  superior: 'Sup.',
}

function clave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** "3.º Sec.", "1.º Sup.", "Sup.", o null si no hay nivel. */
function nivelYAnio(materia: MateriaConNivel): string | null {
  const nivel = materia.nivel?.trim()
  if (!nivel) return null
  const corto = NIVEL_CORTO[clave(nivel)] ?? nivel
  const grado = materia.grado?.trim() ?? ''
  const numero = grado ? extractGradoNumber(grado) : null
  if (numero !== null) return `${numero}.º ${corto}`
  return grado ? `${corto} · ${grado}` : corto
}

/** La etiqueta sin el número de desempate. */
function etiquetaBase(materia: MateriaConNivel, todas: readonly MateriaConNivel[]): string {
  const nombre = materia.nombre.trim()
  const repetida = todas.filter((otra) => clave(otra.nombre) === clave(nombre)).length > 1
  if (!repetida) return nombre
  const detalle = nivelYAnio(materia)
  return detalle ? `${nombre} · ${detalle}` : `${nombre} (sin nivel)`
}

export function etiquetaDeMateria(materia: MateriaConNivel, todasLasMaterias: readonly MateriaConNivel[]): string {
  const todas = todasLasMaterias.some((otra) => otra.id === materia.id) ? todasLasMaterias : [...todasLasMaterias, materia]
  const base = etiquetaBase(materia, todas)
  const iguales = todas.filter((otra) => etiquetaBase(otra, todas) === base)
  if (iguales.length <= 1) return base
  const orden = iguales.findIndex((otra) => otra.id === materia.id)
  return orden <= 0 ? base : `${base} (${orden + 1})`
}

/** Un temario del docente (`TeacherProgram`) en la forma que entiende `etiquetaDeMateria`. */
export function materiaDePrograma(programa: {
  id: number
  subjectName: string
  nivel?: string | null
  grado?: string | null
}): MateriaConNivel {
  return { id: programa.id, nombre: programa.subjectName, nivel: programa.nivel ?? null, grado: programa.grado ?? null }
}

/** Si otro temario de la lista se llama igual que éste. */
export function nombreRepetido(
  programa: { id: number; subjectName: string },
  todos: readonly { id: number; subjectName: string }[],
): boolean {
  return todos.some((otro) => otro.id !== programa.id && clave(otro.subjectName) === clave(programa.subjectName))
}

/**
 * K6: la etiqueta de una materia que llega sólo con id y nombre (de una
 * membresía, de un alumno quitado), buscándola en la lista completa de las
 * materias del docente para saber su nivel y año. Si no está, el nombre.
 */
export function etiquetaPorId(
  materia: { id: number | string; nombre: string },
  todasLasMaterias: readonly MateriaConNivel[],
): string {
  const completa = todasLasMaterias.find((otra) => otra.id === materia.id)
  return completa ? etiquetaDeMateria(completa, todasLasMaterias) : materia.nombre
}
