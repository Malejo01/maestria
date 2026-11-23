'use client'

import { useEffect } from 'react'
import type { Question } from '@/lib/types'
import { captureClientInvariant } from '@/lib/observability'
import { MultipleChoiceInput } from './multiple-choice-input'
import { ShortAnswerInput } from './short-answer-input'
import { TrueFalseInput } from './true-false-input'
import { NumericInput } from './numeric-input'
import { MultipleResponseInput } from './multiple-response-input'
import { MatchingInput } from './matching-input'
import { OrderingInput } from './ordering-input'
import { ordenInicial } from '@/lib/tipos-moodle'

export type AnswerSelection =
  | { type: 'multiple_choice'; value: number | null }
  | { type: 'short_answer'; value: string }
  | { type: 'true_false'; value: boolean | null }
  // `texto`: lo que escribió (K2: `6/8` no es `3/4` si pide la irreducible).
  | { type: 'numeric'; value: number | null; texto?: string }
  // F2: los índices marcados.
  | { type: 'multiple_response'; value: number[] }
  // F3: lo elegido para cada elemento de la izquierda.
  | { type: 'matching'; value: (string | null)[] }
  // F4: los índices de los elementos, en el orden en que están.
  | { type: 'ordering'; value: number[] }

export function emptySelectionFor(question: Question): AnswerSelection {
  switch (question.type) {
    case 'multiple_choice':
      return { type: 'multiple_choice', value: null }
    case 'short_answer':
      return { type: 'short_answer', value: '' }
    case 'true_false':
      return { type: 'true_false', value: null }
    case 'numeric':
      return { type: 'numeric', value: null }
    case 'multiple_response':
      return { type: 'multiple_response', value: [] }
    case 'matching':
      return { type: 'matching', value: question.pairs.map(() => null) }
    case 'ordering':
      return { type: 'ordering', value: ordenInicial(question) }
  }
}

interface AnswerInputProps {
  question: Question
  selection: AnswerSelection
  submitted: boolean
  onChange: (selection: AnswerSelection) => void
  isCorrect?: boolean | null
  disabled?: boolean
  /** Teacher preview inline editor (multiple_choice only, see quiz-engine.tsx). */
  editing?: boolean
  editedOptions?: string[]
  editedCorrectAnswer?: number
  onEditOption?: (index: number, value: string) => void
  onEditCorrectAnswer?: (index: number) => void
}

export function AnswerInput({
  question,
  selection,
  submitted,
  onChange,
  isCorrect,
  disabled,
  editing,
  editedOptions,
  editedCorrectAnswer,
  onEditOption,
  onEditCorrectAnswer,
}: AnswerInputProps) {
  if (question.type === 'multiple_choice' && selection.type === 'multiple_choice') {
    return (
      <MultipleChoiceInput
        question={question}
        selected={selection.value}
        submitted={submitted}
        disabled={disabled}
        editing={editing}
        editedOptions={editedOptions}
        editedCorrectAnswer={editedCorrectAnswer}
        onEditOption={onEditOption}
        onEditCorrectAnswer={onEditCorrectAnswer}
        onSelect={(value) => onChange({ type: 'multiple_choice', value })}
      />
    )
  }

  if (question.type === 'true_false' && selection.type === 'true_false') {
    return (
      <TrueFalseInput
        question={question}
        selected={selection.value}
        submitted={submitted}
        disabled={disabled}
        onSelect={(value) => onChange({ type: 'true_false', value })}
      />
    )
  }

  if (question.type === 'numeric' && selection.type === 'numeric') {
    return (
      <NumericInput
        question={question}
        value={selection.value}
        submitted={submitted}
        disabled={disabled}
        isCorrect={isCorrect}
        onChange={(value, texto) => onChange({ type: 'numeric', value, texto })}
      />
    )
  }

  if (question.type === 'multiple_response' && selection.type === 'multiple_response') {
    return (
      <MultipleResponseInput
        question={question}
        selected={selection.value}
        submitted={submitted}
        disabled={disabled}
        onChange={(value) => onChange({ type: 'multiple_response', value })}
      />
    )
  }

  if (question.type === 'matching' && selection.type === 'matching') {
    return (
      <MatchingInput
        question={question}
        selected={selection.value}
        submitted={submitted}
        disabled={disabled}
        onChange={(value) => onChange({ type: 'matching', value })}
      />
    )
  }

  if (question.type === 'ordering' && selection.type === 'ordering') {
    return (
      <OrderingInput
        question={question}
        orden={selection.value}
        submitted={submitted}
        disabled={disabled}
        onChange={(value) => onChange({ type: 'ordering', value })}
      />
    )
  }

  if (question.type === 'short_answer' && selection.type === 'short_answer') {
    return (
      <ShortAnswerInput
        question={question}
        value={selection.value}
        submitted={submitted}
        disabled={disabled}
        isCorrect={isCorrect}
        onChange={(value) => onChange({ type: 'short_answer', value })}
      />
    )
  }

  return <MismatchedSelection questionType={question.type} selectionType={selection.type} />
}

/**
 * Unreachable by construction: QuizEngine remounts this whole subtree per
 * question, so the selection is always the empty one built from the question
 * being rendered. It stays here because the only thing worse than this state
 * existing is it existing quietly — the previous `return null` left the
 * student staring at a statement with no input and left us with nothing in the
 * panel. If a new question type ever lands in `Question` without its branch
 * above, this is what tells us.
 */
function MismatchedSelection({ questionType, selectionType }: { questionType: string; selectionType: string }) {
  useEffect(() => {
    captureClientInvariant(
      new Error(`AnswerInput: la selección "${selectionType}" no corresponde a una pregunta "${questionType}"`),
      { component: 'AnswerInput', expected: questionType, received: selectionType },
    )
  }, [questionType, selectionType])

  return (
    <p className="text-sm text-muted-foreground border-2 border-dashed border-border rounded-xl p-4">
      No se pudo mostrar el campo de respuesta para esta pregunta. Ya nos avisamos del problema.
    </p>
  )
}
