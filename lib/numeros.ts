/**
 * K1: cómo se MUESTRA un número en MaestrIA. Una sola función para todo lo que
 * ve un alumno o un docente: coma decimal, punto de miles, como máximo cuatro
 * decimales y sin ceros sobrantes. `0.9166666666666666` → `0,9167`.
 *
 * Cómo se LEE lo que escribe el alumno es de `lib/numeric-answer.ts`; las dos
 * reglas están pensadas juntas: todo lo que mostramos vuelve a entrar igual
 * (`12.500` se lee 12500, `0,75` y `0.75` se leen 0,75).
 *
 * Lo único que no pasa por acá es la exportación a Moodle: el formato GIFT
 * exige punto decimal en las respuestas numéricas (`{#0.75:0.01}`).
 */

import { fraccionEnLatex, leerRespuesta } from '@/lib/fraccion'
import { esFactorizacion, factorizacionEnLatex, leerProducto, productoEscrito } from '@/lib/factorizacion'

const MAX_DECIMALES = 4

const conDecimales = new Map<string, Intl.NumberFormat>()
function formato(min: number, max: number): Intl.NumberFormat {
  const clave = `${min}-${max}`
  let f = conDecimales.get(clave)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', { minimumFractionDigits: min, maximumFractionDigits: max })
    conDecimales.set(clave, f)
  }
  return f
}

/**
 * Para un valor muy chico (0,00001), cuatro decimales imprimirían "0", que es
 * mentirle al lector sobre el número. Ahí se muestran cuatro cifras
 * significativas.
 */
const chico = new Intl.NumberFormat('es-AR', { maximumSignificantDigits: 4 })

export interface OpcionesDeNumero {
  /** Decimales fijos (una nota: `7,0`). Sin esto: hasta cuatro, sin ceros de más. */
  decimales?: number
}

export function formatearNumero(n: number, opciones: OpcionesDeNumero = {}): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  if (opciones.decimales !== undefined) return formato(opciones.decimales, opciones.decimales).format(n)
  if (n !== 0 && Math.abs(n) < 10 ** -MAX_DECIMALES) return chico.format(n)
  const texto = formato(0, MAX_DECIMALES).format(n)
  // `-0,00001` redondeado a cuatro decimales da "-0".
  return texto === '-0' ? '0' : texto
}

/**
 * Un número escrito en un texto de la IA (enunciado, opción, explicación) con
 * punto decimal. Sólo se toca un punto entre dígitos que no sea parte de una
 * cadena (`1.2.3`, `192.168.0.1`, una fecha `19.11.2026`) y que no sea
 * ambiguo: `1.500` con tres cifras después del punto es, en un texto en
 * español, mil quinientos, así que queda como está.
 */
const DECIMAL_CON_PUNTO = /(?<![\d.,])(-?)(\d+)\.(\d+)(?![\d]|[.,]\d)/g

/**
 * Pasa a coma decimal los números con punto de un texto generado. Respeta lo
 * que está entre comillas invertidas (código: `x = 3.14` en un ejercicio de
 * programación es punto). Dentro de una fórmula (`$…$`) la coma va como `{,}`
 * para que KaTeX no le agregue el espacio de un signo de puntuación.
 *
 * Un decimal largo de máquina (`0.9166666666666666`, ocho cifras o más) se
 * redondea con `formatearNumero`: nadie lo escribió así a propósito.
 */
export function comaDecimal(texto: string): string {
  if (typeof texto !== 'string' || !texto.includes('.')) return texto
  return texto
    .split(/(`[^`]*`)/)
    .map((tramo) => {
      if (tramo.startsWith('`') && tramo.endsWith('`') && tramo.length > 1) return tramo
      return tramo
        .split(/(\$\$[\s\S]*?\$\$|\$(?:\\[$]|[^$])+?\$)/)
        .map((parte) => {
          const esFormula = parte.startsWith('$') && parte.endsWith('$') && parte.length > 1
          return parte.replace(DECIMAL_CON_PUNTO, (todo, signo: string, entera: string, decimal: string) => {
            if (decimal.length === 3 && entera !== '0' && entera.length <= 3) return todo
            let resultado: string
            if (decimal.length >= 8) {
              resultado = formatearNumero(Number(`${signo}${entera}.${decimal}`))
            } else {
              resultado = `${signo}${entera},${decimal}`
            }
            return esFormula ? resultado.replace(/,/g, '{,}') : resultado
          })
        })
        .join('')
    })
    .join('')
}

/**
 * La respuesta correcta de una pregunta numérica, como se le muestra al
 * docente o al alumno: `0,75`, o `3,5 (± 0,1)` si la pregunta trae margen.
 */
export function respuestaNumerica(
  correcta: number,
  tolerancia?: number | null,
  fraccion?: { numerador: number; denominador: number } | null,
): string {
  // K2: si la respuesta es una fracción, se muestra como fracción (KaTeX).
  if (fraccion && Number.isInteger(fraccion.numerador) && Number.isInteger(fraccion.denominador) && fraccion.denominador !== 0) {
    return fraccionEnLatex(fraccion)
  }
  const valor = formatearNumero(Number(correcta))
  return typeof tolerancia === 'number' && tolerancia > 0 ? `${valor} (± ${formatearNumero(tolerancia)})` : valor
}

/**
 * La respuesta correcta de una numérica, lista para KaTeX. L3: una
 * factorización va como producto de potencias (`2^{2} \cdot 3 \cdot 5`), también
 * las guardadas sin `forma` cuya consigna pide factorizar.
 */
export function respuestaCorrectaNumerica(pregunta: {
  correctAnswer: number
  tolerance?: number | null
  fraccion?: { numerador: number; denominador: number } | null
  forma?: unknown
  question?: unknown
}): string {
  if (esFactorizacion(pregunta)) return factorizacionEnLatex(Number(pregunta.correctAnswer))
  return respuestaNumerica(Number(pregunta.correctAnswer), pregunta.tolerance, pregunta.fraccion)
}

/**
 * K2: la respuesta del alumno como la escribió cuando es una fracción (`6/8`
 * se muestra `\frac{6}{8}`, no `0,75`: si no la simplificó, tiene que verse).
 * Sin texto guardado (las respuestas de antes) o con un decimal, el número.
 */
export function respuestaEscrita(valor: number, texto?: string | null): string {
  if (typeof texto === 'string' && texto.trim()) {
    const lectura = leerRespuesta(texto, { admiteMixto: true })
    // L3: lo que no es un número pero sí un producto (`2x2x3x5`, `2.2.3.5`)
    // se muestra como producto, no como 60. Primero el número: `0.75` es 0,75.
    if (!lectura) {
      const producto = leerProducto(texto)
      if (producto && (producto.factores.length > 1 || producto.factores[0].exponente > 1)) return productoEscrito(texto) ?? texto
    }
    if (lectura?.fraccion) return lectura.mixto ? texto.trim().replace(/\s+/g, ' ') : fraccionEnLatex(lectura.fraccion)
  }
  return formatearNumero(valor)
}
