/**
 * Chequeos DETERMINISTAS de higiene sobre las preguntas generadas.
 *
 * Por qué existe este archivo en vez de pedírselo al evaluador: un LLM no tiene
 * renderer. Lee `$\frac{7}{4}$` y contesta "renderiza bien" porque no puede
 * hacer otra cosa. Los fallos reales de este repo en esta zona fueron todos
 * mecánicos y todos se atrapan con una regex:
 *
 *   - `\neg` corrompido a `eg` (hay una regex de recuperación en la ruta de
 *     generación, lo que prueba que pasa en producción)
 *   - `$` de moneda mezclado con `$` de LaTeX, o delimitadores sin cerrar
 *   - `acceptedAnswers` enteramente en LaTeX crudo: `["$P(A|B) = \\frac{...}{...}$"]`
 *     — caso real, quiz_answers.id 1502 del diagnóstico del 2026-08-10. Ningún
 *     alumno tipea eso, y además se le muestra así como "respuesta esperada"
 *   - `numeric` con `tolerance` nula: las 255 respuestas numéricas de ese
 *     diagnóstico la tenían nula, así que todo resultado no entero era ingandable
 *
 * Cada hallazgo de acá es reproducible y está cubierto por tests. Un hallazgo
 * del modelo es una opinión calibrada; uno de acá es un hecho. El campo
 * `source` del Finding mantiene esa distinción visible aguas abajo.
 */
import { getEducationContext } from '@/lib/education-context'
import { parseNumericAnswer } from '@/lib/numeric-answer'
import type { Question } from '@/lib/types'
import type { Finding, Severity } from '@/lib/qa/rubric'

export interface LintContext {
  nivel: string
  grado: string
  materia: string
}

/** Comandos LaTeX que aparecen en este repo y que se rompen al perder la barra. */
const LATEX_BRACE_COMMANDS = ['frac', 'dfrac', 'sqrt', 'text', 'mathbb', 'overline'] as const

/**
 * Operadores lógicos que perdieron la barra invertida por completo.
 *
 * Deliberadamente NO incluye `cap` ni `cup`: "cap." es abreviatura de capítulo
 * en castellano y un falso positivo acá se paga en precisión, que es la métrica
 * que decide si el reporte se lee o se ignora.
 */
const LOST_BACKSLASH_TOKENS = [
  'wedge',
  'vee',
  'neg',
  'rightarrow',
  'leftrightarrow',
  'times',
  'cdot',
] as const

/**
 * El fósil concreto de este repo: `\neg` escrito con una sola barra en JSON se
 * parsea como salto de línea + `eg`, y queda `egp` o `eg(q∨r)`. La ruta de
 * generación tiene una regex que lo recupera (`normalizeLogicalNotation`), así
 * que si llega hasta acá es que ese rescate no alcanzó. El patrón replica el de
 * la ruta: `eg` pegado a una letra o a un paréntesis, nunca como palabra suelta.
 */
const NEWLINE_FOSSIL_PATTERN = /(^|[\s(])eg(?=[a-zA-Z(])/

/**
 * Piso absoluto, en caracteres, para marcar a la opción correcta como delatada
 * por su largo. Por debajo de esto la diferencia relativa no significa nada.
 */
const GIVEAWAY_MIN_LENGTH = 25

/**
 * Secuencia `\uXXXX` que llegó cruda al texto en vez de decodificarse.
 *
 * El alumno ve literalmente "parábola". Sale de la cadena de reparación de
 * JSON: cuando `repairQuizJson` duplica backslashes para arreglar un escape
 * roto, los `\u` legítimos quedan como `\\u` y el parser los devuelve como
 * texto. En el 10/08 pasó en 10 respuestas seguidas (ids 1430..1448): un solo
 * intento, todo su contenido corrupto.
 *
 * Acotado a la mitad ALTA del bloque Latin-1 (``..`ÿ`) a propósito:
 * ahí viven las tildes y los `¿¡` del castellano, y los diez casos reales caen
 * todos ahí (`á`, `é`, `í`, `ó`, `ñ`, `¿`).
 *
 * El primer dígito hexadecimal tiene que ser >= 8, y no es un detalle: sin eso
 * el patrón también atrapa `A`, que es una `A` en ASCII y puede ser el
 * tema legítimo de una pregunta de sistemas sobre codificación de caracteres.
 * Un `é` en una pregunta de matemática en español, en cambio, es siempre
 * corrupción.
 */
const RAW_UNICODE_ESCAPE = /\\u00[89a-fA-F][0-9a-fA-F]/

/**
 * Enunciado que manda a mirar un material visual que el motor nunca dibuja.
 *
 * No hay imágenes en ninguna parte del cuestionario, así que la pregunta es
 * irrespondible: el alumno sólo puede adivinar. El caso real del 10/08 (id 750,
 * "Observa el siguiente gráfico. ¿Representa una función matemática?") lo
 * confirma — el alumno respondió y erró, y la explicación habla de "la línea
 * vertical x=2 cruza el gráfico en dos puntos", un gráfico que no existió.
 *
 * DELIBERADAMENTE ESTRECHO: imperativo + deíctico + sustantivo visual. La
 * versión amplia —cualquier mención de "gráfica que se muestra"— se midió y
 * produce un falso positivo (id 1071: dice "cuya gráfica se muestra" pero
 * después describe el comportamiento en palabras y es perfectamente
 * respondible). Mencionar un gráfico no rompe nada; mandar a mirar UNO QUE
 * SIGUE, sí.
 */
const DANGLING_VISUAL_REFERENCE =
  /\b(observ[áa]?|mir[áa]?|analiz[áa]?|f[íi]jate|ve[ad]?)\s+(el|la|los|las)\s+(siguiente|siguientes)\s+(gr[áa]fic\w+|figura|imagen|diagrama|esquema|tabla)\b/i

/**
 * `true_false` cuyo enunciado se abre afirmando su propia veracidad.
 *
 * "Es verdadero que P" pide juzgar verdadero o falso una oración que ya declara
 * ser verdadera. Los dos casos del 10/08 (ids 693 y 1432) tienen los dos
 * `correctAnswer: true`, que es exactamente lo que el enunciado adelanta.
 *
 * El `^` no es decorativo: separa la afirmación de la pregunta. "¿Es verdadero
 * que P?" es una forma legítima y frecuente —12 casos en el 10/08— y ninguno
 * cae acá.
 */
const TRUE_FALSE_SELF_ANSWERING = /^\s*es\s+(verdadero|cierto|falso)\s+que\b/i

function finding(
  dimension: Finding['dimension'],
  severity: Severity,
  questionIndex: number,
  justification: string
): Finding {
  return { dimension, severity, questionIndex, justification, source: 'lint' }
}

/** Cuenta delimitadores `$` reales, ignorando los escapados (`\$`). */
export function countMathDelimiters(text: string): number {
  const withoutEscaped = text.replace(/\\\$/g, '')
  return (withoutEscaped.match(/\$/g) ?? []).length
}

/** Segmentos entre `$...$`, sin los delimitadores. */
export function mathSegments(text: string): string[] {
  // Centinela para tapar los `\$` escapados antes de partir por delimitador.
  // Va como escape de 6 caracteres y no como byte NUL literal: con el byte
  // crudo en el archivo, git clasifica este .ts como binario y no diffea.
  const withoutEscaped = text.replace(/\\\$/g, '\u0000')
  const segments: string[] = []
  const pattern = /\$\$?([^$]*)\$\$?/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(withoutEscaped)) !== null) {
    segments.push(match[1])
  }
  return segments
}

/**
 * Heurística de "prosa metida en modo matemático".
 *
 * El prompt de generación lo prohíbe explícitamente ("JAMÁS envuelvas oraciones
 * enteras en $ ... $") y cuando pasa, KaTeX renderiza la oración en itálica
 * apretada e ilegible. Se considera prosa cuando hay tres o más palabras
 * alfabéticas y ningún comando LaTeX ni operador que justifique el modo
 * matemático. El piso es de dos letras por palabra, no tres: el castellano está
 * lleno de "de", "la", "el", y con tres letras se escapaba "el resultado de la
 * suma", que es exactamente el caso que esto viene a atrapar.
 */
export function looksLikeProse(segment: string): boolean {
  if (/\\[a-zA-Z]+/.test(segment)) return false
  if (/[=+\-*/^_<>]/.test(segment)) return false

  const words = segment.trim().split(/\s+/).filter((word) => /^[a-zA-ZáéíóúñÁÉÍÓÚÑ]{2,}$/.test(word))
  return words.length >= 3
}

function lintText(text: string, label: string, index: number): Finding[] {
  const findings: Finding[] = []

  if (RAW_UNICODE_ESCAPE.test(text)) {
    findings.push(
      finding(
        'higiene_formato',
        'critical',
        index,
        `${label}: quedaron secuencias \\uXXXX sin decodificar — el alumno lee "par\\u00e1bola" en vez de "parábola".`
      )
    )
  }

  if (countMathDelimiters(text) % 2 !== 0) {
    findings.push(
      finding(
        'higiene_formato',
        'critical',
        index,
        `${label}: delimitadores $ sin cerrar — KaTeX no renderiza y el alumno ve el LaTeX crudo.`
      )
    )
  }

  for (const segment of mathSegments(text)) {
    if (looksLikeProse(segment)) {
      findings.push(
        finding(
          'higiene_formato',
          'major',
          index,
          `${label}: hay prosa dentro de $...$ ("${segment.trim().slice(0, 40)}…"), que se renderiza en itálica apretada.`
        )
      )
      break
    }
  }

  for (const command of LATEX_BRACE_COMMANDS) {
    const pattern = new RegExp(`(?<![\\\\a-zA-Z])${command}\\s*\\{`)
    if (pattern.test(text)) {
      findings.push(
        finding(
          'higiene_formato',
          'critical',
          index,
          `${label}: "${command}{" sin barra invertida — el comando LaTeX perdió el escape y se imprime literal.`
        )
      )
      break
    }
  }

  for (const token of LOST_BACKSLASH_TOKENS) {
    const pattern = new RegExp(`(^|[\\s(])${token}(?![a-zA-Z])`)
    if (pattern.test(text) && !new RegExp(`\\\\${token}`).test(text)) {
      findings.push(
        finding(
          'higiene_formato',
          'critical',
          index,
          `${label}: operador "${token}" sin barra invertida — la notación quedó corrupta.`
        )
      )
      break
    }
  }

  if (NEWLINE_FOSSIL_PATTERN.test(text)) {
    findings.push(
      finding(
        'higiene_formato',
        'critical',
        index,
        `${label}: quedó el fósil "eg" de un \\neg mal escapado — el alumno ve "egp" en vez de "¬p".`
      )
    )
  }

  return findings
}

/** True cuando la cadena depende de LaTeX para leerse. */
export function isLatexOnly(value: string): boolean {
  return /\$/.test(value) || /\\[a-zA-Z]+/.test(value)
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

/** Margen relativo para considerar dos opciones el mismo número. */
const NUMERIC_EQUALITY_EPSILON = 1e-9

/**
 * Pares de opciones que son el mismo número escrito distinto.
 *
 * `parseNumericAnswer` ya entiende fracción, coma decimal, porcentaje y LaTeX,
 * así que `$\frac{3}{4}$` y `$0.75$` colapsan al mismo valor. Devuelve los
 * índices de cada par colisionado.
 *
 * Medido sobre las 862 multiple_choice del 10/08: dispara en 2, y las dos son
 * reales (ids 771 y 1351, ambas preguntando cuál número es irracional, ambas
 * con `3/4` y `0.75` entre las opciones). El duplicado exacto de texto, en
 * cambio, dispara 0 veces — la equivalencia numérica es lo que faltaba.
 */
export function equivalentOptionPairs(options: string[]): [number, number][] {
  const values = options.map((option) => parseNumericAnswer(option))
  const pairs: [number, number][] = []

  for (let i = 0; i < values.length; i++) {
    const a = values[i]
    if (a === null || !Number.isFinite(a)) continue

    for (let j = i + 1; j < values.length; j++) {
      const b = values[j]
      if (b === null || !Number.isFinite(b)) continue

      // Tolerancia relativa: dos formas del mismo número pueden diferir en el
      // último bit por el camino de parseo (1/3 no es exactamente 0.333…).
      const scale = Math.max(Math.abs(a), Math.abs(b), 1)
      if (Math.abs(a - b) <= NUMERIC_EQUALITY_EPSILON * scale) {
        pairs.push([i, j])
      }
    }
  }

  return pairs
}

/**
 * Corre todos los chequeos sobre un cuestionario.
 *
 * Devuelve findings con `dimension` real (no todos bajo `higiene_formato`): el
 * tope de palabras por opción es adecuación al nivel, y la opción correcta
 * delatada por su largo es calidad de distractores. Lo que los separa de los
 * hallazgos del modelo es `source: 'lint'`, no la dimensión — así el backlog
 * puede agrupar por defecto y filtrar por confiabilidad de la evidencia.
 */
export function lintQuestions(questions: Question[], context: LintContext): Finding[] {
  const educationContext = getEducationContext(context.nivel, context.grado, context.materia)
  const maxOptionWords = educationContext.maxOpcionesPalabras
  const findings: Finding[] = []

  questions.forEach((question, index) => {
    const statement = String(question.question ?? '')
    const explanation = String(question.explanation ?? '')

    if (statement.trim().length === 0) {
      findings.push(finding('higiene_formato', 'critical', index, 'Enunciado vacío.'))
      return
    }

    findings.push(...lintText(statement, 'Enunciado', index))

    if (DANGLING_VISUAL_REFERENCE.test(statement)) {
      findings.push(
        finding(
          'higiene_formato',
          'critical',
          index,
          'Manda a mirar un gráfico o figura que el cuestionario nunca muestra: la pregunta no se puede responder, sólo adivinar.'
        )
      )
    }

    if (question.type === 'true_false' && TRUE_FALSE_SELF_ANSWERING.test(statement)) {
      findings.push(
        finding(
          'calidad_distractores',
          'major',
          index,
          'El enunciado arranca afirmando "Es verdadero/cierto que...", así que adelanta la respuesta de una pregunta de verdadero o falso.'
        )
      )
    }

    if (explanation.trim().length > 0) {
      findings.push(...lintText(explanation, 'Explicación', index))
    } else {
      findings.push(
        finding(
          'higiene_formato',
          'major',
          index,
          'Sin explicación: el alumno que se equivoca no recibe devolución.'
        )
      )
    }

    if (question.type === 'multiple_choice') {
      const options = question.options ?? []

      if (options.length < 2) {
        findings.push(
          finding('higiene_formato', 'critical', index, `Sólo ${options.length} opción(es) de respuesta.`)
        )
      }

      if (
        !Number.isInteger(question.correctAnswer) ||
        question.correctAnswer < 0 ||
        question.correctAnswer >= options.length
      ) {
        findings.push(
          finding(
            'higiene_formato',
            'critical',
            index,
            `correctAnswer = ${question.correctAnswer} no apunta a ninguna opción (hay ${options.length}).`
          )
        )
      }

      const normalized = options.map((option) => option.trim().toLowerCase())
      if (new Set(normalized).size !== normalized.length) {
        findings.push(
          finding('higiene_formato', 'critical', index, 'Hay opciones repetidas: más de una respuesta es correcta.')
        )
      }

      // El mismo número escrito de dos formas. Se separa en dos severidades
      // porque las consecuencias son distintas: si la colisión toca la opción
      // correcta hay literalmente dos respuestas correctas y la pregunta no se
      // puede corregir; si es entre distractores, la pregunta sigue teniendo
      // una única respuesta pero el alumno que descarta uno descarta el otro
      // gratis, y una pregunta de cuatro opciones funciona como una de tres.
      //
      // Los dos casos reales del 10/08 (ids 771 y 1351) caen en la segunda
      // rama. La primera no tiene ningún caso real y está cubierta sólo por
      // test sintético — tenerlo presente si alguna vez hay que confiar en ella.
      for (const [first, second] of equivalentOptionPairs(options)) {
        const touchesCorrect = first === question.correctAnswer || second === question.correctAnswer
        findings.push(
          finding(
            'calidad_distractores',
            touchesCorrect ? 'critical' : 'major',
            index,
            touchesCorrect
              ? `Las opciones ${first + 1} y ${second + 1} (${options[first]} y ${options[second]}) son el mismo número y una es la marcada como correcta: hay dos respuestas correctas.`
              : `Los distractores ${first + 1} y ${second + 1} (${options[first]} y ${options[second]}) son el mismo número: descartar uno descarta el otro, y la pregunta ofrece menos opciones reales de las que aparenta.`
          )
        )
      }

      options.forEach((option, optionIndex) => {
        findings.push(...lintText(option, `Opción ${optionIndex + 1}`, index))
      })

      const tooLong = options.filter((option) => countWords(option) > maxOptionWords)
      if (tooLong.length > 0) {
        findings.push(
          finding(
            'adecuacion_nivel',
            'major',
            index,
            `${tooLong.length} opción(es) superan las ${maxOptionWords} palabras que el nivel admite (${educationContext.grado}).`
          )
        )
      }

      // La opción correcta delatada por su largo.
      //
      // OJO CON CUÁNTO PESA ESTE HALLAZGO. Medí la premisa sobre las 862
      // preguntas de 4 opciones del 10/08: la opción más larga es la correcta
      // en el 28,0% de los casos, contra un 25% de azar. Son ~2 errores
      // estándar: efecto real pero chico. El folklore de "la más larga es la
      // correcta" casi no aparece en la salida de este generador. Lo que sí
      // aparece, y fuerte, es lo inverso: la correcta es la más CORTA sólo en
      // el 8,7% de los casos. La señal es "la correcta no es la escueta", no
      // "la correcta es la larga".
      //
      // Por eso queda en `minor` y con el umbral estrecho: más larga que TODAS
      // las demás, al menos el doble del promedio, y de 25 caracteres para
      // arriba. Con ese corte dispara en el 4,1% (35 de 862); aflojando a 1,6x
      // sube a 8,8% y a 1,5x/20 chars a 12,2%, sin que la premisa mejore. No
      // hay umbral que aísle una señal fuerte porque la señal fuerte no está.
      // El piso absoluto importa aparte: entre opciones cortas ("cuatro" contra
      // "cuatro unidades") el doble del promedio se alcanza sin que la
      // respuesta se delate en absoluto.
      const correct = options[question.correctAnswer]
      if (correct && options.length >= 3) {
        const distractors = options.filter((_, optionIndex) => optionIndex !== question.correctAnswer)
        const correctLength = correct.trim().length
        const meanDistractor =
          distractors.reduce((total, option) => total + option.trim().length, 0) / distractors.length
        const longestDistractor = Math.max(...distractors.map((option) => option.trim().length))

        if (
          correctLength >= GIVEAWAY_MIN_LENGTH &&
          correctLength > longestDistractor &&
          correctLength >= meanDistractor * 2
        ) {
          findings.push(
            finding(
              'calidad_distractores',
              'minor',
              index,
              `La opción correcta es la más larga y duplica el promedio: se acierta por forma, sin saber el tema.`
            )
          )
        }
      }
    }

    if (question.type === 'short_answer') {
      const accepted = question.acceptedAnswers ?? []

      if (accepted.length === 0) {
        findings.push(finding('higiene_formato', 'critical', index, 'short_answer sin respuestas aceptadas.'))
      } else if (accepted.every(isLatexOnly)) {
        findings.push(
          finding(
            'higiene_formato',
            'critical',
            index,
            `Todas las respuestas aceptadas están en LaTeX (${accepted[0].slice(0, 30)}…): ningún alumno tipea eso, y se le muestra así como respuesta esperada.`
          )
        )
      }

      // Un porcentaje cargado en una sola forma: el parser numérico lee "33%"
      // como 0,33, así que el alumno que escribe la otra forma da distinto.
      const hasPercent = accepted.some((answer) => answer.includes('%'))
      const hasDecimal = accepted.some((answer) => /\d[.,]\d/.test(answer) && !answer.includes('%'))
      if (hasPercent && !hasDecimal && accepted.length > 0) {
        findings.push(
          finding(
            'higiene_formato',
            'major',
            index,
            'Respuesta porcentual cargada sólo con %: falta la forma decimal equivalente y una de las dos da incorrecta.'
          )
        )
      }
    }

    if (question.type === 'numeric') {
      const tolerance = question.tolerance
      const isInteger = Number.isInteger(question.correctAnswer)

      if (!isInteger && (tolerance === undefined || tolerance === null || tolerance === 0)) {
        findings.push(
          finding(
            'higiene_formato',
            'critical',
            index,
            `Respuesta ${question.correctAnswer} no entera y sin tolerancia: se compara por igualdad exacta de flotantes, así que es ingandable.`
          )
        )
      }
    }
  })

  return findings
}
