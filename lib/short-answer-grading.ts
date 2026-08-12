/**
 * Comparación determinista para respuestas cortas, previa a la corrección con IA.
 *
 * Contexto: en una prueba con 30 alumnos, 225 de 238 respuestas `short_answer`
 * quedaron incorrectas. Buena parte fue porque `/api/quiz/grade-short-answer`
 * falló (~224 veces) y ese handler no tiene fallback, pero el problema de fondo
 * es que hoy TODA respuesta corta depende de que un LLM opine bien: un alumno
 * que escribe exactamente "9" cuando la aceptada es "9" igual queda a merced de
 * una llamada de red. Este módulo resuelve ese caso sin salir del proceso.
 *
 * Es deliberadamente puro y conservador. Su única obligación dura es NO generar
 * falsos positivos: si dice `true`, la respuesta se da por correcta sin que
 * nadie más la mire, así que ante la duda devuelve `false` y deja que la IA (o
 * el docente) decida. Un falso negativo cuesta una llamada a Gemini; un falso
 * positivo le regala la nota a un alumno que se equivocó.
 *
 * Fuera de alcance a propósito: equivalencia numérica (fracciones, coma vs.
 * punto decimal, porcentajes). Eso vive en `lib/numeric-answer.ts`. Acá "3,5"
 * contra "3.5" da `false` y está bien — quien componga los dos correctores
 * decide el orden, este módulo no importa al otro.
 */

/** Caracteres de ancho cero que se cuelan al copiar y pegar o en salida de LLM. */
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g

/**
 * Comillas tipográficas y guiones "largos" a su forma recta. Un alumno que
 * escribe desde el celular manda ’ donde el enunciado tiene ', y el signo menos
 * unicode (−, U+2212) aparece en cualquier respuesta que el LLM haya generado
 * como LaTeX. Son el mismo carácter a los fines de una respuesta.
 */
const TYPOGRAPHIC: Array<[RegExp, string]> = [
  [/[‘’‚‛′]/g, "'"],
  [/[“”„‟″«»]/g, '"'],
  [/[−–—―]/g, '-'],
]

/**
 * Saca los delimitadores de LaTeX que ENVUELVEN toda la respuesta.
 *
 * Sólo el envoltorio completo, nunca ocurrencias sueltas: las `acceptedAnswers`
 * vienen crudas del LLM (`"$(x+1)^2$"`, `"$\\text{Parábola}$"`) y ahí el `$` no
 * aporta nada, pero en una respuesta como "$a$ más $b$" los `$` sí separan
 * partes y borrarlos a ciegas cambiaría el contenido. Por eso cada regla exige
 * que el interior no vuelva a contener el propio delimitador.
 *
 * Itera hasta que se estabiliza porque los envoltorios se anidan: `$\text{x}$`
 * necesita dos pasadas.
 */
function stripLatexWrappers(input: string): string {
  let value = input.trim()

  for (let pass = 0; pass < 5; pass++) {
    const before = value

    // $...$ y $$...$$ (el interior no puede tener otro $, si no "a$ y $b" caería acá)
    const dollar = value.match(/^\$\$?([^$]*)\$\$?$/)
    if (dollar) value = dollar[1].trim()

    // \(...\) y \[...\]
    const paren = value.match(/^\\\(([\s\S]*)\\\)$/) ?? value.match(/^\\\[([\s\S]*)\\\]$/)
    if (paren) value = paren[1].trim()

    // \text{...} — el interior no puede tener } para no comerse "\text{a} y \text{b}"
    const text = value.match(/^\\text\{([^}]*)\}$/)
    if (text) value = text[1].trim()

    if (value === before) break
  }

  return value
}

/**
 * Forma canónica de una respuesta escrita, para comparar por igualdad exacta.
 *
 * Cada regla que se agregue acá agranda el conjunto de cadenas que colapsan en
 * la misma clave, o sea, agranda la superficie de falsos positivos. El criterio
 * usado para aceptar una regla es que la diferencia que borra no pueda ser
 * nunca la diferencia entre dos respuestas conceptualmente distintas.
 *
 * Por eso NO se toca la puntuación interna: sacar la coma de "1,5" lo volvería
 * "15", que es otra respuesta. Sólo se saca la puntuación FINAL, que es prosa
 * ("Parábola." vs "Parábola").
 *
 * Y por eso la `ñ` sobrevive. La regla de tildes decompone y saca el diacrítico
 * sólo cuando la base es una vocal: "año" y "ano" son palabras distintas, y en
 * una materia de biología o en un enunciado de lengua mapearlas juntas sería
 * exactamente el falso positivo que este módulo promete no cometer. El costo es
 * nulo: nadie escribe "ano" queriendo decir "año".
 */
export function normalizeAnswerText(raw: string): string {
  if (typeof raw !== 'string') return ''

  let value = raw.replace(ZERO_WIDTH, '')

  for (const [pattern, replacement] of TYPOGRAPHIC) {
    value = value.replace(pattern, replacement)
  }

  value = stripLatexWrappers(value).toLowerCase()

  value = value
    // Tildes fuera, pero sólo sobre vocales (ver el comentario del bloque):
    // NFD parte "á" en "a" + U+0301, y este reemplazo se queda con la base.
    // La "ñ" queda como "n" + U+0303 y el NFC de abajo la recompone intacta.
    .normalize('NFD')
    .replace(/([aeiou])[\u0300-\u036f]+/g, '$1')
    .normalize('NFC')
    // Saltos de línea y tabs cuentan como espacio: los textareas mandan un "\n"
    // final que el alumno nunca tipeó a propósito.
    .replace(/\s+/g, ' ')
    .trim()
    // Puntuación de apertura y de cierre que no cambia el significado.
    //
    // El '?' entra en la lista, y la decisión tiene historia: la primera versión
    // lo dejaba afuera razonando que un signo de pregunta señala que el alumno
    // no está seguro, y que eso no es lo mismo que afirmar. El contraargumento
    // que ganó es de dónde salen estas respuestas — un teclado de celular, con
    // el '?' pegado a la tecla de enviar. Es más probable que sea ruido de
    // tipeo que una duda deliberada, y el costo de los dos errores no es
    // simétrico: descartar una respuesta correcta por un carácter que el alumno
    // no quiso poner es peor que aceptar una que escribió dudando y acertó.
    .replace(/^[¿¡]+/, '')
    .replace(/[.,;:!?]+$/, '')
    .trim()

  return value
}

/**
 * ¿La respuesta del alumno es literalmente alguna de las aceptadas?
 *
 * Igualdad exacta sobre la forma canónica: nada de subcadenas ni de distancia
 * de edición. "12" contra "13" y "neutro" contra "conmutativa" tienen que dar
 * `false`, y cualquier heurística de parecido termina aceptando uno de esos.
 * Las respuestas evasivas ("no sé", "no lo se") no necesitan lista negra: sólo
 * coincidirían si el docente hubiera aceptado justamente esa cadena.
 *
 * Una respuesta vacía o en blanco nunca coincide, aunque la lista de aceptadas
 * traiga basura vacía — que la trae, porque la genera un LLM.
 */
export function matchesAcceptedAnswer(studentAnswer: string, acceptedAnswers: string[]): boolean {
  const student = normalizeAnswerText(studentAnswer)
  if (!student) return false
  if (!Array.isArray(acceptedAnswers)) return false

  return acceptedAnswers.some((accepted) => {
    const candidate = normalizeAnswerText(accepted)
    return candidate.length > 0 && candidate === student
  })
}
