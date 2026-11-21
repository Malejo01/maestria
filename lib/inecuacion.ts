import { parseNumericAnswer } from './numeric-answer'
import { formatearNumero } from './numeros'

/**
 * M2 · El conjunto solución de una inecuación, escrito de cualquiera de las
 * formas en que lo escribe un alumno.
 *
 * En el cuestionario 41 de producción, "Determine el valor de x que satisface
 * 3x + 4 ≤ 10" esperaba `x <= 2`: quien escribió `x ≤ 2` o `(-∞; 2]` dependía
 * de que la IA lo diera por bueno. Acá se lee cada forma a un intervalo y dos
 * respuestas valen lo mismo si describen el mismo intervalo. Un número solo
 * ("2") NO es un conjunto: no se lee.
 *
 * Formas que entiende:
 *   x <= 2 · x ≤ 2 · x =< 2 · 2 >= x · -1 < x <= 3
 *   (-∞; 2] · (-∞, 2] · (-inf, 2] · ]-∞, 2] · [2; +∞) · (-1; 3]
 *   x menor o igual que 2 · x es mayor a 2 · menor que 2
 *   S = (-∞; 2] · {x ∈ R / x ≤ 2}
 */

export interface Extremo {
  valor: number
  incluido: boolean
}

export interface Intervalo {
  inferior: Extremo | null
  superior: Extremo | null
}

const NUMERO = String.raw`[-−+]?\s*(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|\\frac\{[^}]+\}\{[^}]+\})`
const VARIABLE = String.raw`[a-zA-Z]`

function numero(texto: string): number | null {
  return parseNumericAnswer(texto.replace(/\s+/g, '').replace('−', '-'))
}

/** Símbolos y palabras a una forma única: `<=`, `>=`, `<`, `>`. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/\$/g, '')
    .replace(/\\leq?\b|≤|=<|⩽/g, '<=')
    .replace(/\\geq?\b|≥|=>|⩾/g, '>=')
    .replace(/\\lt\b/g, '<')
    .replace(/\\gt\b/g, '>')
    .replace(/\\infty|∞|\binf(inito)?\b/gi, '∞')
    .replace(/\s+es\s+/gi, ' ')
    .replace(/\b(menor|mayor)\s+o\s+igual\s+(que|a)\b/gi, (_, m: string) => (m.toLowerCase() === 'menor' ? '<=' : '>='))
    .replace(/\b(menor)\s+(que|a)\b/gi, '<')
    .replace(/\b(mayor)\s+(que|a)\b/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Saca envoltorios: "S = …", "{x ∈ R / …}", "x ∈ (…)". */
function desenvolver(texto: string): string {
  let t = texto.trim()
  t = t.replace(/^s\s*=\s*/i, '')
  const llaves = /^\{\s*[a-zA-Z]\s*(∈|\\in)\s*[^/|:]*[/|:]\s*(.+)\}$/.exec(t)
  if (llaves) t = llaves[2]
  t = t.replace(/^[a-zA-Z]\s*(∈|\\in)\s*/, '')
  return t.trim()
}

function porOperador(op: string, valor: number, lado: 'variable-a-la-izquierda' | 'variable-a-la-derecha'): Intervalo {
  // "x <= 2" ≡ "2 >= x": se lleva todo a la variable a la izquierda.
  const efectivo =
    lado === 'variable-a-la-izquierda' ? op : op === '<' ? '>' : op === '>' ? '<' : op === '<=' ? '>=' : '<='
  const incluido = efectivo.endsWith('=')
  return efectivo.startsWith('<')
    ? { inferior: null, superior: { valor, incluido } }
    : { inferior: { valor, incluido }, superior: null }
}

/** Lee una respuesta como intervalo, o `null` si no es un conjunto solución. */
export function leerInecuacion(crudo: unknown): Intervalo | null {
  if (typeof crudo !== 'string' || !crudo.trim()) return null
  const t = desenvolver(normalizar(crudo))

  // a < x <= b
  const doble = new RegExp(`^(${NUMERO})\\s*(<=|<)\\s*${VARIABLE}\\s*(<=|<)\\s*(${NUMERO})$`).exec(t)
  if (doble) {
    const a = numero(doble[1])
    const b = numero(doble[4])
    if (a === null || b === null || a >= b) return null
    return { inferior: { valor: a, incluido: doble[2] === '<=' }, superior: { valor: b, incluido: doble[3] === '<=' } }
  }

  // x <= 2  ·  x < 2 (también "menor que 2" sin la variable)
  const izquierda = new RegExp(`^(?:${VARIABLE}\\s*)?(<=|>=|<|>)\\s*(${NUMERO})$`).exec(t)
  if (izquierda) {
    const v = numero(izquierda[2])
    return v === null ? null : porOperador(izquierda[1], v, 'variable-a-la-izquierda')
  }

  // 2 >= x
  const derecha = new RegExp(`^(${NUMERO})\\s*(<=|>=|<|>)\\s*${VARIABLE}$`).exec(t)
  if (derecha) {
    const v = numero(derecha[1])
    return v === null ? null : porOperador(derecha[2], v, 'variable-a-la-derecha')
  }

  // (-∞; 2]  ·  [2, +∞)  ·  ]-∞, 2]  ·  (-1; 3]
  const intervalo = new RegExp(`^([(\\[\\]])\\s*([-−+]?\\s*∞|${NUMERO})\\s*[;,]\\s*([-−+]?\\s*∞|${NUMERO})\\s*([)\\]\\[])$`).exec(t)
  if (intervalo) {
    const [, abre, desde, hasta, cierra] = intervalo
    const inferior = desde.includes('∞') ? null : numero(desde)
    const superior = hasta.includes('∞') ? null : numero(hasta)
    if (desde.includes('∞') && !/^[-−]/.test(desde.trim())) return null
    if (hasta.includes('∞') && /^[-−]/.test(hasta.trim())) return null
    if ((!desde.includes('∞') && inferior === null) || (!hasta.includes('∞') && superior === null)) return null
    if (inferior === null && superior === null) return null
    if (inferior !== null && superior !== null && inferior >= superior) return null
    return {
      inferior: inferior === null ? null : { valor: inferior, incluido: abre === '[' },
      superior: superior === null ? null : { valor: superior, incluido: cierra === ']' },
    }
  }

  return null
}

const EPSILON = 1e-9

function mismoExtremo(a: Extremo | null, b: Extremo | null): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a.valor - b.valor) < EPSILON && a.incluido === b.incluido
}

export function mismoIntervalo(a: Intervalo, b: Intervalo): boolean {
  return mismoExtremo(a.inferior, b.inferior) && mismoExtremo(a.superior, b.superior)
}

/**
 * ¿La respuesta del alumno es el mismo conjunto que alguna aceptada? `null` si
 * ninguna aceptada es un conjunto o si el alumno no escribió uno (entonces no
 * se puede decir nada desde acá y decide el resto de la corrección).
 */
export function mismaInecuacion(respuesta: string, aceptadas: string[]): boolean | null {
  const esperados = aceptadas.map(leerInecuacion).filter((i): i is Intervalo => i !== null)
  if (esperados.length === 0) return null
  const delAlumno = leerInecuacion(respuesta)
  if (!delAlumno) return null
  return esperados.some((e) => mismoIntervalo(e, delAlumno))
}

/**
 * Las formas con que se acepta un conjunto, para sumarlas a `acceptedAnswers`
 * de lo que se genera (así la IA que corrige también las ve).
 */
export function formasDeInecuacion(intervalo: Intervalo, variable = 'x'): string[] {
  const n = (v: number) => formatearNumero(v)
  const { inferior, superior } = intervalo
  if (inferior && superior) {
    const opA = inferior.incluido ? '<=' : '<'
    const opB = superior.incluido ? '<=' : '<'
    const simbolo = (op: string) => (op === '<=' ? '≤' : '<')
    const abre = inferior.incluido ? '[' : '('
    const cierra = superior.incluido ? ']' : ')'
    return [
      `${n(inferior.valor)} ${opA} ${variable} ${opB} ${n(superior.valor)}`,
      `${n(inferior.valor)} ${simbolo(opA)} ${variable} ${simbolo(opB)} ${n(superior.valor)}`,
      `${abre}${n(inferior.valor)}; ${n(superior.valor)}${cierra}`,
    ]
  }
  if (superior) {
    const op = superior.incluido ? '<=' : '<'
    const simbolo = superior.incluido ? '≤' : '<'
    const inverso = superior.incluido ? '>=' : '>'
    const palabras = superior.incluido ? 'menor o igual que' : 'menor que'
    const cierra = superior.incluido ? ']' : ')'
    return [
      `${variable} ${op} ${n(superior.valor)}`,
      `${variable} ${simbolo} ${n(superior.valor)}`,
      `${n(superior.valor)} ${inverso} ${variable}`,
      `(-∞; ${n(superior.valor)}${cierra}`,
      `(-∞, ${n(superior.valor)}${cierra}`,
      `${variable} ${palabras} ${n(superior.valor)}`,
    ]
  }
  if (inferior) {
    const op = inferior.incluido ? '>=' : '>'
    const simbolo = inferior.incluido ? '≥' : '>'
    const inverso = inferior.incluido ? '<=' : '<'
    const palabras = inferior.incluido ? 'mayor o igual que' : 'mayor que'
    const abre = inferior.incluido ? '[' : '('
    return [
      `${variable} ${op} ${n(inferior.valor)}`,
      `${variable} ${simbolo} ${n(inferior.valor)}`,
      `${n(inferior.valor)} ${inverso} ${variable}`,
      `${abre}${n(inferior.valor)}; +∞)`,
      `${abre}${n(inferior.valor)}, +∞)`,
      `${variable} ${palabras} ${n(inferior.valor)}`,
    ]
  }
  return []
}
