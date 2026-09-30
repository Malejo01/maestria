/**
 * Alcance de un cuestionario: qué temas puede tocar y qué tipos le caben a cada
 * modo. Vive aparte de lib/quiz-generation.ts para poder testearse sin mocks.
 *
 * Nació de un cuestionario real (30/09/2026, aula del profesorado): el docente
 * eligió UN tema de la Unidad I y recibió preguntas de MCD, primos, racionales,
 * geometría, proporcionalidad y Teoría de las Situaciones Didácticas. El aula
 * manda el programa entero (5 unidades, 53 temas) como `subjectUnits`, y el
 * prompt lo presentaba como CURRICULUM sin decir que el alcance eran los TEMAS.
 * `/practicar` nunca tuvo el problema porque arma `subjectUnits` sólo con los
 * temas elegidos; esto hace que todos los llamadores queden igual.
 */
import type { QuestionType } from '@/lib/quiz-generation'

interface ScopableUnit {
  name?: unknown
  topics?: { name?: unknown }[]
}

function normalizeTopicName(name: unknown): string {
  if (typeof name !== 'string') return ''
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Recorta el programa a las unidades que contienen algún tema elegido, y dentro
 * de cada una a esos temas nada más. Mostrarle al modelo los temas hermanos de
 * la misma unidad es invitarlo a preguntar por ellos.
 *
 * Si ningún tema elegido aparece en el programa (la regeneración de una
 * pregunta manda el `topicName` que escribió la IA, que rara vez coincide
 * textual), devuelve el programa sin tocar: sin coincidencias no hay forma de
 * saber qué unidad es, y el recorte dejaría al modelo sin contexto.
 */
export function scopeUnitsToTopics<U extends ScopableUnit>(
  units: U[],
  topics: { name: string }[]
): U[] {
  if (!Array.isArray(units) || units.length === 0) return units

  const selected = new Set(topics.map((topic) => normalizeTopicName(topic.name)).filter(Boolean))
  if (selected.size === 0) return units

  const scoped = units
    .map((unit) => ({
      ...unit,
      topics: Array.isArray(unit.topics)
        ? unit.topics.filter((topic) => selected.has(normalizeTopicName(topic?.name)))
        : [],
    }))
    .filter((unit) => unit.topics.length > 0)

  return scoped.length > 0 ? scoped : units
}

/**
 * Tipos que le caben a una tanda según su modo.
 *
 * El modo teórico pide "sin cálculos numéricos", y `numeric` es por definición
 * un número que sale de un cálculo. Con los cuatro tipos tildados y el
 * "distribuí parejo", el modelo tenía que meter un cuarto de preguntas
 * numéricas en una tanda conceptual, y lo resolvía con enunciados como
 * "explicá el MCD" y respuesta 0 o 1. Si `numeric` es lo único pedido se
 * respeta: sacarlo dejaría la tanda sin tipos.
 */
export function questionTypesForMode(types: QuestionType[], mode: string): QuestionType[] {
  if (mode !== 'teorico') return types
  const withoutNumeric = types.filter((type) => type !== 'numeric')
  return withoutNumeric.length > 0 ? withoutNumeric : types
}

const CONCEPTUAL_PROMPTS: RegExp[] = [
  // Verbos que piden una respuesta en palabras.
  /\b(expli[cq]\w*|describ\w*|justifi\w*|argument\w*|fundament\w*|defin[ae]\w*|reflexion\w*)\b/i,
  // Preguntas cuya respuesta es un concepto, no un número.
  /¿\s*(por\s*qu[eé]|para\s+qu[eé]|c[oó]mo\s+(lo\s+|la\s+|se\s+)?(explic|justific|corrig|interpret|ense[nñ])|qu[eé]\s+(error|concepto|propiedad|significa|representa|estrategia|procedimiento|m[eé]todo|diferencia|relaci[oó]n|criterio|funci[oó]n))/i,
  // Sí/no o verdadero/falso codificado como número.
  /\b(respond|contest|escrib|coloc|ingres|pon[eé])[\wáéíóú]*\s+(un\s+|el\s+)?[01]\s+(si|para)\b/i,
]

/**
 * Red de seguridad para lo que el prompt no alcance a evitar: una pregunta
 * `numeric` cuyo enunciado pide palabras. No hay forma de convertirla a otro
 * tipo sin inventar las respuestas aceptadas, así que se descarta y el bucle de
 * generación pide otra.
 */
export function isConceptualNumericQuestion(question: { type?: unknown; question?: unknown }): boolean {
  if (question.type !== 'numeric' || typeof question.question !== 'string') return false
  return CONCEPTUAL_PROMPTS.some((pattern) => pattern.test(question.question as string))
}
