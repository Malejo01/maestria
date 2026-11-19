import { LaTeXRenderer } from '@/components/latex-renderer'
import type { Answer } from '@/lib/types'
import { respuestaEscrita, respuestaNumerica } from '@/lib/numeros'

function formatValue(answer: Answer, which: 'selected' | 'correct'): string {
  switch (answer.type) {
    case 'multiple_choice': {
      const index = which === 'selected' ? answer.selectedAnswer : answer.correctAnswer
      return `${String.fromCharCode(65 + index)}) ${answer.options[index] ?? ''}`
    }
    case 'true_false': {
      const value = which === 'selected' ? answer.selectedAnswer : answer.correctAnswer
      return value ? 'Verdadero' : 'Falso'
    }
    case 'numeric': {
      if (which === 'selected') return respuestaEscrita(answer.selectedValue, answer.selectedText)
      return respuestaNumerica(answer.correctAnswer, undefined, answer.fraccion)
    }
    case 'short_answer':
      return which === 'selected' ? answer.selectedText : answer.acceptedAnswers.join(' / ')
  }
}

/** "Tu respuesta" vs "Respuesta correcta" recap, rendered the same way regardless of question type. */
export function AnswerRecap({ answer }: { answer: Answer }) {
  return (
    <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 w-full min-w-0 max-w-full">
      <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/25 space-y-1 min-w-0 max-w-full overflow-hidden break-words">
        <span className="text-xs font-bold text-destructive uppercase tracking-wider block">Tu respuesta</span>
        <div className="text-sm font-medium text-foreground break-words min-w-0 overflow-hidden">
          <LaTeXRenderer content={formatValue(answer, 'selected')} />
        </div>
      </div>
      <div className="p-3.5 rounded-2xl bg-logrado/10 border border-logrado/25 space-y-1 min-w-0 max-w-full overflow-hidden break-words">
        <span className="text-xs font-bold text-logrado dark:text-logrado uppercase tracking-wider block">Respuesta correcta</span>
        <div className="text-sm font-medium text-foreground break-words min-w-0 overflow-hidden">
          <LaTeXRenderer content={formatValue(answer, 'correct')} />
        </div>
      </div>
    </div>
  )
}

/** Compact single-line variant used in results-screen's correct/incorrect answer lists. */
export function answerRecapLine(answer: Answer, which: 'selected' | 'correct'): string {
  return formatValue(answer, which)
}
