/**
 * L3: el teclado matemático. El campo guarda TEXTO PLANO (`2^2·3·5`); esto es
 * sólo la ayuda: qué símbolos ofrece la barra, cuándo aparece y cómo se ve lo
 * escrito con KaTeX. La corrección lee el texto con `leerProducto` y el parser
 * numérico de K1 y K2. Puro y con tests.
 */

export interface Simbolo {
  /** Lo que se ve en el botón. */
  etiqueta: string
  /** Lo que se inserta en el cursor. */
  inserta: string
  /** Dónde queda el cursor, contado desde el principio de lo insertado. */
  cursor: number
}

export const SIMBOLOS: { clave: string; simbolo: Simbolo }[] = [
  { clave: 'producto', simbolo: { etiqueta: '·', inserta: '·', cursor: 1 } },
  // La potencia y la raíz dejan el cursor listo para el exponente o el radicando.
  { clave: 'potencia', simbolo: { etiqueta: 'xⁿ', inserta: '^', cursor: 1 } },
  { clave: 'raiz', simbolo: { etiqueta: '√', inserta: '√()', cursor: 2 } },
  { clave: 'fraccion', simbolo: { etiqueta: '/', inserta: '/', cursor: 1 } },
  { clave: 'parentesis', simbolo: { etiqueta: '( )', inserta: '()', cursor: 1 } },
  { clave: 'pi', simbolo: { etiqueta: 'π', inserta: 'π', cursor: 1 } },
  { clave: 'menos', simbolo: { etiqueta: '−', inserta: '−', cursor: 1 } },
  { clave: 'menorIgual', simbolo: { etiqueta: '≤', inserta: '≤', cursor: 1 } },
  { clave: 'mayorIgual', simbolo: { etiqueta: '≥', inserta: '≥', cursor: 1 } },
  { clave: 'distinto', simbolo: { etiqueta: '≠', inserta: '≠', cursor: 1 } },
]

/** Inserta un símbolo en el texto, en la selección, y dice dónde queda el cursor. */
export function insertar(texto: string, desde: number, hasta: number, simbolo: Simbolo): { texto: string; cursor: number } {
  const a = Math.max(0, Math.min(desde, texto.length))
  const b = Math.max(a, Math.min(hasta, texto.length))
  return { texto: texto.slice(0, a) + simbolo.inserta + texto.slice(b), cursor: a + simbolo.cursor }
}

/** Temas en los que una numérica pide notación: potencias, raíces, factorización. */
const TEMA_CON_NOTACION = /potenci|exponen|ra[ií]z|ra[ií]ces|radic|factoriz|primos/i

/**
 * ¿Va la barra? En respuesta corta, siempre. En una numérica, sólo si la
 * pregunta lo pide (una factorización, una fracción) o el tema lo justifica:
 * en una cuenta simple el alumno escribe el número y listo.
 */
export function llevaBarra(pregunta: {
  type: string
  forma?: unknown
  fraccion?: unknown
  esFactorizacion?: boolean
  topicName?: string
  question?: string
}): boolean {
  if (pregunta.type === 'short_answer') return true
  if (pregunta.type !== 'numeric') return false
  if (pregunta.forma || pregunta.fraccion || pregunta.esFactorizacion) return true
  return TEMA_CON_NOTACION.test(pregunta.topicName ?? '')
}

const SUPERINDICES: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

/** Lee un grupo `(...)` o un número/letra desde `i`; devuelve el contenido y dónde termina. */
function grupo(texto: string, i: number): { contenido: string; fin: number } | null {
  if (texto[i] === '(') {
    let nivel = 0
    for (let j = i; j < texto.length; j++) {
      if (texto[j] === '(') nivel++
      if (texto[j] === ')') nivel--
      if (nivel === 0) return { contenido: texto.slice(i + 1, j), fin: j + 1 }
    }
    return { contenido: texto.slice(i + 1), fin: texto.length }
  }
  const m = /^[0-9a-zA-Zπ.,]+/.exec(texto.slice(i))
  return m ? { contenido: m[0], fin: i + m[0].length } : null
}

function aLatex(texto: string): string {
  let salida = ''
  let i = 0
  while (i < texto.length) {
    const c = texto[i]
    if (c === '^' || c === '√') {
      const g = grupo(texto, i + 1)
      if (!g) {
        salida += c === '^' ? '\\hat{}' : '\\sqrt{}'
        i++
        continue
      }
      salida += c === '^' ? `^{${aLatex(g.contenido)}}` : `\\sqrt{${aLatex(g.contenido)}}`
      i = g.fin
      continue
    }
    if (c === '*' && texto[i + 1] === '*') {
      const g = grupo(texto, i + 2)
      salida += g ? `^{${aLatex(g.contenido)}}` : '\\cdot '
      i = g ? g.fin : i + 2
      continue
    }
    if ('·*×⋅'.includes(c)) salida += ' \\cdot '
    else if (c === 'π') salida += '\\pi '
    else if (c === '≤') salida += ' \\le '
    else if (c === '≥') salida += ' \\ge '
    else if (c === '≠') salida += ' \\ne '
    else if (c === '−') salida += '-'
    else if (SUPERINDICES[c]) {
      let exp = ''
      while (SUPERINDICES[texto[i]]) exp += SUPERINDICES[texto[i++]]
      salida += `^{${exp}}`
      continue
    } else if ('#$%&_{}~\\'.includes(c)) salida += `\\${c === '\\' ? 'backslash ' : c}`
    else salida += c
    i++
  }
  return salida
}

/**
 * Lo escrito, en LaTeX para la vista previa: `2^2·3·5` → `$2^{2} \cdot 3 \cdot 5$`.
 * Entre dígitos, la `x` y el punto son producto (como en la corrección). Las
 * palabras van como texto, con sus espacios. Devuelve null si no hay nada que
 * mostrar distinto de lo escrito (un número solo, una frase sin símbolos).
 */
export function textoALatex(texto: string): string | null {
  const limpio = texto.trim()
  if (!limpio) return null
  if (!/[\^√·*×⋅π≤≥≠−/⁰¹²³⁴⁵⁶⁷⁸⁹]|\d\s*[xX.]\s*\d/.test(limpio)) return null
  const producto = limpio.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1·').replace(/(\d)\s*\.\s*(?=\d)/g, '$1·')
  const partes = producto.split(/\s+/).map((parte) =>
    /^[a-záéíóúñü]{2,}[,.;:]?$/i.test(parte) ? `\\text{${parte}}` : aLatex(parte),
  )
  return `$${partes.join('\\ ')}$`
}

/**
 * Para la IA que corrige una respuesta corta (/api/quiz/grade-short-answer):
 * el alumno escribe con la barra de símbolos o con el teclado común, en
 * texto plano. Sin esto, `2x3` se lee como una incógnita y `2.2.3.5` como un
 * decimal raro.
 */
export const NOTACION_DEL_ALUMNO = `CÓMO ESCRIBE EL ALUMNO (texto plano, no LaTeX):
- "x", "·", "*" y "." entre números enteros significan producto: "2x2x3x5", "2·2·3·5", "2*3" y "2.2.3.5" son productos.
- "^" es potencia ("2^3" es 2 al cubo); también puede usar superíndices ("2³") o "**".
- "√(…)" es raíz cuadrada, "/" es fracción o división, "π" es pi, "−" es menos, y "≤", "≥", "≠" son comparaciones.
- Un conjunto solución se puede escribir de varias formas, todas equivalentes: "x <= 2", "x ≤ 2", "2 >= x", "(-∞; 2]", "(-∞, 2]" y "x menor o igual que 2" son el mismo conjunto.
- Si la respuesta esperada es un conjunto solución (una inecuación), un número solo ("2") NO es correcto: es un valor, no el conjunto.
Evaluá lo que quiso decir con esa notación, no la forma de tipearla.`
