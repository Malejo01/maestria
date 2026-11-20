'use client'

import { useState, type KeyboardEvent } from 'react'
import { Check, X } from 'lucide-react'
import { ATRIBUTO_DE_OPCION } from '@/components/quiz-atajos'
import { moverEnOpciones } from '@/lib/atajos-cuestionario'
import { ATAJOS } from '@/lib/textos'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { cn } from '@/lib/utils'
import type { MultipleChoiceQuestion } from '@/lib/types'

interface MultipleChoiceInputProps {
  question: MultipleChoiceQuestion
  selected: number | null
  submitted: boolean
  onSelect: (index: number) => void
  /** Teacher preview inline editor — when set, options render as text inputs instead. */
  editing?: boolean
  editedOptions?: string[]
  editedCorrectAnswer?: number
  onEditOption?: (index: number, value: string) => void
  onEditCorrectAnswer?: (index: number) => void
  disabled?: boolean
}

export function MultipleChoiceInput({
  question,
  selected,
  submitted,
  onSelect,
  editing = false,
  editedOptions,
  editedCorrectAnswer,
  onEditOption,
  onEditCorrectAnswer,
  disabled = false,
}: MultipleChoiceInputProps) {
  // L2: radiogroup con roving tabindex (patrón WAI-ARIA): un solo Tab entra al
  // grupo, ↑/↓ mueven el foco entre opciones y Espacio elige la enfocada.
  const [enfocada, setEnfocada] = useState<number | null>(null)
  const activa = enfocada ?? selected ?? 0

  function alPresionar(evento: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    evento.stopPropagation()
    const siguiente = moverEnOpciones(index, evento.key === 'ArrowDown' ? 1 : -1, question.options.length)
    const grupo = evento.currentTarget.parentElement
    grupo?.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DE_OPCION}]`)[siguiente]?.focus()
  }

  return (
    <div className="space-y-3" role={editing ? undefined : 'radiogroup'} aria-label={editing ? undefined : ATAJOS.opciones}>
      {question.options.map((option, index) => {
        const isSelected = selected === index
        const isCorrectAnswer = question.correctAnswer === index
        const showCorrect = submitted && isCorrectAnswer
        const showIncorrect = submitted && isSelected && !isCorrectAnswer
        const optionValue = editing ? (editedOptions?.[index] ?? option) : option
        const isDraftCorrect = editing && (editedCorrectAnswer ?? question.correctAnswer) === index
        const letter = String.fromCharCode(65 + index)

        const containerClass = cn(
          'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200',
          'touch-manipulation bg-card/80',
          showIncorrect && '',
          editing && (isDraftCorrect
            ? 'border-logrado bg-logrado-fondo'
            : 'border-border'),
          !editing && disabled && 'border-border opacity-95 cursor-default',
          !editing && !disabled && !submitted && !isSelected && 'border-border hover:border-[var(--algebra)]/50 active:scale-[0.98]',
          !editing && !disabled && !submitted && isSelected && 'border-[var(--algebra)] bg-[var(--algebra-light)]',
          !editing && showCorrect && 'border-logrado bg-logrado-fondo border-4',
          !editing && showIncorrect && 'border-destructive bg-destructive/10 border-4',
          !editing && !disabled && submitted && !showCorrect && !showIncorrect && 'border-border opacity-40'
        )

        const badgeClass = cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold transition-all border-2',
          !editing && !submitted && !isSelected && 'bg-muted text-muted-foreground border-transparent',
          !editing && !submitted && isSelected && 'bg-[var(--algebra)] text-texto-sobre-accion border-[var(--algebra)]',
          !editing && showCorrect && 'bg-logrado text-texto-sobre-accion border-logrado',
          !editing && showIncorrect && 'bg-destructive text-texto-sobre-accion border-destructive',
          editing && (isDraftCorrect
            ? 'bg-logrado text-texto-sobre-accion border-logrado'
            : 'bg-muted text-muted-foreground border-transparent hover:border-logrado/50')
        )

        const badgeContent = submitted && !editing
          ? (showCorrect ? <Check className="w-6 h-6" strokeWidth={3} />
            : showIncorrect ? <X className="w-6 h-6" strokeWidth={3} />
            : letter)
          : isDraftCorrect
            ? <Check className="w-6 h-6" strokeWidth={3} />
            : letter

        // While editing, the row must not be a <button> — it holds a text input
        // and a second button for picking the correct option.
        if (editing) {
          return (
            <div key={index} className={containerClass}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onEditCorrectAnswer?.(index)}
                  className={badgeClass}
                  aria-pressed={isDraftCorrect}
                  aria-label={`Marcar la opción ${letter} como correcta`}
                  title="Marcar como respuesta correcta"
                >
                  {badgeContent}
                </button>
                <span className="flex-1 min-w-0 pt-2.5">
                  <input
                    value={optionValue}
                    onChange={(event) => onEditOption?.(index, event.target.value)}
                    className="w-full border rounded-md px-2 py-1 bg-background text-sm"
                    aria-label={`Texto de la opción ${letter}`}
                  />
                </span>
              </div>
            </div>
          )
        }

        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={index === activa ? 0 : -1}
            {...{ [ATRIBUTO_DE_OPCION]: index }}
            onFocus={() => setEnfocada(index)}
            onKeyDown={(evento) => alPresionar(evento, index)}
            onClick={() => onSelect(index)}
            disabled={submitted || disabled}
            className={containerClass}
          >
            <div className="flex items-start gap-3">
              <div className={badgeClass}>{badgeContent}</div>
              {/* No overflow-x-auto here: option text wraps, and LaTeXRenderer
                  already owns the horizontal overflow of its own fragments. */}
              <span className="flex-1 min-w-0 pt-2.5 font-semibold text-base break-words max-w-full">
                <LaTeXRenderer content={optionValue} className="text-foreground" />
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
