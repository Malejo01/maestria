/**
 * Ronda U · U3 — Validadores de calidad de los tipos como en Moodle.
 *
 * Misma idea que M2 (`lib/validar-tipo-de-pregunta.ts`): al generar, una
 * pregunta que no pasa se descarta y el bucle pide otra; los scripts de QA
 * (`scripts/qa/tipos-moodle-calidad.ts`) listan las guardadas que no pasan.
 *
 * `problemaDeTipoMoodle` (F2 a F7) mira la forma: que se pueda mostrar y
 * corregir. Esto mira si la pregunta **sirve**: pares que no se confunden, un
 * orden que no admite dos respuestas, distractores que no son la misma
 * palabra, una calculada que da números razonables con cualquier valor.
 *
 * "Sinónimo" acá es aproximado, sin diccionario: la misma palabra con otra
 * tilde, mayúscula, artículo, plural o género, o una diferencia de una letra
 * (`pareceLaMisma`). Los sinónimos de verdad ("auto" / "coche") no se ven.
 *
 * Todo es puro.
 */
import { comodinesDe, evaluarFormula } from '@/lib/evaluar-formula'
import { aleatorioConSemilla } from '@/lib/calculada'
import { partesDelTexto } from '@/lib/tipos-moodle'

export type ProblemaDeCalidad =
  | 'emparejamiento-cantidad'
  | 'emparejamiento-repetido'
  | 'emparejamiento-par-igual'
  | 'ordenamiento-sin-criterio'
  | 'ordenamiento-intercambiable'
  | 'huecos-sin-respuesta'
  | 'huecos-sinonimo'
  | 'palabra-faltante-sinonimo'
  | 'calculada-formula'
  | 'calculada-comodines'
  | 'calculada-valores'
  | 'calculada-correcta'
  | 'varias-correctas-cantidad'
  | 'varias-correctas-repetida'

export const MOTIVO_DE_CALIDAD: Record<ProblemaDeCalidad, string> = {
  'emparejamiento-cantidad': 'emparejamiento sin 3 a 6 pares',
  'emparejamiento-repetido': 'emparejamiento con dos pares o dos respuestas que se confunden',
  'emparejamiento-par-igual': 'emparejamiento con un par que repite la misma palabra',
  'ordenamiento-sin-criterio': 'ordenamiento sin un criterio de orden en la consigna',
  'ordenamiento-intercambiable': 'ordenamiento con dos pasos que se confunden',
  'huecos-sin-respuesta': 'huecos sin su respuesta',
  'huecos-sinonimo': 'huecos con una opción que es la misma palabra que otra',
  'palabra-faltante-sinonimo': 'palabra faltante con una opción incorrecta que es la misma palabra que la correcta',
  'calculada-formula': 'calculada con una fórmula que no se puede evaluar',
  'calculada-comodines': 'calculada con comodines del enunciado y de la fórmula que no coinciden',
  'calculada-valores': 'calculada que no da un número razonable con algún juego de valores',
  'calculada-correcta': 'calculada cuya respuesta no sale de la fórmula',
  'varias-correctas-cantidad': 'varias correctas sin al menos 2 correctas y 1 incorrecta',
  'varias-correctas-repetida': 'varias correctas con dos opciones que son la misma',
}

// ─── Comparar palabras ──────────────────────────────────────────────────────

const ARTICULOS = /^(el|la|los|las|un|una|unos|unas|lo)\s+/

/** Minúsculas, sin tildes, sin signos ni artículo inicial, espacios simples. */
export function normalizarPalabra(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(ARTICULOS, '')
}

/** Sólo letras, espacios y puntuación de texto (nada de números ni símbolos). */
function esTexto(texto: unknown): boolean {
  return /^[\p{L}\s'’.,;:!?¡¿()"«»-]+$/u.test(String(texto ?? '').trim())
}

const sinEspacios = (texto: unknown) => String(texto ?? '').toLowerCase().replace(/\s+/g, '')

/** Saca el plural y el género más comunes: "culturales" → "cultural", "pequeña" → "pequen". */
function raiz(palabra: string): string {
  return palabra
    .split(' ')
    .map((w) => (w.length > 4 ? w.replace(/(es|s)$/, '').replace(/[ao]$/, '') : w))
    .join(' ')
}

function distancia(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let previo = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const actual = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, previo + (a[i - 1] === b[j - 1] ? 0 : 1))
      previo = actual
    }
  }
  return fila[b.length]
}

/**
 * Dos opciones que un alumno no podría distinguir: la misma palabra con otra
 * tilde, artículo, plural o género, o con una letra de diferencia (en
 * palabras de 6 letras o más, para no juntar "casa" y "cosa").
 */
export function pareceLaMisma(a: unknown, b: unknown): boolean {
  // Con números o símbolos (una expresión, una fórmula, una fecha) sólo cuenta
  // si es exactamente lo mismo: "x^2" y "x·2" no son la misma opción.
  if (!esTexto(a) || !esTexto(b)) return sinEspacios(a) === sinEspacios(b) && sinEspacios(a) !== ''
  const x = normalizarPalabra(a)
  const y = normalizarPalabra(b)
  if (!x || !y) return false
  if (x === y || raiz(x) === raiz(y)) return true
  return Math.min(x.length, y.length) >= 6 && distancia(x, y) <= 1
}

/** Las palabras con contenido de un texto (sin las de 3 letras o menos). */
function palabras(texto: unknown): Set<string> {
  return new Set(normalizarPalabra(texto).split(' ').filter((w) => w.length > 3).map((w) => raiz(w)))
}

/**
 * Dos textos casi iguales: la misma frase, o las mismas palabras con contenido
 * en otro orden o con otros artículos. No alcanza con muchas en común: "mayor
 * al precio" y "menor al precio" se distinguen, y es justo lo que se evalúa.
 */
function casiIguales(a: unknown, b: unknown): boolean {
  if (pareceLaMisma(a, b)) return true
  const x = palabras(a)
  const y = palabras(b)
  if (x.size < 2 || x.size !== y.size) return false
  return [...x].every((w) => y.has(w))
}

const algunParCon = <T>(lista: readonly T[], igual: (a: T, b: T) => boolean) =>
  lista.some((a, i) => lista.slice(i + 1).some((b) => igual(a, b)))

// ─── Por tipo ───────────────────────────────────────────────────────────────

function emparejamiento(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const pares = Array.isArray(q.pairs) ? (q.pairs as { left?: unknown; right?: unknown }[]) : []
  if (pares.length < 3 || pares.length > 6) return 'emparejamiento-cantidad'
  if (pares.some((p) => pareceLaMisma(p.left, p.right))) return 'emparejamiento-par-igual'
  if (algunParCon(pares.map((p) => p.left), casiIguales)) return 'emparejamiento-repetido'
  const derechas = [...pares.map((p) => p.right), ...(Array.isArray(q.distractors) ? q.distractors : [])]
  if (algunParCon(derechas, casiIguales)) return 'emparejamiento-repetido'
  return null
}

/**
 * Lo que dice cómo ordenar: un orden con nombre (cronológico, de menor a
 * mayor, de lo más antiguo a lo más reciente, de la primera a la última) o
 * los pasos de un procedimiento. Sin eso, dos órdenes pueden estar bien.
 */
const CRITERIO_DE_ORDEN =
  /\b(cronol[oó]gic\w*|secuencia|pasos?|etapas?|fases?|procedimiento|proceso|primer[oa]?|[uú]ltim[oa]|antes|despu[eé]s|antigu\w*|reciente\w*|menor|mayor|ascendente|descendente|creciente|decreciente|orden\s+en\s+que|orden\s+de|de\s+\w+\s+a\s+\w+|siglo|a[nñ]o|fecha|temprano|tard[ií]o)\b/i

function ordenamiento(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const items = Array.isArray(q.items) ? q.items : []
  if (algunParCon(items, casiIguales)) return 'ordenamiento-intercambiable'
  if (!CRITERIO_DE_ORDEN.test(String(q.question ?? ''))) return 'ordenamiento-sin-criterio'
  return null
}

function huecos(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const texto = typeof q.text === 'string' ? q.text : ''
  const choices = Array.isArray(q.choices) ? q.choices : []
  const numeros = partesDelTexto(texto).flatMap((p) => (p.tipo === 'hueco' ? [p.hueco] : []))
  const k = numeros.length
  // Cada hueco [[n]] tiene su respuesta: la opción n (las primeras k).
  if (k === 0 || numeros.some((n) => n < 1 || n > choices.length || !normalizarPalabra(choices[n - 1]))) return 'huecos-sin-respuesta'
  if (algunParCon(choices, pareceLaMisma)) return 'huecos-sinonimo'
  return null
}

function palabraFaltante(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const opciones = Array.isArray(q.options) ? q.options : []
  const correcta = Number(q.correctAnswer)
  if (!Number.isInteger(correcta) || correcta < 0 || correcta >= opciones.length) return 'huecos-sin-respuesta'
  if (opciones.some((o, i) => i !== correcta && pareceLaMisma(o, opciones[correcta]))) return 'palabra-faltante-sinonimo'
  return null
}

/** Un resultado que se puede poner en un examen: finito y sin exagerar. */
const razonable = (x: number) => Number.isFinite(x) && Math.abs(x) <= 1e9

function calculada(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const formula = typeof q.formula === 'string' ? q.formula : ''
  const variables = Array.isArray(q.variables) ? (q.variables as { name: string; min: number; max: number; decimals: number }[]) : []
  const enunciado = String(q.plantilla ?? q.question ?? '')
  const nombres = variables.map((v) => v?.name)
  const deEnunciado = comodinesDe(enunciado)
  const deFormula = comodinesDe(formula)
  const mismos = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((n) => b.includes(n))
  // Los comodines del enunciado, los de la fórmula y las variables: los mismos.
  if (!mismos(deEnunciado, deFormula) || !mismos(deFormula, nombres)) return 'calculada-comodines'
  // Que se pueda evaluar (la sintaxis): con valores que casi nunca anulan nada.
  try {
    evaluarFormula(formula, Object.fromEntries(nombres.map((n, i) => [n, 1.2345 + i * 0.731])))
  } catch {
    return 'calculada-formula'
  }
  // Diez juegos de valores dentro de los rangos: todos tienen que dar un número razonable.
  const aleatorio = aleatorioConSemilla(`u3:${formula}`)
  for (let i = 0; i < 10; i++) {
    const valores = Object.fromEntries(
      variables.map((v) => {
        const crudo = v.min + aleatorio() * (v.max - v.min)
        const d = Number.isInteger(v.decimals) ? v.decimals : 0
        return [v.name, Math.round(crudo * 10 ** d) / 10 ** d]
      }),
    )
    let resultado: number
    try {
      resultado = evaluarFormula(formula, valores)
    } catch {
      return 'calculada-valores'
    }
    if (!razonable(resultado)) return 'calculada-valores'
  }
  // La respuesta guardada sale de la fórmula con los valores sorteados.
  const valores = q.valores as Record<string, number> | undefined
  if (valores && typeof q.correctAnswer === 'number') {
    try {
      const esperada = evaluarFormula(formula, valores)
      const tolerancia = Math.max(Number(q.tolerance) || 0, 1e-9)
      if (Math.abs(esperada - q.correctAnswer) > tolerancia * Math.max(1, Math.abs(esperada))) return 'calculada-correcta'
    } catch {
      return 'calculada-formula'
    }
  }
  return null
}

function variasCorrectas(q: Record<string, unknown>): ProblemaDeCalidad | null {
  const opciones = Array.isArray(q.options) ? q.options : []
  const correctas = new Set(Array.isArray(q.correctAnswers) ? (q.correctAnswers as number[]) : [])
  if (correctas.size < 2 || opciones.length - correctas.size < 1) return 'varias-correctas-cantidad'
  if (algunParCon(opciones, pareceLaMisma)) return 'varias-correctas-repetida'
  return null
}

/** El problema de calidad de una pregunta de tipo Moodle, o null si sirve (o si no es de estos tipos). */
export function problemaDeCalidad(q: Record<string, unknown>): ProblemaDeCalidad | null {
  switch (q.type) {
    case 'matching':
      return emparejamiento(q)
    case 'ordering':
      return ordenamiento(q)
    case 'gapselect':
    case 'ddwtos':
      return huecos(q)
    case 'missing_word':
      return palabraFaltante(q)
    case 'calculated':
      return calculada(q)
    case 'multiple_response':
      return variasCorrectas(q)
    default:
      return null
  }
}
