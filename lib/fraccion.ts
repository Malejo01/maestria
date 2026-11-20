import { isNumericallyEquivalent, parseNumericAnswer } from '@/lib/numeric-answer'
import { CONSIGNA_DE_FACTORIZACION, corregirFactorizacion, esFactorizacion, type MotivoDeFactorizacion } from '@/lib/factorizacion'

/**
 * K2: las fracciones se responden como fracciones.
 *
 * Una pregunta `numeric` puede traer `fraccion: { numerador, denominador }`
 * (y opcionalmente `exigeIrreducible`, `admiteMixto`). Las que no lo traen —
 * todas las guardadas antes de K2— se corrigen exactamente como antes, con
 * `isNumericallyEquivalent` sobre el número. Este módulo es puro: no sabe de
 * React ni de la base.
 */

export interface Fraccion {
  numerador: number
  denominador: number
}

/** Lo que hace falta de una pregunta para corregirla. */
export interface PreguntaNumerica {
  correctAnswer: number
  tolerance?: number
  fraccion?: Fraccion
  exigeIrreducible?: boolean
  admiteMixto?: boolean
  /** L3: 'factorizacion' pide el producto de primos (`2^2·3·5`); `correctAnswer` es el número. */
  forma?: 'factorizacion'
  /** L3: el enunciado, para reconocer las factorizaciones guardadas sin `forma`. */
  question?: string
}

export function mcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

/** Denominador positivo y sin factores comunes: `6/-8` → `-3/4`. */
export function simplificar({ numerador, denominador }: Fraccion): Fraccion {
  const signo = denominador < 0 ? -1 : 1
  const d = mcd(numerador, denominador) || 1
  return { numerador: (signo * numerador) / d, denominador: (signo * denominador) / d }
}

export function esIrreducible(f: Fraccion): boolean {
  return mcd(f.numerador, f.denominador) === 1
}

/** Una fracción válida: enteros, denominador distinto de cero. */
export function fraccionValida(f: unknown): f is Fraccion {
  if (!f || typeof f !== 'object') return false
  const { numerador, denominador } = f as Record<string, unknown>
  return Number.isInteger(numerador) && Number.isInteger(denominador) && denominador !== 0
}

export interface Lectura {
  valor: number
  /** Si lo que escribió es una fracción de enteros (o un número mixto). */
  fraccion: Fraccion | null
  mixto: boolean
}

const FRACCION = /^([+-]?)(\d+)\/([+-]?)(\d+)$/
const MIXTO = /^([+-]?)(\d+) (\d+)\/(\d+)$/

/**
 * Lee lo que escribió el alumno conservando la forma: `6/8` no es lo mismo que
 * `3/4` cuando la consigna pide la expresión irreducible. Acepta espacios
 * (`6 / 8`), el signo adelante (`-3/4`), `\frac{3}{4}` y, sólo si la pregunta
 * lo admite, el número mixto `1 1/2`. Todo lo demás (decimales, porcentajes)
 * lo lee `parseNumericAnswer`, como siempre.
 */
export function leerRespuesta(texto: string, opciones: { admiteMixto?: boolean } = {}): Lectura | null {
  if (typeof texto !== 'string') return null
  const limpio = texto
    .replace(/[−‒–—]/g, '-')
    .replace(/[⁄∕÷]/g, '/')
    .replace(/^\$+|\$+$/g, '')
    .replace(/^(-?)\s*\\[dt]?frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}$/, '$1$2/$3')
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/^([+-])\s+/, '$1')
    .replace(/\s+/g, ' ')

  const fraccion = limpio.match(FRACCION)
  if (fraccion) {
    const [, signoN, n, signoD, d] = fraccion
    const denominador = Number(d)
    if (denominador === 0) return null
    const negativo = (signoN === '-') !== (signoD === '-')
    const f = { numerador: (negativo ? -1 : 1) * Number(n), denominador }
    return { valor: f.numerador / f.denominador, fraccion: f, mixto: false }
  }

  const mixto = limpio.match(MIXTO)
  if (mixto) {
    if (!opciones.admiteMixto) return null
    const [, signo, entero, n, d] = mixto
    const denominador = Number(d)
    if (denominador === 0) return null
    const numerador = (signo === '-' ? -1 : 1) * (Number(entero) * denominador + Number(n))
    return { valor: numerador / denominador, fraccion: { numerador, denominador }, mixto: true }
  }

  const valor = parseNumericAnswer(texto)
  return valor === null ? null : { valor, fraccion: null, mixto: false }
}

export type MotivoNumerico = 'sin_simplificar' | 'no_es_fraccion' | MotivoDeFactorizacion

export interface Correccion {
  correcta: boolean
  /** Por qué está mal cuando el valor era el correcto pero la forma no. */
  motivo?: MotivoNumerico
}

/**
 * Corrige una respuesta numérica. `texto` es lo que escribió el alumno; sin él
 * (un llamador viejo) sólo queda el número.
 *
 * - Sin `fraccion` en la pregunta: igual que siempre (tolerancia por defecto).
 * - Con `fraccion`: vale cualquier fracción equivalente (`6/8` por `3/4`) y el
 *   decimal exacto (`0,75`), sin margen: `0,9167` no es `11/12`.
 * - Con `exigeIrreducible`: sólo la fracción irreducible. `6/8` está mal
 *   ("no la simplificó del todo") y el decimal también. Si la fracción es un
 *   entero (`8/4`), el entero es su forma irreducible.
 */
export function corregirNumerica(pregunta: PreguntaNumerica, valor: number, texto?: string): Correccion {
  // L3: una factorización se corrige por lo que escribió, no por el número.
  if (esFactorizacion(pregunta)) return corregirFactorizacion(texto ?? String(valor), Number(pregunta.correctAnswer))
  if (!fraccionValida(pregunta.fraccion)) {
    return { correcta: isNumericallyEquivalent(valor, pregunta.correctAnswer, pregunta.tolerance) }
  }
  const esperada = simplificar(pregunta.fraccion)
  const lectura = texto === undefined ? null : leerRespuesta(texto, { admiteMixto: pregunta.admiteMixto })

  if (lectura?.fraccion) {
    const f = lectura.fraccion
    const equivalente = f.numerador * esperada.denominador === esperada.numerador * f.denominador
    if (!equivalente) return { correcta: false }
    if (pregunta.exigeIrreducible && !esIrreducible(f)) return { correcta: false, motivo: 'sin_simplificar' }
    return { correcta: true }
  }

  const exacto = isNumericallyEquivalent(valor, esperada.numerador / esperada.denominador, 0)
  if (!exacto) return { correcta: false }
  if (pregunta.exigeIrreducible && esperada.denominador !== 1) return { correcta: false, motivo: 'no_es_fraccion' }
  return { correcta: true }
}

/** La fracción en LaTeX, para mostrarla con KaTeX: `$\frac{3}{4}$`, `$-\frac{3}{4}$`, `$2$`. */
export function fraccionEnLatex(f: Fraccion): string {
  const { numerador, denominador } = { numerador: f.numerador, denominador: f.denominador }
  const negativo = numerador * denominador < 0
  const n = Math.abs(numerador)
  const d = Math.abs(denominador)
  if (d === 1) return `$${negativo ? '-' : ''}${n}$`
  return `$${negativo ? '-' : ''}\\frac{${n}}{${d}}$`
}

/** Qué le decimos al alumno cuando el valor estaba bien pero la forma no. */
export function textoDelMotivo(motivo: Exclude<MotivoNumerico, MotivoDeFactorizacion>, esperada: Fraccion): string {
  const latex = fraccionEnLatex(simplificar(esperada))
  return motivo === 'sin_simplificar'
    ? `Es equivalente, pero no la simplificaste del todo: la expresión irreducible es ${latex}.`
    : `El valor es el correcto, pero la consigna pide la fracción irreducible: ${latex}.`
}

/**
 * El número de una respuesta guardada como fracción, si le corresponde una:
 * cuando la IA devolvió sólo el decimal (`0.9166666666666666`) y la consigna
 * pide una fracción, se recupera `11/12` (denominador hasta 1000, exacto).
 * Devuelve null si el decimal no es una fracción chica.
 */
export function fraccionDeDecimal(valor: number, maxDenominador = 1000): Fraccion | null {
  if (!Number.isFinite(valor)) return null
  for (let d = 1; d <= maxDenominador; d++) {
    const n = Math.round(valor * d)
    if (Math.abs(n / d - valor) <= 1e-9 * Math.max(1, Math.abs(valor))) return { numerador: n, denominador: d }
  }
  return null
}

/** ¿La consigna pide una fracción? (`fracción`, `irreducible`, `simplificá`…) */
export function consignaPideFraccion(enunciado: string): boolean {
  return /fracci[oó]n|irreducible|simplific/i.test(enunciado)
}

/** ¿La consigna pide la expresión irreducible? */
export function consignaPideIrreducible(enunciado: string): boolean {
  return /irreducible|simplific|m[ií]nima expresi[oó]n/i.test(enunciado)
}

/**
 * Normaliza una pregunta `numeric` recién generada (no las guardadas):
 * - si trae `fraccion`, se guarda simplificada, y `correctAnswer` pasa a ser
 *   su valor (la fracción manda; un `correctAnswer` desalineado se corrige);
 * - si no la trae pero la consigna (o el tema) pide una fracción y el
 *   resultado no es entero, se recupera del decimal;
 * - `exigeIrreducible` se prende si la consigna lo pide ("irreducible",
 *   "simplificá").
 */
export function normalizarFraccionGenerada<T extends PreguntaNumerica & { question: string; topicName?: string }>(pregunta: T): T {
  // L3: si la consigna pide factorizar, la respuesta es el producto de primos.
  // Nunca queda un `correctAnswer` = el número sin `forma`.
  if (pregunta.forma === 'factorizacion' || CONSIGNA_DE_FACTORIZACION.test(pregunta.question)) {
    const { fraccion: _f, exigeIrreducible: _e, admiteMixto: _m, ...resto } = pregunta
    void _f
    void _e
    void _m
    return { ...resto, forma: 'factorizacion', correctAnswer: Math.round(Number(pregunta.correctAnswer)) } as T
  }
  let fraccion = fraccionValida(pregunta.fraccion) ? pregunta.fraccion : null
  const pide = consignaPideFraccion(pregunta.question) || consignaPideFraccion(pregunta.topicName ?? '')
  if (!fraccion && pide && !Number.isInteger(pregunta.correctAnswer)) {
    fraccion = fraccionDeDecimal(Number(pregunta.correctAnswer))
  }
  if (!fraccion) {
    const { fraccion: _f, exigeIrreducible: _e, ...resto } = pregunta
    void _f
    void _e
    return resto as T
  }
  const normal = simplificar(fraccion)
  return {
    ...pregunta,
    fraccion: normal,
    correctAnswer: normal.numerador / normal.denominador,
    exigeIrreducible: pregunta.exigeIrreducible === true || consignaPideIrreducible(pregunta.question),
  }
}
