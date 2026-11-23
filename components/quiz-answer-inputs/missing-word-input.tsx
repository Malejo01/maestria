'use client'

import { LaTeXRenderer } from '@/components/latex-renderer'
import { partesDelTexto } from '@/lib/tipos-moodle'
import { cn } from '@/lib/utils'
import type { MissingWordQuestion, MultipleChoiceQuestion } from '@/lib/types'
import { MultipleChoiceInput } from './multiple-choice-input'

/**
 * Ronda T · F6 — La palabra faltante (en Moodle, el "missing word" de GIFT):
 * una oración con un hueco y las opciones debajo, como una opción múltiple.
 * Lo elegido aparece en el hueco, así se lee la oración completa.
 */
export function MissingWordInput({
  question,
  selected,
  submitted,
  disabled = false,
  onSelect,
}: {
  question: MissingWordQuestion
  selected: number | null
  submitted: boolean
  disabled?: boolean
  onSelect: (index: number) => void
}) {
  const comoOpcionMultiple: MultipleChoiceQuestion = { ...question, type: 'multiple_choice' }
  const bien = submitted && selected === question.correctAnswer
  return (
    <div className="space-y-4">
      <p className="rounded-2xl border-2 border-border bg-card/80 p-4 text-base leading-9 text-texto" data-oracion-con-hueco>
        {partesDelTexto(question.text).map((parte, i) =>
          parte.tipo === 'texto' ? (
            <LaTeXRenderer key={i} content={parte.texto} className="!inline" />
          ) : (
            <span
              key={i}
              className={cn(
                'mx-1 inline-block min-w-20 border-b-2 px-1 text-center font-semibold',
                selected === null ? 'border-borde-fuerte text-texto-suave' : 'border-accion text-texto',
                submitted && (bien ? 'border-logrado text-logrado' : 'border-destructive text-destructive'),
              )}
            >
              {selected === null ? ' ' : question.options[selected]}
            </span>
          ),
        )}
      </p>
      <MultipleChoiceInput question={comoOpcionMultiple} selected={selected} submitted={submitted} disabled={disabled} onSelect={onSelect} />
    </div>
  )
}
