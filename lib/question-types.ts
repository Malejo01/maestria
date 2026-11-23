import { ArrowRightLeft, ArrowUpDown, Calculator, CheckSquare, Hash, ListChecks, Move, PenLine, SpellCheck, TextCursorInput, ToggleLeft, type LucideIcon } from 'lucide-react'
import type { QuestionType } from '@/lib/types'

export interface QuestionTypeOption {
  value: QuestionType
  label: string
  description: string
  Icon: LucideIcon
}

/**
 * The one place that lists the question types a quiz can mix. generate-quiz
 * already supports all four end to end (schema, prompt, grading, Moodle
 * export) — this is what was missing: nothing in the UI let a teacher or
 * student actually ask for anything besides multiple_choice.
 */
export const QUESTION_TYPE_OPTIONS: QuestionTypeOption[] = [
  {
    value: 'multiple_choice',
    label: 'Opción múltiple',
    description: '4 opciones, una correcta.',
    Icon: CheckSquare,
  },
  {
    value: 'true_false',
    label: 'Verdadero o falso',
    description: 'Afirmaciones para validar.',
    Icon: ToggleLeft,
  },
  {
    value: 'short_answer',
    label: 'Respuesta corta',
    description: 'El alumno escribe la respuesta; la IA la corrige.',
    Icon: PenLine,
  },
  {
    value: 'numeric',
    label: 'Respuesta numérica',
    description: 'El alumno ingresa un número.',
    Icon: Hash,
  },
  // Ronda T · F2 a F7: los tipos como en Moodle (F8 los agrupa en "Más tipos").
  {
    value: 'multiple_response',
    label: 'Varias correctas',
    description: 'Opción múltiple con más de una correcta.',
    Icon: ListChecks,
  },
  {
    value: 'matching',
    label: 'Emparejamiento',
    description: 'Unir cada elemento con su pareja.',
    Icon: ArrowRightLeft,
  },
  {
    value: 'ordering',
    label: 'Ordenamiento',
    description: 'Poner los elementos en orden.',
    Icon: ArrowUpDown,
  },
  {
    value: 'gapselect',
    label: 'Seleccionar la palabra',
    description: 'Un texto con huecos; en cada uno se elige la palabra.',
    Icon: TextCursorInput,
  },
  {
    value: 'ddwtos',
    label: 'Arrastrar al texto',
    description: 'Un texto con huecos y un banco de palabras para poner.',
    Icon: Move,
  },
  {
    value: 'missing_word',
    label: 'Palabra faltante',
    description: 'Una oración con un hueco y opciones.',
    Icon: SpellCheck,
  },
  {
    value: 'calculated',
    label: 'Calculada',
    description: 'Una cuenta con datos que cambian en cada alumno.',
    Icon: Calculator,
  },
]

export const DEFAULT_QUESTION_TYPES: QuestionType[] = ['multiple_choice']
