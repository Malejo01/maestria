'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { corregirNumerica, leerRespuesta, textoDelMotivo } from '@/lib/fraccion'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { formatearNumero, respuestaNumerica } from '@/lib/numeros'
import type { NumericQuestion } from '@/lib/types'

interface NumericInputProps {
  question: NumericQuestion
  value: number | null
  submitted: boolean
  /** El número leído y el texto tal cual (K2: la forma importa en una fracción). */
  onChange: (value: number | null, texto: string) => void
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
  const [raw, setRaw] = useState(() => (value === null ? '' : formatearNumero(value)))

  // K2: lee también el número mixto (`1 1/2`) si la pregunta lo admite, y
  // conserva la fracción tal como la escribió.
  const lectura = useMemo(() => leerRespuesta(raw, { admiteMixto: question.admiteMixto }), [raw, question.admiteMixto])
  const parsed = lectura?.valor ?? null
  const esFraccion = Boolean(question.fraccion)
  const hasText = raw.trim().length > 0
  // K2: si el valor era el correcto pero la forma no (`6/8` por la irreducible), se le dice por qué.
  const motivo = submitted && isCorrect === false && parsed !== null ? corregirNumerica(question, parsed, raw).motivo : undefined
  const noSeEntiende = hasText && parsed === null
  // K1: `1.500` se lee mil quinientos. Se le dice siempre, aunque el número
  // mostrado coincida con lo que escribió: quien quiso decir 1,5 tiene que verlo.
  const usaPuntoDeMiles = parsed !== null && /^\s*[+-]?[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?\s*$/.test(raw)

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
          onChange(leerRespuesta(next, { admiteMixto: question.admiteMixto })?.valor ?? null, next)
        }}
        disabled={submitted || disabled}
        placeholder={esFraccion ? 'Tu respuesta (una fracción, como 3/4)' : 'Tu respuesta (coma o fracción)'}
        aria-invalid={noSeEntiende}
        aria-describedby={noSeEntiende ? 'numeric-input-error' : !hasText && !submitted ? 'numeric-input-ayuda' : undefined}
        className={cn(
          'w-full p-4 rounded-2xl border-2 bg-card/80 text-lg font-bold text-center transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[var(--algebra)]/40',
          !submitted && !noSeEntiende && 'border-border focus:border-[var(--algebra)]',
          !submitted && noSeEntiende && 'border-flojo focus:border-flojo',
          submitted && isCorrect && 'border-logrado bg-logrado-fondo border-4',
          submitted && isCorrect === false && 'border-destructive bg-destructive/10 border-4'
        )}
      />

      {/* Qué entendimos. Sólo cuando aporta algo: si el alumno escribió "3,5"
          y leímos 3,5, repetírselo es ruido; el valor está en confirmar las
          formas que se transforman — fracciones, LaTeX, porcentajes. */}
      {!submitted && parsed !== null && !(esFraccion && lectura?.fraccion) && (usaPuntoDeMiles || formatearNumero(parsed) !== raw.trim()) && (
        <p className="text-center text-sm text-muted-foreground">
          Leímos: <strong className="text-foreground">{formatearNumero(parsed)}</strong>
          {usaPuntoDeMiles ? ' (el punto separa los miles)' : ''}
        </p>
      )}

      {!submitted && !hasText && (
        <p id="numeric-input-ayuda" className="text-center text-xs text-muted-foreground">
          {esFraccion ? (
            <>
              Escribí la fracción con la barra: <code>3/4</code>
              {question.admiteMixto ? <>, o el número mixto con un espacio: <code>1 1/2</code></> : null}.
            </>
          ) : (
            <>
              Decimales con coma o con punto: <code>0,75</code> o <code>0.75</code>. El punto con tres cifras
              después cuenta como miles: <code>1.500</code> es mil quinientos.
            </>
          )}
        </p>
      )}

      {/* El aviso llega ANTES de enviar, que es todo el punto: con el input
          viejo el alumno se quedaba mirando un botón deshabilitado y sin causa. */}
      {!submitted && noSeEntiende && (
        <p id="numeric-input-error" className="text-center text-sm text-flojo">
          No entendimos ese número. Podés escribirlo con coma (<code>3,5</code>), con punto
          (<code>3.5</code>) o como fracción (<code>7/2</code>)
          {question.admiteMixto ? <>; el número mixto, con un espacio (<code>1 1/2</code>)</> : null}.
        </p>
      )}

      {submitted && isCorrect === false && (
        <Card className="p-3 rounded-xl border border-logrado/30 bg-logrado-fondo text-center">
          <span className="text-sm font-semibold text-logrado">
            Respuesta correcta:{' '}
            <LaTeXRenderer content={respuestaNumerica(question.correctAnswer, question.tolerance, question.fraccion)} />
          </span>
          {motivo && question.fraccion && (
            <p className="mt-1 text-sm text-foreground">
              <LaTeXRenderer content={textoDelMotivo(motivo, question.fraccion)} />
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
