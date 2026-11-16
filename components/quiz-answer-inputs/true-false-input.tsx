'use client'

import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrueFalseQuestion } from '@/lib/types'

interface TrueFalseInputProps {
  question: TrueFalseQuestion
  selected: boolean | null
  submitted: boolean
  onSelect: (value: boolean) => void
  disabled?: boolean
}

export function TrueFalseInput({ question, selected, submitted, onSelect, disabled = false }: TrueFalseInputProps) {
  const options: { value: boolean; label: string }[] = [
    { value: true, label: 'Verdadero' },
    { value: false, label: 'Falso' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map(({ value, label }) => {
        const isSelected = selected === value
        const isCorrectAnswer = question.correctAnswer === value
        const showCorrect = submitted && isCorrectAnswer
        const showIncorrect = submitted && isSelected && !isCorrectAnswer

        return (
          <button
            key={label}
            onClick={() => onSelect(value)}
            disabled={submitted || disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all duration-200 touch-manipulation bg-card/80',
              showIncorrect && '',
              disabled && 'border-border opacity-95 cursor-default',
              !disabled && !submitted && !isSelected && 'border-border hover:border-[var(--algebra)]/50 active:scale-[0.98]',
              !disabled && !submitted && isSelected && 'border-[var(--algebra)] bg-[var(--algebra-light)]',
              showCorrect && 'border-logrado bg-logrado-fondo border-4',
              showIncorrect && 'border-destructive bg-destructive/10 border-4',
              !disabled && submitted && !showCorrect && !showIncorrect && 'border-border opacity-40'
            )}
          >
            {submitted && (showCorrect || showIncorrect) && (
              showCorrect
                ? <Check className="w-6 h-6 text-logrado" strokeWidth={3} />
                : <X className="w-6 h-6 text-destructive" strokeWidth={3} />
            )}
            <span className="text-lg font-bold text-foreground">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
