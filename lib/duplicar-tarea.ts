/**
 * Ronda W · W2 — Duplicar una tarea para mandarla a otro grupo (o al mismo,
 * con fechas nuevas) sin volver a generar: una copia del cuestionario, con
 * las mismas preguntas, que después se manda como cualquier otra.
 *
 * Puro.
 */

/** "Repaso 1" → "Repaso 1 (copia)"; si ya existe, "(copia 2)", "(copia 3)"… */
export function tituloDeCopia(titulo: string, existentes: readonly string[]): string {
  const base = titulo.replace(/\s*\(copia(?: \d+)?\)$/, '').trim() || 'Tarea'
  const usados = new Set(existentes.map((t) => t.trim()))
  if (!usados.has(`${base} (copia)`)) return `${base} (copia)`
  for (let n = 2; n < 1000; n++) if (!usados.has(`${base} (copia ${n})`)) return `${base} (copia ${n})`
  return `${base} (copia ${Date.now()})`
}

/** Las preguntas de la copia: las mismas, con ids en orden (q1, q2…). */
export function preguntasDeLaCopia(preguntas: unknown): Record<string, unknown>[] {
  if (!Array.isArray(preguntas)) return []
  return preguntas
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p, i) => ({ ...p, id: `q${i + 1}` }))
}
