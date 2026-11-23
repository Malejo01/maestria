/**
 * Ronda T · F7 — Evaluar la fórmula de una pregunta calculada, SIN `eval` ni
 * `Function`: un analizador propio que sólo entiende lo que Moodle entiende en
 * una calculada, así lo que corrige MaestrIA es lo mismo que corrige Moodle.
 *
 *   números (con punto), {comodines}, + − * /, paréntesis, menos unario y
 *   las funciones pow(a, b), sqrt, abs, round(x[, decimales]), floor, ceil,
 *   exp, log (natural), log10, sin, cos, tan (en radianes), min, max, pi().
 *
 * No hay `^`: en Moodle (PHP) no es potencia. Para potencias, pow(a, b).
 * Cualquier otra cosa (una letra suelta, una función desconocida, un comodín
 * sin valor, una división por cero) es un error: nunca un número inventado.
 */

type Token =
  | { t: 'num'; v: number }
  | { t: 'var'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' }
  | { t: '('; v: '(' }
  | { t: ')'; v: ')' }
  | { t: ','; v: ',' }

export class ErrorDeFormula extends Error {}

const FUNCIONES: Record<string, { args: [number, number]; f: (...x: number[]) => number }> = {
  pow: { args: [2, 2], f: (a, b) => Math.pow(a, b) },
  sqrt: { args: [1, 1], f: (a) => Math.sqrt(a) },
  abs: { args: [1, 1], f: (a) => Math.abs(a) },
  round: { args: [1, 2], f: (a, d = 0) => Math.round(a * 10 ** d) / 10 ** d },
  floor: { args: [1, 1], f: (a) => Math.floor(a) },
  ceil: { args: [1, 1], f: (a) => Math.ceil(a) },
  exp: { args: [1, 1], f: (a) => Math.exp(a) },
  log: { args: [1, 1], f: (a) => Math.log(a) },
  log10: { args: [1, 1], f: (a) => Math.log10(a) },
  sin: { args: [1, 1], f: (a) => Math.sin(a) },
  cos: { args: [1, 1], f: (a) => Math.cos(a) },
  tan: { args: [1, 1], f: (a) => Math.tan(a) },
  min: { args: [2, 10], f: (...x) => Math.min(...x) },
  max: { args: [2, 10], f: (...x) => Math.max(...x) },
  pi: { args: [0, 0], f: () => Math.PI },
}

function tokenizar(formula: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < formula.length) {
    const c = formula[i]
    if (/\s/.test(c)) {
      i++
    } else if (/[0-9.]/.test(c)) {
      const m = formula.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i)
      if (!m) throw new ErrorDeFormula(`Número mal escrito cerca de "${formula.slice(i, i + 6)}"`)
      tokens.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
    } else if (c === '{') {
      const fin = formula.indexOf('}', i)
      const nombre = fin === -1 ? '' : formula.slice(i + 1, fin)
      if (!/^[a-z][a-z0-9_]*$/i.test(nombre)) throw new ErrorDeFormula(`Comodín mal escrito cerca de "${formula.slice(i, i + 8)}"`)
      tokens.push({ t: 'var', v: nombre })
      i = fin + 1
    } else if (/[a-z]/i.test(c)) {
      const m = formula.slice(i).match(/^[a-z][a-z0-9]*/i)!
      const nombre = m[0].toLowerCase()
      if (!(nombre in FUNCIONES)) throw new ErrorDeFormula(`Función desconocida: ${m[0]}`)
      tokens.push({ t: 'fn', v: nombre })
      i += m[0].length
    } else if ('+-*/'.includes(c)) {
      tokens.push({ t: 'op', v: c as '+' | '-' | '*' | '/' })
      i++
    } else if (c === '(' || c === ')' || c === ',') {
      tokens.push({ t: c, v: c } as Token)
      i++
    } else if (c === '^') {
      throw new ErrorDeFormula('En Moodle "^" no es potencia: usá pow(a, b).')
    } else {
      throw new ErrorDeFormula(`Carácter no permitido: "${c}"`)
    }
  }
  return tokens
}

/** Los comodines que usa la fórmula, sin repetir, en orden de aparición. */
export function comodinesDe(formula: string): string[] {
  return [...new Set([...formula.matchAll(/\{([a-z][a-z0-9_]*)\}/gi)].map((m) => m[1]))]
}

/** El valor de la fórmula con esos valores. Lanza ErrorDeFormula si algo no cierra. */
export function evaluarFormula(formula: string, valores: Record<string, number>): number {
  const tokens = tokenizar(formula)
  let p = 0
  const ver = () => tokens[p]
  const tomar = () => tokens[p++]

  function expresion(): number {
    let v = termino()
    while (ver()?.t === 'op' && (ver()!.v === '+' || ver()!.v === '-')) {
      const op = tomar().v
      const d = termino()
      v = op === '+' ? v + d : v - d
    }
    return v
  }
  function termino(): number {
    let v = factor()
    while (ver()?.t === 'op' && (ver()!.v === '*' || ver()!.v === '/')) {
      const op = tomar().v
      const d = factor()
      if (op === '/' && d === 0) throw new ErrorDeFormula('División por cero.')
      v = op === '*' ? v * d : v / d
    }
    return v
  }
  function factor(): number {
    const tk = ver()
    if (tk?.t === 'op' && (tk.v === '-' || tk.v === '+')) {
      tomar()
      const v = factor()
      return tk.v === '-' ? -v : v
    }
    return primario()
  }
  function primario(): number {
    const tk = tomar()
    if (!tk) throw new ErrorDeFormula('La fórmula termina antes de tiempo.')
    if (tk.t === 'num') return tk.v
    if (tk.t === 'var') {
      const v = valores[tk.v]
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new ErrorDeFormula(`El comodín {${tk.v}} no tiene valor.`)
      return v
    }
    if (tk.t === '(') {
      const v = expresion()
      if (tomar()?.t !== ')') throw new ErrorDeFormula('Falta cerrar un paréntesis.')
      return v
    }
    if (tk.t === 'fn') {
      if (tomar()?.t !== '(') throw new ErrorDeFormula(`Después de ${tk.v} va un paréntesis.`)
      const args: number[] = []
      if (ver()?.t !== ')') {
        args.push(expresion())
        while (ver()?.t === ',') {
          tomar()
          args.push(expresion())
        }
      }
      if (tomar()?.t !== ')') throw new ErrorDeFormula(`Falta cerrar el paréntesis de ${tk.v}.`)
      const { args: [min, max], f } = FUNCIONES[tk.v]
      if (args.length < min || args.length > max) throw new ErrorDeFormula(`${tk.v} lleva ${min === max ? min : `de ${min} a ${max}`} argumentos.`)
      return f(...args)
    }
    throw new ErrorDeFormula('La fórmula está mal armada.')
  }

  const valor = expresion()
  if (p !== tokens.length) throw new ErrorDeFormula('Sobra algo al final de la fórmula.')
  if (!Number.isFinite(valor)) throw new ErrorDeFormula('La fórmula no da un número (por ejemplo, raíz de un negativo).')
  return valor
}
