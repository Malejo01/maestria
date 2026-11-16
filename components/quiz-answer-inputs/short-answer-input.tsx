'use client'

import { cn } from '@/lib/utils'
import type { ShortAnswerQuestion } from '@/lib/types'

interface ShortAnswerInputProps {
  question: ShortAnswerQuestion
  value: string
  submitted: boolean
  onChange: (value: string) => void
  isCorrect?: boolean | null
  disabled?: boolean
}

export function ShortAnswerInput({ value, submitted, onChange, isCorrect, disabled = false }: ShortAnswerInputProps) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={submitted || disabled}
      placeholder="Escribí tu respuesta…"
      rows={3}
      className={cn(
        'w-full p-4 rounded-2xl border-2 bg-card/80 text-base font-medium transition-all resize-none',
        'focus:outline-none focus:ring-2 focus:ring-[var(--algebra)]/40',
        !submitted && 'border-border focus:border-[var(--algebra)]',
        submitted && isCorrect && 'border-logrado bg-logrado-fondo border-4',
        submitted && isCorrect === false && 'border-destructive bg-destructive/10 border-4'
      )}
    />
  )
}
