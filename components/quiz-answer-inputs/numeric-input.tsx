'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNumericAnswer, parseNumericAnswer } from '@/lib/numeric-answer'
import type { NumericQuestion } from '@/lib/types'

interface NumericInputProps {
  question: NumericQuestion
  value: number | null
  submitted: boolean
  onChange: (value: number | null) => void
  isCorrect?: boolean | null
  disabled?: boolean
}

/**
 * Entrada de una respuesta numérica.
 *
 * Era `type="number"`, y eso rompía el caso más común de este país: la mayoría
 * de los navegadores **descartan la coma decimal** en un input numérico, así
 * que un alumno en es-AR que escribía `3,5` obtenía un valor vacío. El botón
 * "Verificar" quedaba deshabilitado sin decir por qué, y el alumno no tenía
 * forma de saber que el problema era el separador decimal.
 *
 * Ahora es texto libre interpretado con `parseNumericAnswer`, que ya entendía
 * coma, punto, fracción (`7/4`), LaTeX (`\frac{7}{4}`) y porcentaje — un módulo
 * escrito, testeado y sin usar en este camino.
 *
 * Aceptar más formas no alcanza por sí solo: si el alumno escribe `1/2` y no
 * ve qué entendimos, no puede detectar que quisimos leer otra cosa. Por eso el
 * input devuelve la interpretación en pantalla ("Leímos: 0,5") y avisa **antes**
 * de enviar cuando no puede interpretar nada.
 */
export function NumericInput({ question, value, submitted, onChange, isCorrect, disabled = false }: NumericInputProps) {
  /**
   * El texto crudo es la fuente de verdad de este componente, y no se
   * sincroniza nunca desde `value`: el padre sólo conoce el número ya
   * interpretado, así que copiar de vuelta perdería la forma que el alumno
   * escribió (`1/2` se volvería `0,5` mientras tipea). El engine remonta este
   * componente por pregunta con `key`, de modo que el inicializador alcanza
   * para que el estado no sobreviva a la pregunta que lo originó.
   */
  const [raw, setRaw] = useState(() => (value === null ? '' : formatNumericAnswer(value)))

  const parsed = useMemo(() => parseNumericAnswer(raw), [raw])
  const hasText = raw.trim().length > 0
  const noSeEntiende = hasText && parsed === null

  return (
    <div className="space-y-3">
      <input
        // `text`, no `number`: es el arreglo. `inputMode="decimal"` sigue
        // pidiéndole al celular el teclado numérico, que es lo único que
        // valía la pena de `type="number"`.
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={raw}
        onChange={(event) => {
          const next = event.target.value
          setRaw(next)
          onChange(parseNumericAnswer(next))
        }}
        disabled={submitted || disabled}
        placeholder="Escribí tu respuesta (podés usar coma o fracción)"
        aria-invalid={noSeEntiende}
        aria-describedby={noSeEntiende ? 'numeric-input-error' : undefined}
        className={cn(
          'w-full p-4 rounded-2xl border-2 bg-card/80 backdrop-blur-sm text-lg font-bold text-center transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[var(--algebra)]/40',
          !submitted && !noSeEntiende && 'border-border focus:border-[var(--algebra)]',
          !submitted && noSeEntiende && 'border-amber-400 focus:border-amber-500',
          submitted && isCorrect && 'border-[var(--analysis)] bg-[var(--analysis-light)] border-4',
          submitted && isCorrect === false && 'border-destructive bg-destructive/10 border-4'
        )}
      />

      {/* Qué entendimos. Sólo cuando aporta algo: si el alumno escribió "3,5"
          y leímos 3,5, repetírselo es ruido; el valor está en confirmar las
          formas que se transforman — fracciones, LaTeX, porcentajes. */}
      {!submitted && parsed !== null && formatNumericAnswer(parsed) !== raw.trim() && (
        <p className="text-center text-sm text-muted-foreground">
          Leímos: <strong className="text-foreground">{formatNumericAnswer(parsed)}</strong>
        </p>
      )}

      {/* El aviso llega ANTES de enviar, que es todo el punto: con el input
          viejo el alumno se quedaba mirando un botón deshabilitado y sin causa. */}
      {!submitted && noSeEntiende && (
        <p id="numeric-input-error" className="text-center text-sm text-amber-700">
          No entendimos ese número. Podés escribirlo con coma (<code>3,5</code>), con punto
          (<code>3.5</code>) o como fracción (<code>7/2</code>).
        </p>
      )}

      {submitted && isCorrect === false && (
        <Card className="p-3 rounded-xl border border-[var(--analysis)]/30 bg-[var(--analysis-light)] text-center">
          <span className="text-sm font-semibold text-[var(--analysis)]">
            Respuesta correcta: {formatNumericAnswer(question.correctAnswer)}
            {question.tolerance ? ` (± ${formatNumericAnswer(question.tolerance)})` : ''}
          </span>
        </Card>
      )}
    </div>
  )
}
