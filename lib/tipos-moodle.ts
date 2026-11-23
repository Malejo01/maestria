import type { Answer, GapsQuestion, MatchingQuestion, MultipleResponseQuestion, OrderingQuestion, Question, QuestionType } from '@/lib/types'

/**
 * Ronda T · F2 a F7 — Los tipos de pregunta "como en Moodle", en un solo
 * lugar para lo que no es de un componente: cómo se corrigen, cómo se leen en
 * texto (resultados, historial, buzón, informe) y cómo se guardan.
 *
 * Los tipos de siempre (opción múltiple, verdadero o falso, numérica,
 * respuesta corta) siguen donde estaban; estos se suman acá para que cada
 * tipo nuevo toque este archivo, su componente de respuesta y la exportación.
 */
export const TIPOS_MOODLE = ['multiple_response', 'matching', 'ordering', 'gapselect', 'ddwtos'] as const satisfies readonly QuestionType[]
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
  ordering: 'Ordenamiento',
  gapselect: 'Seleccionar la palabra',
  ddwtos: 'Arrastrar al texto',
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

// ─── F4 · Ordenamiento ──────────────────────────────────────────────────────

/** Todo o nada: el orden exacto. */
export function corregirOrden(orden: readonly number[]): boolean {
  return orden.length > 0 && orden.every((indice, lugar) => indice === lugar)
}

/** Mueve el elemento del lugar `lugar` un lugar para arriba (−1) o para abajo (+1). */
export function moverEnOrden(orden: readonly number[], lugar: number, paso: -1 | 1): number[] {
  const destino = lugar + paso
  if (destino < 0 || destino >= orden.length) return [...orden]
  const nuevo = [...orden]
  ;[nuevo[lugar], nuevo[destino]] = [nuevo[destino], nuevo[lugar]]
  return nuevo
}

/** El orden con que arranca: barajado siempre igual para la pregunta, y nunca ya ordenado. */
export function ordenInicial(q: Pick<OrderingQuestion, 'id' | 'items'>): number[] {
  const indices = q.items.map((_, i) => i)
  const barajado = barajarFijo(indices, q.id)
  return corregirOrden(barajado) && barajado.length > 1 ? [...barajado.slice(1), barajado[0]] : barajado
}

/** Un ordenamiento que sirve: de 3 a 8 elementos escritos y distintos. */
export function ordenamientoValido(q: Pick<OrderingQuestion, 'items'>): boolean {
  if (!Array.isArray(q.items) || q.items.length < 3 || q.items.length > 8) return false
  const textos = q.items.map((t) => normal(t).toLowerCase())
  return textos.every(Boolean) && new Set(textos).size === textos.length
}

// ─── F5 · Huecos (seleccionar / arrastrar) ──────────────────────────────────

export type ParteDelTexto = { tipo: 'texto'; texto: string } | { tipo: 'hueco'; hueco: number }

/** El texto partido en lo que se lee y los huecos [[n]]. */
export function partesDelTexto(texto: string): ParteDelTexto[] {
  const partes: ParteDelTexto[] = []
  let desde = 0
  for (const m of texto.matchAll(/\[\[(\d+)\]\]/g)) {
    if (m.index! > desde) partes.push({ tipo: 'texto', texto: texto.slice(desde, m.index) })
    partes.push({ tipo: 'hueco', hueco: Number(m[1]) })
    desde = m.index! + m[0].length
  }
  if (desde < texto.length) partes.push({ tipo: 'texto', texto: texto.slice(desde) })
  return partes
}

export const cantidadDeHuecos = (texto: string) => partesDelTexto(texto).filter((p) => p.tipo === 'hueco').length

/** Todo o nada: en cada hueco i, la palabra i. */
export function corregirHuecos(elegidas: readonly (number | null)[], huecos: number): boolean {
  return huecos > 0 && elegidas.length >= huecos && Array.from({ length: huecos }, (_, i) => elegidas[i] === i).every(Boolean)
}

/**
 * Unos huecos que sirven: de 3 a 6, numerados 1..k y cada uno una sola vez,
 * con una palabra para cada uno, más 0 a 4 distractores, todas escritas y
 * distintas (si no, no se sabe cuál es cuál).
 */
export function huecosValidos(q: Pick<GapsQuestion, 'text' | 'choices'>): boolean {
  if (typeof q.text !== 'string' || !Array.isArray(q.choices)) return false
  const numeros = partesDelTexto(q.text).flatMap((p) => (p.tipo === 'hueco' ? [p.hueco] : []))
  const k = numeros.length
  if (k < 3 || k > 6) return false
  if ([...numeros].sort((a, b) => a - b).some((n, i) => n !== i + 1)) return false
  if (q.choices.length < k || q.choices.length > k + 4) return false
  const palabras = q.choices.map((c) => normal(c).toLowerCase())
  return palabras.every(Boolean) && new Set(palabras).size === palabras.length
}

/** El texto con lo de cada hueco entre corchetes (o "___" si está vacío). */
function textoLleno(texto: string, choices: readonly string[], puestas: readonly (number | null)[]): string {
  return partesDelTexto(texto)
    .map((p) => (p.tipo === 'texto' ? p.texto : (() => { const v = puestas[p.hueco - 1]; return v === null || v === undefined ? '[___]' : `[${choices[v] ?? '___'}]` })()))
    .join('')
}

// ─── En texto ───────────────────────────────────────────────────────────────

/** La respuesta correcta de una pregunta de tipo Moodle, en texto. null si no es de estos tipos. */
export function correctaEnTexto(q: Question): string | null {
  switch (q.type) {
    case 'multiple_response':
      return opcionesEnTexto(q.options, q.correctAnswers)
    case 'matching':
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ')
    case 'ordering':
      return q.items.map((t, i) => `${i + 1}. ${t}`).join(' · ')
    case 'gapselect':
    case 'ddwtos':
      return textoLleno(q.text, q.choices, q.choices.map((_, i) => i))
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
    case 'ordering':
      return (cual === 'selected' ? a.selectedOrder.map((i) => a.items[i] ?? '—') : a.items).map((t, i) => `${i + 1}. ${t}`).join(' · ')
    case 'gapselect':
    case 'ddwtos':
      return textoLleno(a.text, a.choices, cual === 'selected' ? a.selectedChoices : a.choices.map((_, i) => i))
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
    case 'ordering':
      return { tipo: a.type, items: a.items, selectedOrder: a.selectedOrder, ...texto }
    case 'gapselect':
    case 'ddwtos':
      return { tipo: a.type, text: a.text, choices: a.choices, selectedChoices: a.selectedChoices, ...texto }
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
    case 'ordering':
      return ordenamientoValido(q as unknown as OrderingQuestion) ? null : 'ordenamiento sin 3 a 8 elementos distintos'
    case 'gapselect':
    case 'ddwtos':
      return huecosValidos(q as unknown as GapsQuestion) ? null : 'huecos sin 3 a 6 numerados con su palabra'
    default:
      return null
  }
}
