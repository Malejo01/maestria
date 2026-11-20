import type { ProgramUnit } from '@/lib/types'
import { TAMANO_DE_TAREA } from '@/lib/textos'

/**
 * El diagnóstico inicial (tanda J, J4): cuántas preguntas de cada tema y en
 * cuántos cuestionarios. Es la parte pura, con tests; la generación está en
 * lib/diagnostico-server.ts.
 *
 * El diagnóstico es para saber dónde está el alumno, no para enseñarle: una o
 * dos preguntas por tema, dificultad pareja, sin pistas. Las reglas del encargo:
 *
 *  - Por unidad: un cuestionario por unidad, 1 pregunta por tema; si la unidad
 *    tiene menos de 5 temas, 2 por tema. Mínimo 5, máximo 15 por cuestionario.
 *  - Integral: un solo examen, 1 por tema, máximo 40. Con más de 40 temas,
 *    primero los que le cuestan y después el resto, repartido en proporción a
 *    cada unidad.
 */

export type ModoDiagnostico = 'por_unidad' | 'integral'

export const MIN_POR_CUESTIONARIO = 5
export const MAX_POR_CUESTIONARIO = 15
export const MAX_INTEGRAL = 40
/** Con menos temas que esto, la unidad lleva 2 preguntas por tema. */
export const TEMAS_PARA_UNA_POR_TEMA = 5
/** Minutos por pregunta, para el resumen previo ("unos 45 minutos"). */
export const MINUTOS_POR_PREGUNTA = 1.2

export interface TemaPlaneado {
  id: string
  nombre: string
  preguntas: number
}

export interface CuestionarioPlaneado {
  /** null en el integral. */
  unidadId: string | null
  titulo: string
  temas: TemaPlaneado[]
  total: number
}

const sumar = (temas: TemaPlaneado[]) => temas.reduce((acc, t) => acc + t.preguntas, 0)

/**
 * Elige `cuantos` de una lista en orden, primero los que le cuestan y después
 * el resto repartido parejo a lo largo de la lista (no los primeros N: el
 * diagnóstico tiene que ver toda la unidad).
 */
function elegirParejo<T extends { id: string }>(items: T[], cuantos: number, dificiles: Set<string>): T[] {
  if (items.length <= cuantos) return items
  const primeros = items.filter((t) => dificiles.has(t.id)).slice(0, cuantos)
  const resto = items.filter((t) => !dificiles.has(t.id))
  const faltan = cuantos - primeros.length
  const elegidos = new Set(primeros.map((t) => t.id))
  for (let i = 0; i < faltan; i++) {
    elegidos.add(resto[Math.floor((i * resto.length) / faltan)].id)
  }
  // Se devuelven en el orden del programa.
  return items.filter((t) => elegidos.has(t.id))
}

/** Un cuestionario de una unidad. */
export function planDeUnidad(unidad: ProgramUnit, dificiles: Set<string> = new Set()): CuestionarioPlaneado | null {
  const temas = unidad.topics
  if (temas.length === 0) return null

  const porTema = temas.length < TEMAS_PARA_UNA_POR_TEMA ? 2 : 1
  const elegidos = elegirParejo(temas, Math.floor(MAX_POR_CUESTIONARIO / porTema), dificiles)
  const planeados: TemaPlaneado[] = elegidos.map((t) => ({ id: t.id, nombre: t.name, preguntas: porTema }))

  // Mínimo 5: una unidad de 2 temas (2 × 2 = 4) suma una pregunta más, al que
  // le cuesta si hay, si no al primero. Con 1 tema, ese tema lleva las 5.
  for (let i = 0; sumar(planeados) < MIN_POR_CUESTIONARIO; i++) {
    const dificil = planeados.findIndex((t) => dificiles.has(t.id))
    const destino = dificil >= 0 && i === 0 ? dificil : i % planeados.length
    planeados[destino].preguntas++
  }

  return { unidadId: unidad.id, titulo: unidad.name, temas: planeados, total: sumar(planeados) }
}

/**
 * Reparto proporcional por el método del mayor resto: cada unidad recibe su
 * parte de `cupo` según cuántos temas tiene, y lo que sobra de redondear va a
 * las de mayor resto. Ninguna recibe más temas de los que tiene.
 */
export function repartirProporcional(tamanios: number[], cupo: number): number[] {
  const total = tamanios.reduce((a, b) => a + b, 0)
  if (total === 0 || cupo <= 0) return tamanios.map(() => 0)
  if (cupo >= total) return [...tamanios]
  const exactos = tamanios.map((n) => (n * cupo) / total)
  const partes = exactos.map((x, i) => Math.min(Math.floor(x), tamanios[i]))
  let falta = cupo - partes.reduce((a, b) => a + b, 0)
  const orden = exactos
    .map((x, i) => ({ i, resto: x - Math.floor(x) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)
  while (falta > 0) {
    let avanzo = false
    for (const { i } of orden) {
      if (falta === 0) break
      if (partes[i] < tamanios[i]) {
        partes[i]++
        falta--
        avanzo = true
      }
    }
    if (!avanzo) break
  }
  return partes
}

/** El examen integral: 1 por tema, máximo 40. */
export function planIntegral(unidades: ProgramUnit[], dificiles: Set<string> = new Set()): CuestionarioPlaneado | null {
  const todos = unidades.flatMap((u) => u.topics.map((t) => ({ ...t, unidadId: u.id })))
  if (todos.length === 0) return null

  let elegidos = todos
  if (todos.length > MAX_INTEGRAL) {
    const prioridad = todos.filter((t) => dificiles.has(t.id)).slice(0, MAX_INTEGRAL)
    const quedan = MAX_INTEGRAL - prioridad.length
    const ya = new Set(prioridad.map((t) => t.id))
    const restoPorUnidad = unidades.map((u) => u.topics.filter((t) => !ya.has(t.id)))
    const cupos = repartirProporcional(
      restoPorUnidad.map((r) => r.length),
      quedan,
    )
    restoPorUnidad.forEach((resto, i) => {
      for (const t of elegirParejo(resto, cupos[i], new Set())) ya.add(t.id)
    })
    elegidos = todos.filter((t) => ya.has(t.id))
  }

  const temas = elegidos.map((t) => ({ id: t.id, nombre: t.name, preguntas: 1 }))
  return { unidadId: null, titulo: 'Integral', temas, total: temas.length }
}

/**
 * El plan entero. `unidadesExcluidas` son las que el docente destildó porque
 * el alumno todavía no las vio.
 */
export function planDiagnostico(
  unidades: ProgramUnit[],
  modo: ModoDiagnostico,
  { temasDificiles = [], unidadesExcluidas = [] }: { temasDificiles?: string[]; unidadesExcluidas?: string[] } = {},
): CuestionarioPlaneado[] {
  const dificiles = new Set(temasDificiles)
  const fuera = new Set(unidadesExcluidas)
  const incluidas = unidades.filter((u) => !fuera.has(u.id) && u.topics.length > 0)
  if (modo === 'integral') {
    const plan = planIntegral(incluidas, dificiles)
    return plan ? [plan] : []
  }
  return incluidas.map((u) => planDeUnidad(u, dificiles)).filter((p): p is CuestionarioPlaneado => p !== null)
}

export interface ResumenPlan {
  cuestionarios: number
  preguntas: number
  minutos: number
}

/**
 * Cuánto lleva responder tantas preguntas: 1,2 minutos cada una, redondeado a
 * 5 y nunca menos de 5. La única estimación de tiempo de MaestrIA: la usan el
 * resumen del diagnóstico y la tarjeta de cada tarea (L5).
 */
export function minutosEstimados(preguntas: number): number {
  return preguntas <= 0 ? 0 : Math.max(5, Math.round((preguntas * MINUTOS_POR_PREGUNTA) / 5) * 5)
}

/** "4 cuestionarios · 37 preguntas · unos 45 minutos en total". Los minutos, redondeados a 5. */
export function resumirPlan(plan: CuestionarioPlaneado[]): ResumenPlan {
  const preguntas = plan.reduce((acc, c) => acc + c.total, 0)
  return {
    cuestionarios: plan.length,
    preguntas,
    minutos: minutosEstimados(preguntas),
  }
}

/** L5: "15 preguntas · unos 20 min", para elegir una tarea por su largo. */
export function tamanoDeTarea(preguntas: number): string {
  return TAMANO_DE_TAREA(preguntas, minutosEstimados(preguntas))
}

/**
 * Valida un cuestionario planeado que llega del cliente contra el programa: los
 * temas tienen que ser de esa materia (y de esa unidad, por unidad) y el total
 * no puede pasar los topes. Devuelve el cuestionario saneado o null.
 */
export function validarCuestionario(
  pedido: { unidadId: string | null; temas: { id: string; preguntas: number }[] },
  unidades: ProgramUnit[],
  modo: ModoDiagnostico,
): CuestionarioPlaneado | null {
  const unidad = pedido.unidadId ? unidades.find((u) => u.id === pedido.unidadId) : null
  if (modo === 'por_unidad' && !unidad) return null
  const validos = new Map(
    (unidad ? [unidad] : unidades).flatMap((u) => u.topics.map((t) => [t.id, t.name] as const)),
  )
  const temas: TemaPlaneado[] = []
  for (const t of pedido.temas) {
    const nombre = validos.get(t.id)
    const preguntas = Math.floor(Number(t.preguntas))
    if (!nombre || !(preguntas >= 1 && preguntas <= MAX_POR_CUESTIONARIO)) return null
    if (temas.some((x) => x.id === t.id)) return null
    temas.push({ id: t.id, nombre, preguntas })
  }
  const total = sumar(temas)
  const tope = modo === 'integral' ? MAX_INTEGRAL : MAX_POR_CUESTIONARIO
  if (temas.length === 0 || total > tope) return null
  return { unidadId: unidad?.id ?? null, titulo: unidad?.name ?? 'Integral', temas, total }
}
