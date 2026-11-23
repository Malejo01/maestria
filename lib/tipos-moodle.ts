import type { Answer, MatchingQuestion, MultipleResponseQuestion, Question, QuestionType } from '@/lib/types'

/**
 * Ronda T · F2 a F7 — Los tipos de pregunta "como en Moodle", en un solo
 * lugar para lo que no es de un componente: cómo se corrigen, cómo se leen en
 * texto (resultados, historial, buzón, informe) y cómo se guardan.
 *
 * Los tipos de siempre (opción múltiple, verdadero o falso, numérica,
 * respuesta corta) siguen donde estaban; estos se suman acá para que cada
 * tipo nuevo toque este archivo, su componente de respuesta y la exportación.
 */
export const TIPOS_MOODLE = ['multiple_response', 'matching'] as const satisfies readonly QuestionType[]
export type TipoMoodle = (typeof TIPOS_MOODLE)[number]

export function esTipoMoodle(tipo: unknown): tipo is TipoMoodle {
  return (TIPOS_MOODLE as readonly string[]).includes(String(tipo))
}

/** Para los atajos de teclado: los tipos como en Moodle no tienen atajos propios. */
export function tipoParaAtajos(tipo: QuestionType): 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer' {
  return esTipoMoodle(tipo) ? 'short_answer' : (tipo as 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer')
}

export const ETIQUETA_DE_TIPO: Record<QuestionType, string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero o falso',
  numeric: 'Numérica',
  short_answer: 'Respuesta corta',
  multiple_response: 'Varias correctas',
  matching: 'Emparejamiento',
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

// ─── F3 · Emparejamiento ────────────────────────────────────────────────────

const normal = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()

/** Todo o nada: cada elemento de la izquierda con su pareja. */
export function corregirEmparejamiento(pares: readonly { right: string }[], elegidas: readonly (string | null)[]): boolean {
  return pares.length > 0 && pares.every((p, i) => normal(elegidas[i]) === normal(p.right))
}

/** Las respuestas que se ofrecen: las de los pares (sin repetir) y los distractores. */
export function respuestasDelEmparejamiento(q: Pick<MatchingQuestion, 'pairs' | 'distractors'>): string[] {
  return [...new Set([...q.pairs.map((p) => normal(p.right)), ...(q.distractors ?? []).map(normal)].filter(Boolean))]
}

/**
 * Un emparejamiento que sirve: de 3 a 8 pares con los dos lados escritos, sin
 * repetir la izquierda ni la derecha (dos izquierdas con la misma respuesta
 * no se pueden distinguir), y los distractores distintos de las respuestas.
 * Moodle además exige al menos tres respuestas.
 */
export function emparejamientoValido(q: Pick<MatchingQuestion, 'pairs' | 'distractors'>): boolean {
  if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 8) return false
  if (!q.pairs.every((p) => normal(p?.left) && normal(p?.right))) return false
  const izq = new Set(q.pairs.map((p) => normal(p.left).toLowerCase()))
  const der = new Set(q.pairs.map((p) => normal(p.right).toLowerCase()))
  if (izq.size !== q.pairs.length || der.size !== q.pairs.length) return false
  return (q.distractors ?? []).every((d) => normal(d) && !der.has(normal(d).toLowerCase()))
}

/**
 * Un orden barajado y fijo para una pregunta (el mismo en cada render y en
 * cada recarga): se siembra con su id.
 */
export function barajarFijo<T>(items: readonly T[], semilla: string): T[] {
  let h = 2166136261
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const salida = [...items]
  for (let i = salida.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    const j = h % (i + 1)
    ;[salida[i], salida[j]] = [salida[j], salida[i]]
  }
  return salida
}

// ─── En texto ───────────────────────────────────────────────────────────────

/** La respuesta correcta de una pregunta de tipo Moodle, en texto. null si no es de estos tipos. */
export function correctaEnTexto(q: Question): string | null {
  switch (q.type) {
    case 'multiple_response':
      return opcionesEnTexto(q.options, q.correctAnswers)
    case 'matching':
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ')
    default:
      return null
  }
}

/** Lo que respondió (o lo correcto), en texto, para una respuesta de tipo Moodle. null si no es de estos tipos. */
export function respuestaEnTexto(a: Answer, cual: 'selected' | 'correct'): string | null {
  switch (a.type) {
    case 'multiple_response':
      return opcionesEnTexto(a.options, cual === 'selected' ? a.selectedAnswers : a.correctAnswers)
    case 'matching':
      return a.pairs.map((p, i) => `${p.left} → ${cual === 'selected' ? (a.selectedRights[i] ?? '—') : p.right}`).join(' · ')
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
    case 'matching':
      return { tipo: a.type, pairs: a.pairs, selectedRights: a.selectedRights, ...texto }
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
    case 'matching':
      return emparejamientoValido(q as unknown as MatchingQuestion) ? null : 'emparejamiento sin 3 a 8 pares distintos'
    default:
      return null
  }
}
