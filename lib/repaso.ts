import { diasDeCalendario } from '@/lib/avisos/armar'
import { esTipoMoodle } from '@/lib/tipos-moodle'
import type { Question } from '@/lib/types'

/**
 * Ronda X · X2 — "Repasar hoy": repaso espaciado de lo que el alumno erró.
 *
 * Puro. Cada pregunta (por su enunciado) que alguna vez respondió mal entra al
 * repaso; vuelve a tocar según cuántas veces seguidas la acertó desde el
 * último error: al día siguiente, a los 3, 7, 14 y 30 días. Con cinco
 * aciertos seguidos sale del repaso. Las preguntas salen de lo que ya está
 * guardado (`quiz_answers`): repasar no llama a la IA.
 */
export const INTERVALOS_DIAS = [1, 3, 7, 14, 30] as const
export const MAX_PREGUNTAS_REPASO = 8
/** Cuánto para atrás se mira (y el tope de filas que lee el servidor). */
export const VENTANA_DIAS_REPASO = 120

/** Una fila guardada de `quiz_answers`, con lo de su intento. */
export interface FilaGuardada {
  question_id: string | null
  question_text: string
  question_type: string
  options: unknown
  correct_answer: number | null
  answer_payload: Record<string, unknown> | null
  is_correct: boolean | null
  explanation: string | null
  topic_name: string | null
  /** Cuándo se respondió. */
  el: string
  /** `quiz_attempts.subject` del intento. */
  materia: string
}

/** El enunciado sin tildes, mayúsculas ni espacios de más: la misma pregunta. */
export function claveDePregunta(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const textos = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null)
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/**
 * La pregunta, de vuelta, desde lo que se guardó al responderla. null si no
 * alcanza (una fila vieja incompleta) o si es un ensayo (lo corrige el docente).
 * La calculada vuelve como numérica: el enunciado guardado ya tiene sus números.
 */
export function preguntaDesdeFila(f: FilaGuardada): Question | null {
  const p = f.answer_payload ?? {}
  const tipo = esTipoMoodle(f.question_type) ? f.question_type : esTipoMoodle(p.tipo) ? String(p.tipo) : f.question_type
  const base = {
    id: f.question_id || `repaso-${claveDePregunta(f.question_text).slice(0, 40)}`,
    question: f.question_text,
    topic: f.topic_name || 'repaso',
    topicName: f.topic_name || 'Repaso',
    explanation: f.explanation ?? '',
  }
  if (!base.question?.trim()) return null
  switch (tipo) {
    case 'multiple_choice': {
      const options = textos(typeof f.options === 'string' ? JSON.parse(f.options) : f.options)
      if (!options || options.length < 2 || f.correct_answer === null || !options[f.correct_answer]) return null
      return { ...base, type: 'multiple_choice', options, correctAnswer: f.correct_answer }
    }
    case 'true_false':
      return typeof p.correctAnswer === 'boolean' ? { ...base, type: 'true_false', correctAnswer: p.correctAnswer } : null
    case 'numeric': {
      const correcta = numero(p.correctAnswer)
      if (correcta === null) return null
      const fraccion = p.fraccion as { numerador?: unknown; denominador?: unknown } | undefined
      return {
        ...base,
        type: 'numeric',
        correctAnswer: correcta,
        ...(numero(p.tolerance) !== null ? { tolerance: numero(p.tolerance)! } : {}),
        ...(fraccion && numero(fraccion.numerador) !== null && numero(fraccion.denominador)
          ? { fraccion: { numerador: Number(fraccion.numerador), denominador: Number(fraccion.denominador) }, exigeIrreducible: p.exigeIrreducible === true }
          : {}),
        ...(p.forma === 'factorizacion' ? { forma: 'factorizacion' as const } : {}),
      } as Question
    }
    case 'short_answer': {
      const aceptadas = textos(p.acceptedAnswers)?.filter((t) => t.trim())
      return aceptadas && aceptadas.length > 0 ? { ...base, type: 'short_answer', acceptedAnswers: aceptadas } : null
    }
    case 'multiple_response': {
      const options = textos(p.options)
      const correctas = Array.isArray(p.correctAnswers) ? (p.correctAnswers as number[]) : null
      return options && correctas && correctas.length > 0 ? { ...base, type: 'multiple_response', options, correctAnswers: correctas } : null
    }
    case 'matching': {
      const pairs = Array.isArray(p.pairs) ? (p.pairs as { left: string; right: string }[]) : null
      return pairs && pairs.length >= 2 ? { ...base, type: 'matching', pairs } : null
    }
    case 'ordering': {
      const items = textos(p.items)
      return items && items.length >= 2 ? { ...base, type: 'ordering', items } : null
    }
    case 'gapselect':
    case 'ddwtos': {
      const choices = textos(p.choices)
      return typeof p.text === 'string' && choices ? ({ ...base, type: tipo, text: p.text, choices } as Question) : null
    }
    case 'missing_word': {
      const options = textos(p.options)
      const correcta = numero(p.correctAnswer)
      return typeof p.text === 'string' && options && correcta !== null ? { ...base, type: 'missing_word', text: p.text, options, correctAnswer: correcta } : null
    }
    case 'calculated': {
      const correcta = numero(p.correctAnswer)
      return correcta === null ? null : { ...base, type: 'numeric', correctAnswer: correcta, tolerance: numero(p.tolerance) ?? 0.01 }
    }
    default:
      return null
  }
}

interface Item {
  clave: string
  /** La fila más nueva: de ahí sale la pregunta. */
  ultima: FilaGuardada
  /** La materia de la primera vez que la respondió. */
  materia: string
  fallo: boolean
  /** Aciertos seguidos desde el último error. */
  racha: number
}

function itemsDe(filas: readonly FilaGuardada[]): Item[] {
  const porClave = new Map<string, FilaGuardada[]>()
  for (const f of filas) {
    // Sin calificar (un ensayo, una corta que la IA no corrigió) no dice nada.
    if (f.is_correct === null) continue
    const clave = claveDePregunta(f.question_text)
    if (!clave) continue
    porClave.set(clave, [...(porClave.get(clave) ?? []), f])
  }
  return [...porClave.entries()].map(([clave, lista]) => {
    const orden = [...lista].sort((a, b) => a.el.localeCompare(b.el))
    let racha = 0
    for (let i = orden.length - 1; i >= 0 && orden[i].is_correct; i--) racha++
    return { clave, ultima: orden[orden.length - 1], materia: orden[0].materia, fallo: orden.some((f) => f.is_correct === false), racha }
  })
}

/**
 * Las preguntas que tocan hoy, las más atrasadas primero. Con `materia`, sólo
 * las que se respondieron por primera vez en esa materia (el autodidacta).
 */
export function elegirParaRepasar(
  filas: readonly FilaGuardada[],
  ahora: Date,
  { materia, max = MAX_PREGUNTAS_REPASO }: { materia?: string; max?: number } = {},
): Question[] {
  return itemsDe(filas)
    .filter((it) => it.fallo && it.racha < INTERVALOS_DIAS.length && (!materia || it.materia === materia))
    .map((it) => ({ it, atraso: diasDeCalendario(new Date(it.ultima.el), ahora) - INTERVALOS_DIAS[it.racha] }))
    .filter(({ atraso }) => atraso >= 0)
    .sort((a, b) => b.atraso - a.atraso || a.it.racha - b.it.racha || a.it.ultima.el.localeCompare(b.it.ultima.el))
    .map(({ it }) => preguntaDesdeFila(it.ultima))
    .filter((q): q is Question => q !== null)
    .slice(0, max)
}

/** ¿Practicó en los últimos `dias` días? Para no insistir con la campanita a quien dejó. */
export function practicoHace(filas: readonly { el: string }[], ahora: Date, dias = 7): boolean {
  return filas.some((f) => diasDeCalendario(new Date(f.el), ahora) <= dias)
}
