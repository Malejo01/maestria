/**
 * Ronda W · W5 — La respuesta larga (ensayo) con corrección asistida.
 *
 * Es el único tipo que **no se corrige solo**:
 *   1. el alumno escribe; mientras tanto ve "En corrección";
 *   2. la IA sugiere, criterio por criterio de la rúbrica, un nivel y una
 *      devolución, y una nota;
 *   3. el docente la confirma o la cambia; recién ahí el alumno la ve.
 *
 * La rúbrica tiene de 3 a 5 criterios: los escribe el docente o los propone la
 * IA y el docente los edita.
 *
 * Todo esto es puro.
 */

export const MINIMO_CRITERIOS = 3
export const MAXIMO_CRITERIOS = 5
export const LARGO_MAXIMO_RESPUESTA = 6000
export const LARGO_MAXIMO_DEVOLUCION = 600

export const NIVELES = ['logrado', 'parcial', 'no_logrado'] as const
export type Nivel = (typeof NIVELES)[number]
const PESO_DEL_NIVEL: Record<Nivel, number> = { logrado: 1, parcial: 0.5, no_logrado: 0 }

export interface CriterioDeRubrica {
  criterio: string
}

export interface CorreccionDeCriterio {
  criterio: string
  nivel: Nivel
  devolucion: string
}

export interface Correccion {
  criterios: CorreccionDeCriterio[]
  /** De 0 a 10, con un decimal. */
  nota: number
  /** La devolución general para el alumno. */
  devolucion: string
}

/** Una rúbrica que sirve: de 3 a 5 criterios con texto, distintos. */
export function rubricaValida(rubrica: unknown): rubrica is CriterioDeRubrica[] {
  if (!Array.isArray(rubrica) || rubrica.length < MINIMO_CRITERIOS || rubrica.length > MAXIMO_CRITERIOS) return false
  const textos = rubrica.map((c) => (typeof c?.criterio === 'string' ? c.criterio.trim().toLowerCase() : ''))
  return textos.every((t) => t.length >= 3 && t.length <= 200) && new Set(textos).size === textos.length
}

/** Limpia la rúbrica que escribió el docente (o la IA): sin vacíos, sin repetidos, con tope. */
export function limpiarRubrica(crudos: unknown): CriterioDeRubrica[] {
  if (!Array.isArray(crudos)) return []
  const vistos = new Set<string>()
  const salida: CriterioDeRubrica[] = []
  for (const c of crudos) {
    const texto = String(typeof c === 'string' ? c : (c as CriterioDeRubrica)?.criterio ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200)
    if (texto.length < 3 || vistos.has(texto.toLowerCase())) continue
    vistos.add(texto.toLowerCase())
    salida.push({ criterio: texto })
    if (salida.length === MAXIMO_CRITERIOS) break
  }
  return salida
}

/** La nota que sale de los niveles: cada criterio pesa igual (logrado 1, parcial ½). */
export function notaDeLosCriterios(criterios: readonly { nivel: Nivel }[]): number {
  if (criterios.length === 0) return 0
  const suma = criterios.reduce((s, c) => s + PESO_DEL_NIVEL[c.nivel], 0)
  return Math.round((suma / criterios.length) * 100) / 10
}

/**
 * Lo que devolvió la IA, ya validado contra la rúbrica: un criterio por cada
 * uno de la rúbrica (en el mismo orden), con un nivel válido. Si la IA dio una
 * nota, se respeta si está dentro de 1,5 puntos de la que sale de los niveles;
 * si no, manda la de los niveles.
 */
export function sugerenciaValida(cruda: unknown, rubrica: readonly CriterioDeRubrica[]): Correccion | null {
  const c = cruda as { criterios?: unknown; nota?: unknown; devolucion?: unknown } | null
  if (!c || !Array.isArray(c.criterios) || c.criterios.length !== rubrica.length) return null
  const criterios: CorreccionDeCriterio[] = []
  for (const [i, x] of (c.criterios as { nivel?: unknown; devolucion?: unknown }[]).entries()) {
    if (!(NIVELES as readonly string[]).includes(String(x?.nivel))) return null
    criterios.push({ criterio: rubrica[i].criterio, nivel: x.nivel as Nivel, devolucion: String(x.devolucion ?? '').trim().slice(0, LARGO_MAXIMO_DEVOLUCION) })
  }
  const deLosNiveles = notaDeLosCriterios(criterios)
  const dada = Number(c.nota)
  const nota = Number.isFinite(dada) && dada >= 0 && dada <= 10 && Math.abs(dada - deLosNiveles) <= 1.5 ? Math.round(dada * 10) / 10 : deLosNiveles
  return { criterios, nota, devolucion: String(c.devolucion ?? '').trim().slice(0, LARGO_MAXIMO_DEVOLUCION) }
}

/** La corrección que confirma el docente: nota entre 0 y 10 y la devolución con tope. */
export function correccionConfirmada(cruda: unknown, rubrica: readonly CriterioDeRubrica[]): Correccion | null {
  const c = cruda as { criterios?: unknown; nota?: unknown; devolucion?: unknown } | null
  const nota = Number(c?.nota)
  if (!c || !Number.isFinite(nota) || nota < 0 || nota > 10) return null
  const criterios = Array.isArray(c.criterios)
    ? (c.criterios as { nivel?: unknown; devolucion?: unknown }[]).slice(0, rubrica.length).flatMap((x, i) =>
        (NIVELES as readonly string[]).includes(String(x?.nivel))
          ? [{ criterio: rubrica[i].criterio, nivel: x.nivel as Nivel, devolucion: String(x.devolucion ?? '').trim().slice(0, LARGO_MAXIMO_DEVOLUCION) }]
          : [],
      )
    : []
  return { criterios, nota: Math.round(nota * 10) / 10, devolucion: String(c.devolucion ?? '').trim().slice(0, LARGO_MAXIMO_DEVOLUCION) }
}

/** Una pregunta de ensayo bien armada: consigna y rúbrica válida. */
export function ensayoValido(q: { question?: unknown; rubrica?: unknown }): boolean {
  return typeof q.question === 'string' && q.question.trim().length >= 10 && rubricaValida(q.rubrica)
}

/** El texto del alumno, limpio y con tope. */
export function limpiarRespuesta(texto: unknown): string {
  return String(texto ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, LARGO_MAXIMO_RESPUESTA)
}
