import type { Caracter } from './areas'

/**
 * Ronda T · A5 — ¿La pregunta encaja con el carácter de su unidad?
 *
 * En una unidad **conceptual** (Antropología, Psicología, la parte de
 * enseñanza de una didáctica) no van: LaTeX, una pregunta `numeric`, ni una
 * consigna que pide hacer una cuenta. Es el síntoma del reporte de Silvana
 * ("se le fue mucho a la rama de matemáticas").
 *
 * Al generar, la pregunta marcada se descarta y se pide otra (como M2). En lo
 * ya guardado, lo lista `scripts/qa/tipos-incoherentes.ts`. En una unidad
 * cuantitativa o mixta no se marca nada.
 */
export type ProblemaDeArea = 'latex-en-conceptual' | 'numerica-en-conceptual' | 'calculo-en-conceptual'

export const MOTIVO_DE_AREA: Record<ProblemaDeArea, string> = {
  'latex-en-conceptual': 'fórmulas o LaTeX en una unidad conceptual',
  'numerica-en-conceptual': 'pregunta numérica en una unidad conceptual',
  'calculo-en-conceptual': 'pide una cuenta en una unidad conceptual',
}

export interface PreguntaParaValidarArea {
  type?: unknown
  question?: unknown
  options?: unknown
}

/** LaTeX: $…$ con algo adentro, o un comando (\frac, \sqrt…). */
const LATEX = /\$[^$\s][^$]*\$|\\(frac|sqrt|cdot|times|sum|int|lim|wedge|vee|neg|rightarrow|leq|geq|neq|pi|alpha|beta)\b/

/**
 * Consignas que piden una cuenta: "calculá", "resolvé la ecuación", "¿cuánto
 * es…?", "hallá el valor", "¿cuántos/as … hay/quedan/son?" con números en la
 * consigna, un porcentaje de algo.
 */
const CALCULO =
  /\b(calcul(a|á|e|en|ar)|resolv(e|é|ed)\s+(la|el|las|los)?\s*(ecuaci|inecuaci|sistema|cuenta|operaci)|hall(a|á|e)\s+(el|la)\s+(valor|resultado)|efectu(a|á)\s+la\s+operaci|despej(a|á|e)\b)/i
const CUANTO_ES = /¿\s*cu[aá]nto\s+(es|da|vale|resulta|suman?)\b/i
const OPERACION_NUMERICA = /\d\s*[+\-×x*/÷^]\s*\d/

export function problemaDeArea(pregunta: PreguntaParaValidarArea, caracter: Caracter): ProblemaDeArea | null {
  if (caracter !== 'conceptual') return null
  if (pregunta.type === 'numeric') return 'numerica-en-conceptual'

  const consigna = typeof pregunta.question === 'string' ? pregunta.question : ''
  const opciones = Array.isArray(pregunta.options) ? pregunta.options.filter((o): o is string => typeof o === 'string') : []
  if (LATEX.test(consigna) || opciones.some((o) => LATEX.test(o))) return 'latex-en-conceptual'
  if (CALCULO.test(consigna) || CUANTO_ES.test(consigna) || OPERACION_NUMERICA.test(consigna)) return 'calculo-en-conceptual'
  return null
}
