import type { Answer, MultipleResponseQuestion, Question, QuestionType } from '@/lib/types'

/**
 * Ronda T · F2 a F7 — Los tipos de pregunta "como en Moodle", en un solo
 * lugar para lo que no es de un componente: cómo se corrigen, cómo se leen en
 * texto (resultados, historial, buzón, informe) y cómo se guardan.
 *
 * Los tipos de siempre (opción múltiple, verdadero o falso, numérica,
 * respuesta corta) siguen donde estaban; estos se suman acá para que cada
 * tipo nuevo toque este archivo, su componente de respuesta y la exportación.
 */
export const TIPOS_MOODLE = ['multiple_response'] as const satisfies readonly QuestionType[]
export type TipoMoodle = (typeof TIPOS_MOODLE)[number]

export function esTipoMoodle(tipo: unknown): tipo is TipoMoodle {
  return (TIPOS_MOODLE as readonly string[]).includes(String(tipo))
}

export const ETIQUETA_DE_TIPO: Record<QuestionType, string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero o falso',
  numeric: 'Numérica',
  short_answer: 'Respuesta corta',
  multiple_response: 'Varias correctas',
}

const letra = (i: number) => String.fromCharCode(65 + i)
const opcionesEnTexto = (opciones: readonly string[], indices: readonly number[]) =>
  [...indices].sort((a, b) => a - b).map((i) => `${letra(i)}) ${opciones[i] ?? ''}`).join(' · ') || '—'

// ─── F2 · Varias correctas ──────────────────────────────────────────────────

/** Todo o nada: vale si marcó exactamente las correctas (ni una más, ni una menos). */
export function corregirVariasCorrectas(correctas: readonly number[], elegidas: readonly number[]): boolean {
  const a = new Set(correctas)
  const b = new Set(elegidas)
  return a.size === b.size && [...a].every((i) => b.has(i))
}

/**
 * Una pregunta de varias correctas que sirve: al menos tres opciones, entre
 * dos correctas y una menos que todas, índices válidos y sin repetir.
 */
export function variasCorrectasValida(q: Pick<MultipleResponseQuestion, 'options' | 'correctAnswers'>): boolean {
  const n = q.options.length
  const correctas = new Set(q.correctAnswers)
  return (
    n >= 3 &&
    q.options.every((o) => typeof o === 'string' && o.trim().length > 0) &&
    correctas.size === q.correctAnswers.length &&
    correctas.size >= 2 &&
    correctas.size < n &&
    [...correctas].every((i) => Number.isInteger(i) && i >= 0 && i < n)
  )
}

/**
 * Las fracciones de Moodle para varias correctas: cada correcta vale 100/k y
 * cada incorrecta −100/(n−k), redondeadas a las que Moodle acepta (las
 * correctas suman 100). Con 2, 3, 4 o 5 correctas: 50, 33.33333, 25, 20.
 */
export function fraccionesVariasCorrectas(cantidad: number, correctas: readonly number[]): number[] {
  const k = Math.max(1, correctas.length)
  const malas = Math.max(1, cantidad - k)
  const redondear = (v: number) => Math.round(v * 1e5) / 1e5
  const positivo = redondear(100 / k)
  const negativo = -redondear(100 / malas)
  const set = new Set(correctas)
  return Array.from({ length: cantidad }, (_, i) => (set.has(i) ? positivo : negativo))
}

// ─── En texto ───────────────────────────────────────────────────────────────

/** La respuesta correcta de una pregunta de tipo Moodle, en texto. null si no es de estos tipos. */
export function correctaEnTexto(q: Question): string | null {
  switch (q.type) {
    case 'multiple_response':
      return opcionesEnTexto(q.options, q.correctAnswers)
    default:
      return null
  }
}

/** Lo que respondió (o lo correcto), en texto, para una respuesta de tipo Moodle. null si no es de estos tipos. */
export function respuestaEnTexto(a: Answer, cual: 'selected' | 'correct'): string | null {
  switch (a.type) {
    case 'multiple_response':
      return opcionesEnTexto(a.options, cual === 'selected' ? a.selectedAnswers : a.correctAnswers)
    default:
      return null
  }
}

// ─── Al guardar ─────────────────────────────────────────────────────────────

/**
 * El `answer_payload` de una respuesta de tipo Moodle. Lleva todo lo del tipo
 * y, además, `selectedText` y `acceptedAnswers` en texto: así cualquier lector
 * que todavía no conoce el tipo (o una base sin la migración 042, donde la
 * fila se guarda como `short_answer`) muestra "Tu respuesta / Correcta" igual.
 */
export function payloadDeRespuesta(a: Answer): Record<string, unknown> | null {
  if (!esTipoMoodle(a.type)) return null
  const texto = { selectedText: respuestaEnTexto(a, 'selected') ?? '', acceptedAnswers: [respuestaEnTexto(a, 'correct') ?? ''] }
  switch (a.type) {
    case 'multiple_response':
      return { tipo: a.type, options: a.options, selectedAnswers: a.selectedAnswers, correctAnswers: a.correctAnswers, ...texto }
  }
  return null
}

/**
 * Lee una fila guardada de tipo Moodle (con `question_type` del tipo, o como
 * `short_answer` con `payload.tipo`, la válvula). null si no lo es.
 */
export function respuestaGuardadaEnTexto(
  questionType: string,
  payload: Record<string, unknown> | null | undefined,
): { elegido: string; correcto: string; tipo: TipoMoodle } | null {
  const tipo = esTipoMoodle(questionType) ? questionType : esTipoMoodle(payload?.tipo) ? (payload?.tipo as TipoMoodle) : null
  if (!tipo || !payload) return null
  const accepted = Array.isArray(payload.acceptedAnswers) ? payload.acceptedAnswers.map(String) : []
  return { tipo, elegido: String(payload.selectedText ?? '—'), correcto: accepted.join(' / ') || '—' }
}

/**
 * Al generar: una pregunta de tipo Moodle que no sirve (por ejemplo, "varias
 * correctas" con una sola correcta) se descarta y el bucle pide otra. null si
 * está bien o no es de estos tipos.
 */
export function problemaDeTipoMoodle(q: Record<string, unknown>): string | null {
  switch (q.type) {
    case 'multiple_response':
      return Array.isArray(q.options) && Array.isArray(q.correctAnswers) && variasCorrectasValida(q as unknown as MultipleResponseQuestion)
        ? null
        : 'varias correctas sin entre 2 y n-1 correctas'
    default:
      return null
  }
}
