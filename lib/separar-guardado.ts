import { LARGO_MAXIMO_DE_TEMA } from './temas-granulares'

/**
 * Ronda T · D2 — Separar en temas lo ya guardado (puro).
 *
 * En *Mis materias*, un tema largo se separa con una propuesta que el docente
 * revisa antes de guardar. **El primer tema conserva el id original**: así no
 * se pierden "A reforzar" ni los diagnósticos que apuntan a ese tema. Los
 * demás reciben ids nuevos, únicos en el programa.
 */
export interface UnidadGuardada {
  id: string
  name: string
  topics: { id: string; name: string; origin?: string; sourceEje?: string }[]
}

/** Los temas largos de un programa, para mostrar "Separar en temas". */
export function temasLargos(unidades: readonly UnidadGuardada[]): { unidadId: string; temaId: string; nombre: string }[] {
  return unidades.flatMap((u) =>
    u.topics.filter((t) => t.name.replace(/\s+/g, ' ').trim().length > LARGO_MAXIMO_DE_TEMA).map((t) => ({ unidadId: u.id, temaId: t.id, nombre: t.name })),
  )
}

/** Lo que manda el docente (revisado): sin vacíos ni repetidos, de 2 a 15, cada uno de hasta 200. */
export function validarPedazos(pedazos: unknown): string[] | null {
  if (!Array.isArray(pedazos)) return null
  const vistos = new Set<string>()
  const limpios = pedazos
    .map((p) => String(p ?? '').replace(/\s+/g, ' ').trim())
    .filter((p) => {
      const clave = p.toLowerCase()
      if (!p || vistos.has(clave)) return false
      vistos.add(clave)
      return true
    })
  if (limpios.length < 2 || limpios.length > 15 || limpios.some((p) => p.length > 200)) return null
  return limpios
}

/** El programa con ese tema reemplazado por los pedazos. null si la unidad o el tema no existen. */
export function aplicarSeparacion<U extends UnidadGuardada>(unidades: U[], unidadId: string, temaId: string, pedazos: string[]): U[] | null {
  const unidad = unidades.find((u) => u.id === unidadId)
  const indice = unidad?.topics.findIndex((t) => t.id === temaId) ?? -1
  if (!unidad || indice < 0) return null
  const original = unidad.topics[indice]
  const usados = new Set(unidades.flatMap((u) => u.topics.map((t) => t.id)))
  const idNuevo = (n: number) => {
    let id = `${temaId}-s${n}`
    let extra = 0
    while (usados.has(id)) id = `${temaId}-s${n}-${++extra}`
    usados.add(id)
    return id
  }
  const nuevos = pedazos.map((name, i) => (i === 0 ? { ...original, name } : { ...original, id: idNuevo(i + 1), name }))
  return unidades.map((u) =>
    u.id === unidadId ? { ...u, topics: [...u.topics.slice(0, indice), ...nuevos, ...u.topics.slice(indice + 1)] } : u,
  )
}
