'use client'

import { useMemo } from 'react'
import { Check, X } from 'lucide-react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { barajarFijo, respuestasDelEmparejamiento } from '@/lib/tipos-moodle'
import { cn } from '@/lib/utils'
import type { MatchingQuestion } from '@/lib/types'
import { TIPOS_MOODLE_TEXTOS as T } from '@/lib/textos'

const normal = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()

/**
 * Ronda T · F3 — Emparejamiento: cada elemento con una lista de respuestas
 * (las de los pares y los distractores, barajadas siempre igual para esa
 * pregunta). Una lista nativa: se usa con el teclado y con el lector de
 * pantalla sin nada extra. Al enviar, cada renglón dice si estuvo bien y,
 * si no, cuál era.
 */
export function MatchingInput({
  question,
  selected,
  submitted,
  disabled = false,
  onChange,
}: {
  question: MatchingQuestion
  selected: (string | null)[]
  submitted: boolean
  disabled?: boolean
  onChange: (value: (string | null)[]) => void
}) {
  const respuestas = useMemo(() => barajarFijo(respuestasDelEmparejamiento(question), question.id), [question])

  return (
    <div className="space-y-3">
      <p className="cuerpo-s font-semibold text-texto-suave">{T.emparejamiento.consigna}</p>
      <ol className="space-y-3">
        {question.pairs.map((par, i) => {
          const elegida = selected[i] ?? null
          const bien = submitted && normal(elegida) === normal(par.right)
          const mal = submitted && !bien
          return (
            <li
              key={i}
              className={cn(
                'space-y-2 rounded-2xl border-2 bg-card/80 p-4',
                !submitted && 'border-border',
                bien && 'border-4 border-logrado bg-logrado-fondo',
                mal && 'border-4 border-destructive bg-destructive/10',
              )}
            >
              <div className="flex items-start gap-2 text-base font-semibold text-texto">
                {bien && <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-logrado" strokeWidth={TRAZO_ICONO} />}
                {mal && <X aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={TRAZO_ICONO} />}
                <LaTeXRenderer content={par.left} className="min-w-0 break-words" />
              </div>
              <select
                className="cuerpo-s h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-texto disabled:opacity-90"
                aria-label={T.emparejamiento.pareja(par.left)}
                value={elegida ?? ''}
                disabled={submitted || disabled}
                data-pareja={i}
                onChange={(e) => {
                  const nuevo = [...selected]
                  nuevo[i] = e.target.value || null
                  onChange(nuevo)
                }}
              >
                <option value="">{T.emparejamiento.elegir}</option>
                {respuestas.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {mal && <p className="nota font-semibold text-logrado">{T.emparejamiento.correcta(par.right)}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
