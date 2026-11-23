'use client'

import { Check, X } from 'lucide-react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { cn } from '@/lib/utils'
import type { MultipleResponseQuestion } from '@/lib/types'
import { TIPOS_MOODLE_TEXTOS as T } from '@/lib/textos'

/**
 * Ronda T · F2 — Opción múltiple con varias correctas: casillas, se marcan
 * todas las que correspondan. Al enviar se ve cada opción: la correcta
 * marcada, la correcta que faltó y la marcada que sobraba.
 */
export function MultipleResponseInput({
  question,
  selected,
  submitted,
  disabled = false,
  onChange,
}: {
  question: MultipleResponseQuestion
  selected: number[]
  submitted: boolean
  disabled?: boolean
  onChange: (value: number[]) => void
}) {
  const correctas = new Set(question.correctAnswers)
  const elegidas = new Set(selected)

  function alternar(i: number) {
    const nuevo = new Set(elegidas)
    if (nuevo.has(i)) nuevo.delete(i)
    else nuevo.add(i)
    onChange([...nuevo].sort((a, b) => a - b))
  }

  return (
    <div className="space-y-3">
      <p className="cuerpo-s font-semibold text-texto-suave">{T.variasCorrectas.consigna}</p>
      <div className="space-y-3" role="group" aria-label={T.variasCorrectas.grupo}>
        {question.options.map((opcion, i) => {
          const marcada = elegidas.has(i)
          const esCorrecta = correctas.has(i)
          const bien = submitted && esCorrecta && marcada
          const falto = submitted && esCorrecta && !marcada
          const sobro = submitted && !esCorrecta && marcada
          return (
            <button
              key={i}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              disabled={submitted || disabled}
              onClick={() => alternar(i)}
              data-opcion-varias={i}
              className={cn(
                'w-full touch-manipulation rounded-2xl border-2 bg-card/80 p-4 text-left transition-colors',
                !submitted && !marcada && 'border-border hover:border-accion',
                !submitted && marcada && 'border-accion bg-accion-tenue',
                bien && 'border-4 border-logrado bg-logrado-fondo',
                falto && 'border-4 border-dashed border-logrado',
                sobro && 'border-4 border-destructive bg-destructive/10',
                submitted && !esCorrecta && !marcada && 'border-border opacity-40',
              )}
            >
              <span className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md border-2',
                    marcada ? 'border-accion bg-accion text-texto-sobre-accion' : 'border-borde-fuerte bg-superficie-tarjeta',
                    bien && 'border-logrado bg-logrado',
                    sobro && 'border-destructive bg-destructive',
                  )}
                >
                  {sobro ? <X className="size-5" strokeWidth={TRAZO_ICONO} /> : marcada ? <Check className="size-5" strokeWidth={TRAZO_ICONO} /> : null}
                </span>
                <span className="min-w-0 max-w-full flex-1 break-words pt-0.5 text-base font-semibold">
                  <LaTeXRenderer content={opcion} className="text-foreground" />
                  {falto && <span className="nota mt-1 block text-logrado">{T.variasCorrectas.falto}</span>}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
