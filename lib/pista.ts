import type { Question } from '@/lib/types'

/**
 * Ronda X · X1 — La pista antes de responder.
 *
 * Una sola regla para el botón y para la ruta: la pista existe en la práctica
 * libre, en la práctica extra de una tarea y en la práctica del día del
 * autodidacta. Nunca en lo que tiene nota o mide: tareas (incluidos los
 * diagnósticos del aula, que son tareas), diagnósticos sin devolución,
 * simulacros, ni en la vista previa del docente.
 */
export interface ContextoDePista {
  assignmentId?: number | null
  practicaExtraId?: number | null
  practicaDeTarea?: number | null
  previewOnly?: boolean
  devolucion?: 'inmediata' | 'al_final'
  limiteMinutos?: number | null
  autodidacta?: { tipo: 'diagnostico' | 'practica' | 'simulacro' } | null
}

export function pistaPermitida(contexto: ContextoDePista | null | undefined): boolean {
  if (!contexto) return true
  if (contexto.previewOnly) return false
  if (contexto.assignmentId) return false
  if (contexto.devolucion === 'al_final') return false
  if (contexto.limiteMinutos) return false
  if (contexto.autodidacta) return contexto.autodidacta.tipo === 'practica'
  return true
}

export const LARGO_MAXIMO_PISTA = 280

/** Sin tildes, en minúsculas y con los espacios juntos: para comparar texto. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Los números de un texto, con coma o punto decimal, como números. */
function numerosDe(texto: string): number[] {
  return [...texto.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(',', '.')))
}

/**
 * Lo que, si aparece en la pista, la regala: el texto de la opción correcta,
 * las respuestas aceptadas, el número de la numérica. Los textos muy cortos
 * (una letra, "sí") no se miran como texto: darían falsos positivos.
 */
function loQueLaRegala(q: Question): { textos: string[]; numeros: number[] } {
  switch (q.type) {
    case 'multiple_choice':
    case 'missing_word':
      return { textos: [q.options[q.correctAnswer] ?? ''], numeros: [] }
    case 'multiple_response':
      return { textos: q.correctAnswers.map((i) => q.options[i] ?? ''), numeros: [] }
    case 'short_answer':
      return { textos: q.acceptedAnswers, numeros: [] }
    case 'numeric':
    case 'calculated':
      return { textos: [], numeros: [q.correctAnswer] }
    default:
      return { textos: [], numeros: [] }
  }
}

/** ¿La pista dice la respuesta? Se mira antes de mostrarla; si la dice, no se muestra. */
export function pistaRevelaLaRespuesta(pista: string, q: Question): boolean {
  const texto = normalizar(pista)
  const { textos, numeros } = loQueLaRegala(q)
  for (const t of textos) {
    const n = normalizar(String(t))
    // Un número suelto se mira como número (abajo), no como texto.
    if (/^-?\d+(?:[.,]\d+)?$/.test(n)) {
      numeros.push(Number(n.replace(',', '.')))
      continue
    }
    if (n.length >= 4 && texto.includes(n)) return true
  }
  if (numeros.length > 0) {
    const enLaPista = numerosDe(pista)
    for (const objetivo of numeros) {
      if (!Number.isFinite(objetivo)) continue
      if (enLaPista.some((x) => Math.abs(x - objetivo) < 1e-9)) {
        // Un número que ya está en el enunciado no regala nada.
        if (!numerosDe(q.question).some((x) => Math.abs(x - objetivo) < 1e-9)) return true
      }
    }
  }
  if (q.type === 'true_false' && /\b(es|son|resulta) (verdader|fals)/.test(texto)) return true
  return false
}

/** La pista limpia: sin markdown pesado, sin emojis y con tope. */
export function limpiarPista(cruda: unknown): string {
  return String(cruda ?? '')
    .replace(/\*\*/g, '')
    // Sin emojis, aunque el modelo a veces los pone igual.
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO_PISTA)
}
