/**
 * Interpretación y comparación de respuestas numéricas.
 *
 * Este módulo es puro a propósito: no sabe qué es una pregunta, no lee la base
 * y no normaliza texto. Sólo contesta dos cosas — "¿esto que escribió el alumno
 * es un número, y cuál?" y "¿ese número es el mismo que el esperado?".
 *
 * Existe porque en la prueba con 30 alumnos aparecieron dos fallas que son la
 * misma falla vista desde dos lados:
 *
 * 1. Las `acceptedAnswers` que genera la IA vienen en formas equivalentes entre
 *    sí (`["7/4", "\\frac{7}{4}", "1.75"]`) y el sistema las comparaba como
 *    strings, así que no reconocía ni sus propias variantes, mucho menos el
 *    `1,75` que escribe un alumno con teclado en español.
 * 2. En las preguntas `numeric`, `tolerance` es opcional en el schema y la IA
 *    casi nunca la manda (una sola respuesta de toda la prueba la tenía), así
 *    que los decimales se comparaban por igualdad exacta de flotantes: un
 *    ejercicio cuyo resultado es 1/3 era literalmente inganable.
 *
 * La normalización de texto (tildes, mayúsculas, LaTeX de palabras) NO vive
 * acá: es de `lib/short-answer-grading.ts`. Este archivo no lo importa.
 */

/**
 * Tolerancia relativa por defecto para respuestas no enteras: 1 % del valor
 * esperado. Está expuesta con nombre para poder ajustarla sin ir a buscarla
 * dentro de una expresión.
 */
export const DEFAULT_RELATIVE_TOLERANCE = 0.01

/**
 * Piso absoluto de la tolerancia por defecto. El criterio de diseño es "un
 * alumno que redondea a dos decimales tiene que acertar": contra 1/3 = 0,3333…
 * el 1 % relativo da 0,0033, y `0,33` se aleja 0,00333 — quedaba afuera por un
 * pelo. Con el piso en 0,005 (medio centésimo, exactamente el error máximo de
 * redondear a dos decimales) `0,33` entra, que es la conducta que queremos.
 */
export const MIN_ABSOLUTE_TOLERANCE = 0.005

/**
 * Colchón para el ruido de punto flotante en la comparación. Es relativo al
 * valor esperado porque el error de representación crece con la magnitud: un
 * absoluto fijo sería demasiado laxo cerca de cero y demasiado estricto para
 * valores grandes. Nunca es tan grande como para acercar dos respuestas que de
 * verdad difieren (contra 13 vale ~1,3e-8).
 */
const FLOAT_SLACK_RATIO = 1e-9

/** Decimales que se muestran al alumno al devolverle lo que interpretamos. */
const DISPLAY_DECIMALS = 6

/**
 * Para valores muy chicos, 6 decimales imprimirían "0" — que es peor que no
 * mostrar nada, porque le estaríamos mintiendo sobre lo que leímos.
 */
const TINY_VALUE_DECIMALS = 12
const TINY_VALUE_THRESHOLD = 1e-4

/**
 * Un número "pelado": entero o decimal, con punto o con coma, con signo
 * opcional, admitiendo `.5` / `,5` sin el cero adelante.
 *
 * Sobre separadores de miles: NO se soportan, y es una decisión, no un olvido.
 * `1.234` es genuinamente ambiguo — mil doscientos treinta y cuatro para quien
 * escribe a la europea, uno coma dos tres cuatro para quien escribe a la
 * inglesa — y en una corrección automática adivinar mal es peor que no
 * soportarlo: el alumno no ve el criterio y no puede defenderse. La regla acá
 * es una sola y se puede explicar en una línea: *el separador siempre es
 * decimal*. Como consecuencia esta expresión admite a lo sumo uno, así que
 * `1.234.567` y `1,234,567` caen a `null` en vez de convertirse en un número
 * inventado. Es también la razón por la que `formatNumericAnswer` imprime sin
 * separador de miles: todo lo que mostramos tiene que poder volver a entrar.
 */
const PLAIN_NUMBER = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/

/** `\frac{7}{4}`, `\dfrac`, `\tfrac`, con signo opcional adelante. */
const LATEX_FRACTION = /^([+-]?)\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}$/

/**
 * Convierte lo que escribió el alumno (o lo que generó la IA) en un número.
 * Devuelve `null` ante cualquier cosa que no sea *inequívocamente* un número:
 * en corrección automática, no entender es un resultado válido y honesto;
 * entender de más produce falsos positivos que nadie audita.
 *
 * Acepta:
 * - enteros y decimales, con punto o con coma: `13`, `3.5`, `3,5`
 * - fracciones, con o sin espacios: `1/3`, `-2/4`, `7 / 2`
 * - porcentajes: `33%` → 0.33 (ver nota abajo)
 * - LaTeX simple: `\frac{7}{4}`, `$\frac{7}{4}$`, `\(1/2\)`
 * - signo, espacios de más, guiones y menos tipográficos
 *
 * Sobre los porcentajes: la convención elegida es que `33%` vale 0,33, es
 * decir, el símbolo se interpreta como "dividido cien" y no como decoración.
 * Es la lectura matemáticamente correcta y la que hace que `50%` y `1/2` sean
 * la misma respuesta. Tiene un costo conocido: si la consigna pregunta "¿qué
 * porcentaje…?" y la respuesta esperada está cargada como `33`, el alumno que
 * escribe `33%` obtiene 0,33 y da distinto. Se asume igual porque la
 * alternativa (ignorar el `%`) rompe el caso mucho más común de las fracciones
 * y probabilidades, y porque el arreglo real de ese caso es cargar la respuesta
 * esperada en la misma unidad que pide la consigna.
 *
 * No se soportan números mixtos (`1 1/2`) ni notación científica. El mixto se
 * dejó afuera por seguridad: para aceptar `7 / 2` hay que tolerar espacios
 * alrededor de la barra, y si además se ignoraran los espacios entre dígitos,
 * `1 1/2` se leería como `11/2` = 5,5. Un error silencioso de esa clase es
 * exactamente lo que este módulo viene a evitar, así que los espacios internos
 * entre dígitos invalidan la entrada.
 */
export function parseNumericAnswer(raw: string): number | null {
  if (typeof raw !== 'string') return null

  let text = stripMathDelimiters(normalizeSymbols(raw))
  if (!text) return null

  // El `%` se saca acá y se aplica al final, para que `\frac{1}{2}%` o `1/2 %`
  // funcionen igual que `50%` sin duplicar la lógica de cada forma.
  let isPercentage = false
  if (text.endsWith('%')) {
    isPercentage = true
    text = text.slice(0, -1).trim()
    if (!text) return null
  }

  const value = parseUnsignedForms(text)
  if (value === null) return null

  return isPercentage ? value / 100 : value
}

/** Reconoce, en orden, LaTeX de fracción → fracción con barra → número pelado. */
function parseUnsignedForms(text: string): number | null {
  const latex = text.match(LATEX_FRACTION)
  if (latex) {
    const [, sign, numerator, denominator] = latex
    const quotient = divide(parsePlainNumber(numerator), parsePlainNumber(denominator))
    if (quotient === null) return null
    return sign === '-' ? -quotient : quotient
  }

  if (text.includes('/')) {
    const parts = text.split('/')
    // Tres partes no son una fracción; son un error de tipeo o una fecha.
    if (parts.length !== 2) return null
    return divide(parsePlainNumber(parts[0]), parsePlainNumber(parts[1]))
  }

  return parsePlainNumber(text)
}

/**
 * División que devuelve `null` en vez de `Infinity`/`NaN`. Que `1/0` sea
 * `Infinity` es correcto para JavaScript y desastroso acá: se colaría como
 * "número válido" hasta la comparación, donde produciría resultados difíciles
 * de explicar. Una división por cero no es una respuesta numérica.
 */
function divide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null) return null
  if (denominator === 0) return null
  const result = numerator / denominator
  return Number.isFinite(result) ? result : null
}

function parsePlainNumber(text: string): number | null {
  const candidate = text.trim()
  if (!PLAIN_NUMBER.test(candidate)) return null

  // Llegado acá hay a lo sumo un separador y el regex ya garantizó que tiene
  // dígitos de un lado, así que reemplazarlo por punto es seguro.
  const value = Number.parseFloat(candidate.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

/** Saca `$…$`, `$$…$$`, `\(…\)` y `\[…\]`, que son envoltorio, no contenido. */
function stripMathDelimiters(text: string): string {
  return text
    .replace(/^\$+/, '')
    .replace(/\$+$/, '')
    .replace(/^\\[([]/, '')
    .replace(/\\[)\]]$/, '')
    .trim()
}

/**
 * Unifica las variantes tipográficas que llegan de copiar y pegar (menos
 * Unicode, espacios finos, barra de fracción) y el ruido de espaciado de LaTeX.
 * Nada de esto cambia el valor del número; sólo evita que la misma respuesta
 * falle según de dónde se copió.
 */
function normalizeSymbols(text: string): string {
  return text
    .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
    .replace(/[\u00A0\u2007\u2009\u200A\u202F]/g, ' ')
    .replace(/\\(?:left|right)\s*/g, '')
    .replace(/\\[,;:!]/g, '')
    .replace(/\\%/g, '%')
    .replace(/[\u2044\u2215\u00F7]/g, '/')
    .trim()
}

/**
 * Tolerancia a usar cuando la pregunta no trae una propia.
 *
 * Los enteros no toleran nada: si la respuesta esperada es 13, `12` está mal y
 * punto. Un margen ahí no arregla ningún redondeo — no hay redondeo que hacer —
 * y sí regalaría respuestas contiguas, que en aritmética suelen ser
 * precisamente el error que la pregunta quiere detectar.
 *
 * Para los no enteros el problema real es el opuesto: la respuesta exacta suele
 * ser periódica o irracional y el alumno la escribe redondeada. El margen es el
 * mayor entre el 1 % del valor y medio centésimo, así que un redondeo a dos
 * decimales siempre entra (ver `MIN_ABSOLUTE_TOLERANCE`) y los valores grandes
 * escalan solos en vez de quedar atados a un absoluto que se les hace chico.
 */
export function defaultToleranceFor(expected: number): number {
  if (!Number.isFinite(expected)) return 0
  if (Number.isInteger(expected)) return 0
  return Math.max(Math.abs(expected) * DEFAULT_RELATIVE_TOLERANCE, MIN_ABSOLUTE_TOLERANCE)
}

/**
 * Compara la respuesta del alumno contra la esperada.
 *
 * La `tolerance` explícita — la que puede traer la pregunta — gana siempre,
 * incluso cuando es 0: si el docente o la IA se tomaron el trabajo de fijar el
 * margen, nadie lo debería ampliar por atrás. Sólo cuando no viene se recurre a
 * `defaultToleranceFor`.
 *
 * La comparación suma un colchón de punto flotante porque el valor esperado
 * casi nunca es un literal: sale de dividir (`7/4`, `1/3`), y `0.1 + 0.2` no da
 * `0.3` en binario. Sin el colchón, una respuesta exacta con tolerancia 0 puede
 * fallar por un error de representación de 1e-17, que es imposible de explicar.
 */
export function isNumericallyEquivalent(studentValue: number, expected: number, tolerance?: number): boolean {
  if (!Number.isFinite(studentValue) || !Number.isFinite(expected)) return false

  const effectiveTolerance =
    typeof tolerance === 'number' && Number.isFinite(tolerance) && tolerance >= 0
      ? tolerance
      : defaultToleranceFor(expected)

  const slack = FLOAT_SLACK_RATIO * Math.max(1, Math.abs(expected))
  return Math.abs(studentValue - expected) <= effectiveTolerance + slack
}

/**
 * Representación en es-AR (coma decimal) para devolverle al alumno lo que
 * entendimos: "leímos: 3,5". Es la mitad visible del arreglo — aceptar más
 * formas no sirve de nada si el alumno no puede confirmar que lo aceptado es lo
 * que quiso decir.
 *
 * Formatea a mano en vez de con `Intl.NumberFormat('es-AR')` por dos razones:
 * el formato local agrupa los miles (`1.234,5`) y este módulo se niega a
 * interpretar esos puntos, así que estaríamos mostrando algo que no volvería a
 * entrar por `parseNumericAnswer`; y el resultado queda idéntico en cualquier
 * build de Node, con ICU completo o sin él.
 *
 * Sin notación científica: `toFixed` la evita para todo el rango normal, y los
 * decimales se recortan para no exponer el ruido binario (0,30000000000000004).
 */
export function formatNumericAnswer(value: number): string {
  if (!Number.isFinite(value)) return ''

  const decimals = value !== 0 && Math.abs(value) < TINY_VALUE_THRESHOLD ? TINY_VALUE_DECIMALS : DISPLAY_DECIMALS
  const fixed = value.toFixed(decimals)

  // El recorte de ceros sólo aplica a la parte decimal: sobre "100" comerse los
  // ceros finales daría "1".
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed

  return trimmed.replace('.', ',')
}
