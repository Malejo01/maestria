/**
 * Two independent fingerprints used by the quiz generator to drop questions it
 * has already asked in the same run.
 */

/** Lexical fingerprint: same words, ignoring LaTeX, case, accents and punctuation. */
/**
 * Ronda U · U4 — Lo que distingue a una pregunta de otra, en texto. En los
 * tipos de Moodle la consigna suele ser genérica ("Completá el texto con las
 * palabras que faltan.", "Uní cada concepto con su definición.") y lo que
 * cambia está en el texto con huecos, los pares o los pasos: comparar sólo la
 * consigna descartaba como repetida la segunda de cada tipo.
 */
export function contenidoParaComparar(q: { question?: unknown; text?: unknown; pairs?: unknown; items?: unknown; plantilla?: unknown }): string {
  const partes = [String(q.plantilla ?? q.question ?? '')]
  if (typeof q.text === 'string') partes.push(q.text)
  if (Array.isArray(q.pairs)) partes.push(q.pairs.map((p: { left?: unknown }) => String(p?.left ?? '')).join(' · '))
  if (Array.isArray(q.items)) partes.push(q.items.map(String).join(' · '))
  return partes.filter((p) => p.trim()).join(' — ')
}

export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    // Strip accents first. Without this the `[^a-z0-9\s]` pass below turned
    // "cuál" into "cu l", so the same sentence written with and without the
    // accent produced two different fingerprints and slipped past dedup.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$+/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Second-level fingerprint for "same exercise, different wrapper".
 *
 * The lexical fingerprint compares words, so it never catches a pair like
 * "Si calculamos el cuadrado de 7, es decir 7², ¿qué número obtenemos?" (short
 * answer) and "¿Cuál es el resultado de 7²?" (multiple choice) — same exercise,
 * completely different wording. Comparing the numbers plus the operators that
 * appear in the statement does catch it.
 *
 * Deliberately scoped by topic, and the caller only applies it within a single
 * generation run: two questions on different topics that happen to share
 * numbers are not duplicates, and being strict against the student's whole
 * history would reject too much and push the request into the "no variety
 * left" 409.
 *
 * Returns null when the statement carries no numbers — there is nothing to
 * compare, so the caller should fall back to the lexical fingerprint alone.
 */
export function numericSignature(question: { question?: string; topic?: string; topicName?: string }): string | null {
  const raw = String(question.question ?? '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\\frac/g, '/')
    .replace(/\\sqrt/g, '√')
    .replace(/\\times|\\cdot/g, '*')
    .replace(/\\div/g, '/')

  const numbers = raw.match(/\d+(?:[.,]\d+)?/g)
  if (!numbers || numbers.length === 0) return null

  const operators = raw.match(/[+\-*/^√%]/g) ?? []
  const topicKey = String(question.topic || question.topicName || '').toLowerCase().trim()

  // A set, not a multiset: a restatement often repeats a number that the
  // terser version mentions once ("el cuadrado de 7, es decir 7²" carries the
  // 7 twice, "¿Cuál es el resultado de 7²?" only once). Counting occurrences
  // would make those two look different, which is exactly the pair we want to
  // catch.
  const distinctNumbers = [...new Set(numbers.map((n) => n.replace(',', '.')))].sort()

  return [
    topicKey,
    distinctNumbers.join(','),
    [...new Set(operators)].sort().join(''),
  ].join('::')
}
