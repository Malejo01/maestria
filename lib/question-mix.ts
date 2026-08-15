// Relativo, no `@/lib/types`: scripts/seed-curriculum-superior-sistemas.ts
// importa este módulo y corre bajo tsx, fuera del resolver de Next.
import type { QuestionType } from './types'

/**
 * Mezcla de tipos de pregunta: cuánto de cada tipo debe traer un cuestionario.
 *
 * Existe porque elegir QUÉ tipos se permiten no alcanza para decidir CUÁNTO pesa
 * cada uno. El generador, con varios tipos habilitados, los reparte "de forma
 * pareja": con los cuatro tipos activos eso da 50% de preguntas que se resuelven
 * reconociendo la respuesta entre opciones dadas, y sacar esos tipos de la lista
 * los lleva a 0%. Ninguna de las dos es la proporción que quiere una cátedra.
 *
 * El diagnóstico del 2026-08-10 (31 alumnos de la Tecnicatura Superior en
 * Análisis de Sistemas) es el que obliga a distinguirlo:
 *
 *   true_false       79,4% de acierto en Probabilidad, 62-69% en el resto
 *                    ... sobre un piso de 50% por azar: el margen real es chico.
 *   multiple_choice  35,2% global sobre un piso de 25% (4 opciones).
 *   numeric          8,7% en Probabilidad, 16,7% en Sucesiones, 23,9% en Cónicas
 *                    ... sin ningún piso: o se produce la respuesta o no hay nota.
 *
 * Reconocen y no producen. Y la rúbrica de la cátedra evalúa cuatro capacidades
 * —formular problemas, modelar y resolver, interpretar/argumentar/comunicar,
 * evaluar y validar soluciones— y ninguna de las cuatro es reconocer entre
 * opciones. De ahí la separación PRODUCCIÓN / RECONOCIMIENTO de abajo: no es una
 * taxonomía decorativa, es el eje sobre el que se sesga la mezcla.
 */

/** Tipos donde el alumno tiene que PRODUCIR la respuesta. Sin piso por azar. */
export const PRODUCTION_QUESTION_TYPES = ['numeric', 'short_answer'] as const

/** Tipos donde el alumno RECONOCE la respuesta entre opciones dadas. */
export const RECOGNITION_QUESTION_TYPES = ['multiple_choice', 'true_false'] as const

/**
 * Orden canónico: producción primero. Lo usan el desempate del reparto y el
 * armado del prompt, así que la prioridad favorece a producción en los dos
 * lugares donde hay que romper un empate — que es la dirección del sesgo.
 */
const TYPE_PRIORITY: QuestionType[] = [
  ...PRODUCTION_QUESTION_TYPES,
  ...RECOGNITION_QUESTION_TYPES,
]

const PRODUCTION_SET = new Set<QuestionType>(PRODUCTION_QUESTION_TYPES)

/**
 * Pesos relativos por tipo. No tienen que sumar 100 ni nada: lo que importa es
 * la proporción entre ellos, y `distributeQuestionCounts` normaliza. Un tipo
 * ausente pesa 0, que es distinto de estar prohibido — si el alumno lo tilda a
 * mano, `restrictQuestionTypeMix` lo deja entrar.
 */
export type QuestionTypeMix = Partial<Record<QuestionType, number>>

export function isProductionType(type: QuestionType): boolean {
  return PRODUCTION_SET.has(type)
}

function totalWeight(mix: QuestionTypeMix): number {
  return Object.values(mix).reduce((sum, weight) => sum + (weight ?? 0), 0)
}

/**
 * Estrecha un valor de JSONB al contrato de la mezcla.
 *
 * Mismo criterio que `toContextoProfesional` en /api/curriculum/topics: Postgres
 * garantiza que la columna tiene JSON válido, no que tenga esta forma. Lo que no
 * cumple se descarta acá, donde se ve, y no en el prompt.
 */
export function parseQuestionTypeMix(value: unknown): QuestionTypeMix | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined

  const record = value as Record<string, unknown>
  const mix: QuestionTypeMix = {}

  for (const type of TYPE_PRIORITY) {
    const weight = record[type]
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) continue
    mix[type] = weight
  }

  return totalWeight(mix) > 0 ? mix : undefined
}

/**
 * Suma las mezclas de las unidades elegidas.
 *
 * Un cuestionario puede cruzar varias unidades y cada una declara la suya: la de
 * Lógica no puede ser mayoritariamente numérica y la de Derivadas sí. Sumar los
 * pesos hace que el resultado se parezca más a la unidad que más aporta, que es
 * el comportamiento que se quiere; promediar trataría a una unidad suelta igual
 * que a las seis restantes.
 */
export function mergeQuestionTypeMixes(mixes: QuestionTypeMix[]): QuestionTypeMix | undefined {
  const merged: QuestionTypeMix = {}

  for (const mix of mixes) {
    for (const type of TYPE_PRIORITY) {
      const weight = mix[type]
      if (weight === undefined) continue
      merged[type] = (merged[type] ?? 0) + weight
    }
  }

  return totalWeight(merged) > 0 ? merged : undefined
}

/**
 * Recorta la mezcla a los tipos que el cuestionario realmente va a usar.
 *
 * La sugerencia de la cátedra es un default, no un candado: el alumno o el
 * docente pueden destildar tipos en el selector. Cuando eso pasa, los pesos
 * restantes se reparten el 100% entre ellos en vez de quedar sub-representados.
 *
 * Un tipo tildado que la cátedra no pondera entra con el peso mínimo de la
 * mezcla: se pidió explícitamente, así que tiene que aparecer, pero no puede
 * ganarle a lo que el programa sí prioriza.
 */
export function restrictQuestionTypeMix(
  mix: QuestionTypeMix | undefined,
  allowed: QuestionType[]
): QuestionTypeMix | undefined {
  if (!mix || allowed.length === 0) return undefined

  const declared = allowed.map((type) => mix[type]).filter((weight): weight is number => weight !== undefined)
  if (declared.length === 0) return undefined

  const floor = Math.min(...declared)
  const restricted: QuestionTypeMix = {}

  for (const type of TYPE_PRIORITY) {
    if (!allowed.includes(type)) continue
    restricted[type] = mix[type] ?? floor
  }

  return totalWeight(restricted) > 0 ? restricted : undefined
}

/** Los tipos de la mezcla, de mayor a menor peso. Es el default del selector. */
export function questionTypesFromMix(mix: QuestionTypeMix | undefined): QuestionType[] {
  if (!mix) return []

  return TYPE_PRIORITY
    .filter((type) => (mix[type] ?? 0) > 0)
    .sort((a, b) => (mix[b] ?? 0) - (mix[a] ?? 0))
}

/** Fracción del peso total que corresponde a tipos de producción (0 a 1). */
export function productionShare(mix: QuestionTypeMix): number {
  const total = totalWeight(mix)
  if (total <= 0) return 0

  const production = PRODUCTION_QUESTION_TYPES.reduce((sum, type) => sum + (mix[type] ?? 0), 0)
  return production / total
}

export interface QuestionTypeQuota {
  type: QuestionType
  count: number
}

/**
 * Reparte `total` preguntas entre los tipos según sus pesos.
 *
 * Método de restos mayores (cuota Hare): se asignan los enteros y las preguntas
 * que sobran van a los tipos con mayor parte fraccionaria. Redondear cada cuota
 * por separado no sirve — la suma no da `total` y el prompt terminaría pidiendo
 * 21 preguntas de 20.
 *
 * Los empates de resto se desempatan por `TYPE_PRIORITY`, o sea a favor de los
 * tipos de producción. Con 10 preguntas y una mezcla 45/30/20/5, la pregunta
 * sobrante es la diferencia entre 5 y 4 numéricas.
 *
 * Todo tipo presente en la mezcla se lleva al menos una pregunta, siempre que
 * haya preguntas suficientes. Sin eso, un tipo con peso chico desaparece del
 * cuestionario por redondeo: para quien lo tildó a mano en el selector, eso es
 * indistinguible de que la aplicación le haya ignorado la elección.
 */
export function distributeQuestionCounts(
  mix: QuestionTypeMix | undefined,
  total: number
): QuestionTypeQuota[] {
  if (!mix || !Number.isFinite(total) || total < 1) return []

  const weights = TYPE_PRIORITY
    .map((type) => ({ type, weight: mix[type] ?? 0 }))
    .filter((entry) => entry.weight > 0)

  const sum = weights.reduce((acc, entry) => acc + entry.weight, 0)
  if (weights.length === 0 || sum <= 0) return []

  const quotas = weights.map((entry, priority) => {
    const exact = (entry.weight / sum) * Math.floor(total)
    const base = Math.floor(exact)
    return { type: entry.type, count: base, remainder: exact - base, priority }
  })

  let assigned = quotas.reduce((acc, quota) => acc + quota.count, 0)
  const pending = [...quotas].sort((a, b) => b.remainder - a.remainder || a.priority - b.priority)

  for (const quota of pending) {
    if (assigned >= Math.floor(total)) break
    quota.count += 1
    assigned += 1
  }

  // Rescate de los tipos que el redondeo dejó en cero: le sacan una pregunta al
  // tipo más numeroso, que puede permitírselo. Sólo cuando alcanza para todos —
  // con 3 preguntas y 4 tipos, alguno se queda afuera y no hay vuelta.
  if (Math.floor(total) >= quotas.length) {
    for (const quota of quotas) {
      if (quota.count > 0) continue

      const donor = quotas.reduce((max, entry) => (entry.count > max.count ? entry : max), quotas[0])
      if (donor.count <= 1) break

      donor.count -= 1
      quota.count += 1
    }
  }

  return quotas
    .filter((quota) => quota.count > 0)
    .map(({ type, count }) => ({ type, count }))
}

/**
 * Bloque de prompt con el reparto exacto.
 *
 * Es imperativo y numerado por la misma razón que la sección de contexto
 * profesional: una indicación blanda ("priorizá las numéricas") se pierde entre
 * las otras quince reglas del system prompt y el modelo vuelve a su default, que
 * en cualquier corpus de exámenes es la opción múltiple. El "por qué" va incluido
 * a propósito — sin él, el modelo trata los números como una sugerencia de estilo
 * y compensa cuando un tema le resulta incómodo de plantear sin opciones.
 */
export function buildQuestionMixInstruction(
  mix: QuestionTypeMix | undefined,
  total: number
): string {
  const quotas = distributeQuestionCounts(mix, total)
  if (quotas.length === 0) return ''

  const lines = quotas
    .map((quota) => `- ${quota.type}: ${quota.count} pregunta${quota.count === 1 ? '' : 's'}`)
    .join('\n')

  const omitted = TYPE_PRIORITY.filter((type) => !quotas.some((quota) => quota.type === type))
  const omittedNote = omitted.length > 0
    ? `\nNo generes ninguna pregunta de tipo: ${omitted.join(', ')}.`
    : ''

  return `
DISTRIBUCIÓN OBLIGATORIA POR TIPO (respetá los números, no los promedies):
${lines}${omittedNote}

POR QUÉ ESTA DISTRIBUCIÓN:
Está sesgada a propósito hacia los tipos donde el estudiante debe PRODUCIR la
respuesta (${PRODUCTION_QUESTION_TYPES.join(', ')}) y en contra de los tipos donde le alcanza con
RECONOCERLA entre opciones dadas (${RECOGNITION_QUESTION_TYPES.join(', ')}). Reconocer una respuesta
correcta entre cuatro opciones no demuestra ninguna de las capacidades que evalúa
la cátedra: formular problemas, modelar y resolver, interpretar y comunicar, y
evaluar la validez de una solución.
Si un tema te resulta difícil de plantear sin opciones, planteá el caso particular
que se resuelve con un número o con una frase corta: NO lo conviertas en opción
múltiple para salir del paso.`
}
