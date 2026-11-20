/**
 * L3: las factorizaciones se corrigen como factorizaciones.
 *
 * Una pregunta `numeric` con `forma: 'factorizacion'` guarda en `correctAnswer`
 * el número (60), y lo que se pide es escribirlo como producto de primos
 * (`2^2·3·5`). Antes la respuesta guardada era el número mismo y la pregunta no
 * se podía responder bien de ninguna forma: `2x2x3x5` no era un número.
 *
 * Puro: no sabe de React ni de la base.
 */

/**
 * Las consignas que piden factorizar. Una `numeric` SIN `forma` cuyo
 * enunciado coincide se corrige igual como factorización: es lo único que
 * hace respondible lo ya generado (la pregunta 8 del cuestionario 32 de
 * producción) sin reescribir datos.
 *
 * Es el del encargo (`/factoriz|descompo\w* en (factores )?primos|producto de
 * (potencias|primos|factores primos)/i`) con dos arreglos: en JavaScript `\w`
 * no incluye las vocales con tilde ("Descomponé", "Descomposición" no
 * coincidían), y entre el verbo y "en primos" puede ir el número
 * ("Descomponé 84 en factores primos").
 */
export const CONSIGNA_DE_FACTORIZACION =
  /factoriz|descompo[\wáéíóúñ]*(?:\s+(?:el\s+)?(?:n[uú]mero\s+)?\d+)?\s+en\s+(?:factores\s+)?primos|producto de (?:potencias|primos|factores primos)/i

export type FormaNumerica = 'factorizacion'

/** ¿Esta pregunta se corrige como factorización? */
export function esFactorizacion(pregunta: { forma?: unknown; question?: unknown }): boolean {
  if (pregunta.forma === 'factorizacion') return true
  if (pregunta.forma !== undefined && pregunta.forma !== null) return false
  return typeof pregunta.question === 'string' && CONSIGNA_DE_FACTORIZACION.test(pregunta.question)
}

export interface Potencia {
  base: number
  exponente: number
}

export interface Producto {
  /** Los factores como los escribió, en orden (`2^2·3·5` → 2², 3, 5). */
  factores: Potencia[]
  valor: number
}

const SUPERINDICES: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

type Token = { tipo: 'numero'; valor: number } | { tipo: '^' | '(' | ')' | '·' }

function tokens(texto: string): Token[] | null {
  const limpio = texto
    .replace(/\$/g, '')
    .replace(/\\(cdot|times)/g, '·')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    // Superíndices Unicode: 2²³ → 2^23.
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) => `^${[...s].map((c) => SUPERINDICES[c]).join('')}`)
    .replace(/\*\*/g, '^')
    .replace(/[x×X*⋅∙•]/g, '·')
    // Entre enteros, el punto es producto: 2.2.3.5 no es un decimal.
    .replace(/(\d)\s*\.\s*(?=\d)/g, '$1·')
    .trim()
  if (!limpio) return null

  const lista: Token[] = []
  let i = 0
  while (i < limpio.length) {
    const c = limpio[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (/\d/.test(c)) {
      let j = i
      while (j < limpio.length && /\d/.test(limpio[j])) j++
      lista.push({ tipo: 'numero', valor: Number(limpio.slice(i, j)) })
      i = j
      continue
    }
    if (c === '^' || c === '(' || c === ')' || c === '·') {
      lista.push({ tipo: c })
      i++
      continue
    }
    return null
  }
  return lista
}

/**
 * Lee un producto de potencias: `2x2x3x5`, `2.2.3.5`, `2^2*3*5`, `2²·3·5`,
 * `5·3·2^2`, `2 2 3 5`, `(2^2)(3)(5)`, `2**2·3·5`. Separadores de producto:
 * `x`, `X`, `×`, `*`, `·`, `.` entre enteros y el espacio; potencias con `^`,
 * superíndices y `**`; paréntesis simples. Un número solo (`60`) también se
 * lee: es un producto de un factor, y la corrección dice que no factoriza.
 * Devuelve null si no es un producto de enteros.
 */
export function leerProducto(texto: string): Producto | null {
  if (typeof texto !== 'string') return null
  const lista = tokens(texto)
  if (!lista || lista.length === 0) return null
  let pos = 0

  // producto := factor (·? factor)*
  function producto(): Potencia[] | null {
    const factores: Potencia[] = []
    let primero = true
    while (pos < lista!.length) {
      const t = lista![pos]
      if (t.tipo === ')') break
      if (!primero && t.tipo === '·') {
        pos++
        if (pos >= lista!.length || lista![pos].tipo === ')' || lista![pos].tipo === '·') return null
      } else if (!primero && t.tipo !== 'numero' && t.tipo !== '(') {
        return null
      }
      const f = factor()
      if (!f) return null
      factores.push(...f)
      primero = false
    }
    return factores.length > 0 ? factores : null
  }

  // factor := (número | '(' producto ')') ('^' exponente)?
  function factor(): Potencia[] | null {
    const t = lista![pos]
    let base: Potencia[] | null = null
    if (t?.tipo === 'numero') {
      base = [{ base: t.valor, exponente: 1 }]
      pos++
    } else if (t?.tipo === '(') {
      pos++
      base = producto()
      if (!base || lista![pos]?.tipo !== ')') return null
      pos++
    } else {
      return null
    }
    if (lista![pos]?.tipo === '^') {
      pos++
      const e = exponente()
      if (e === null) return null
      return base.map((p) => ({ base: p.base, exponente: p.exponente * e }))
    }
    return base
  }

  // exponente := número | '(' número ')'
  function exponente(): number | null {
    const t = lista![pos]
    if (t?.tipo === 'numero') {
      pos++
      return t.valor
    }
    if (t?.tipo === '(' && lista![pos + 1]?.tipo === 'numero' && lista![pos + 2]?.tipo === ')') {
      const valor = (lista![pos + 1] as { valor: number }).valor
      pos += 3
      return valor
    }
    return null
  }

  const factores = producto()
  if (!factores || pos !== lista.length) return null
  const valor = factores.reduce((acc, p) => acc * p.base ** p.exponente, 1)
  return Number.isFinite(valor) ? { factores, valor } : null
}

export function esPrimo(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

export type MotivoDeFactorizacion = 'no_primo' | 'producto_distinto' | 'sin_factorizar' | 'ilegible'

export interface CorreccionDeFactorizacion {
  correcta: boolean
  motivo?: MotivoDeFactorizacion
}

/**
 * Corrige una factorización. Está bien si (1) todos los factores son primos,
 * (2) el producto da `esperado` y (3) hay más de un factor o alguna potencia:
 * escribir `60` solo no es factorizar. El orden no importa.
 *
 * Si está mal, dice por qué, en este orden: no se entiende, escribió el número
 * y no la factorización, el producto no da, hay un factor que no es primo.
 */
export function corregirFactorizacion(texto: string, esperado: number): CorreccionDeFactorizacion {
  const producto = leerProducto(texto)
  if (!producto) return { correcta: false, motivo: 'ilegible' }
  const unSoloFactor = producto.factores.length === 1 && producto.factores[0].exponente === 1
  if (unSoloFactor) return { correcta: false, motivo: producto.valor === esperado ? 'sin_factorizar' : 'producto_distinto' }
  if (producto.valor !== esperado) return { correcta: false, motivo: 'producto_distinto' }
  if (!producto.factores.every((p) => esPrimo(p.base) && p.exponente >= 1)) return { correcta: false, motivo: 'no_primo' }
  return { correcta: true }
}

/** La factorización en primos de un entero mayor que 1, de menor a mayor. */
export function factorizar(n: number): Potencia[] {
  const factores: Potencia[] = []
  let resto = Math.abs(Math.trunc(n))
  for (let d = 2; d * d <= resto; d++) {
    let exponente = 0
    while (resto % d === 0) {
      resto /= d
      exponente++
    }
    if (exponente > 0) factores.push({ base: d, exponente })
  }
  if (resto > 1) factores.push({ base: resto, exponente: 1 })
  return factores
}

/** Potencias en LaTeX: `2^{2} \cdot 3 \cdot 5`. */
export function potenciasEnLatex(factores: Potencia[]): string {
  return factores.map((p) => (p.exponente === 1 ? `${p.base}` : `${p.base}^{${p.exponente}}`)).join(' \\cdot ')
}

/** La respuesta correcta de una factorización, para KaTeX: `$2^{2} \cdot 3 \cdot 5$`. */
export function factorizacionEnLatex(n: number): string {
  const factores = factorizar(n)
  return factores.length > 0 ? `$${potenciasEnLatex(factores)}$` : `$${n}$`
}

/** Lo que escribió el alumno, como lo escribió pero prolijo: `2x2x3x5` → `$2 \cdot 2 \cdot 3 \cdot 5$`. */
export function productoEscrito(texto: string): string | null {
  const producto = leerProducto(texto)
  return producto ? `$${potenciasEnLatex(producto.factores)}$` : null
}

/** Qué le decimos al alumno cuando la factorización está mal. */
export function textoDeFactorizacion(motivo: MotivoDeFactorizacion, esperado: number): string {
  switch (motivo) {
    case 'no_primo':
      return 'Hay un factor que no es primo: seguí descomponiéndolo.'
    case 'sin_factorizar':
      return `Escribiste el número, no la factorización: hay que escribir ${esperado} como producto de primos.`
    case 'producto_distinto':
      return `Ese producto no da ${esperado}.`
    case 'ilegible':
      return 'No entendimos el producto. Escribilo con · o x entre los factores y ^ para las potencias: 2^2·3·5.'
  }
}
