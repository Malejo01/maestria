'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowDown, ArrowUp, Check, X } from 'lucide-react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { moverEnOrden } from '@/lib/tipos-moodle'
import { cn } from '@/lib/utils'
import type { OrderingQuestion } from '@/lib/types'
import { TIPOS_MOODLE_TEXTOS as T } from '@/lib/textos'

/**
 * Ronda T · F4 — Ordenamiento: la lista arranca barajada (nunca ya ordenada)
 * y cada elemento sube o baja con sus botones (teclado, lector de pantalla y
 * dedo, sin arrastrar). Al enviar, cada lugar dice si quedó bien y, si no,
 * cuál iba ahí.
 */
export function OrderingInput({
  question,
  orden,
  submitted,
  disabled = false,
  onChange,
}: {
  question: OrderingQuestion
  /** Los índices de `items`, en el orden en que los dejó el alumno. */
  orden: number[]
  submitted: boolean
  disabled?: boolean
  onChange: (orden: number[]) => void
}) {
  const sinMovimiento = useReducedMotion()
  const bloqueado = submitted || disabled

  return (
    <div className="space-y-3">
      <p className="cuerpo-s font-semibold text-texto-suave">{T.ordenamiento.consigna}</p>
      <ol className="space-y-2" aria-label={T.ordenamiento.lista}>
        {orden.map((indice, lugar) => {
          const bien = submitted && indice === lugar
          const mal = submitted && indice !== lugar
          const texto = question.items[indice] ?? ''
          return (
            <motion.li
              key={indice}
              layout={sinMovimiento ? false : 'position'}
              transition={{ duration: 0.18 }}
              data-elemento-orden={indice}
              className={cn(
                'rounded-2xl border-2 bg-card/80 p-3',
                !submitted && 'border-border',
                bien && 'border-4 border-logrado bg-logrado-fondo',
                mal && 'border-4 border-destructive bg-destructive/10',
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums',
                    bien ? 'bg-logrado text-texto-sobre-accion' : mal ? 'bg-destructive text-texto-sobre-accion' : 'bg-superficie-suave text-texto',
                  )}
                >
                  {bien ? <Check className="size-4" strokeWidth={TRAZO_ICONO} /> : mal ? <X className="size-4" strokeWidth={TRAZO_ICONO} /> : lugar + 1}
                </span>
                <span className="min-w-0 flex-1 break-words text-base font-semibold text-texto">
                  <LaTeXRenderer content={texto} />
                </span>
                {!bloqueado && (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-md border border-borde text-texto hover:border-accion disabled:opacity-40"
                      aria-label={T.ordenamiento.subir(texto)}
                      disabled={lugar === 0}
                      onClick={() => onChange(moverEnOrden(orden, lugar, -1))}
                    >
                      <ArrowUp className="size-5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                    </button>
                    <button
                      type="button"
                      className="flex size-11 items-center justify-center rounded-md border border-borde text-texto hover:border-accion disabled:opacity-40"
                      aria-label={T.ordenamiento.bajar(texto)}
                      disabled={lugar === orden.length - 1}
                      onClick={() => onChange(moverEnOrden(orden, lugar, 1))}
                    >
                      <ArrowDown className="size-5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                    </button>
                  </span>
                )}
              </div>
              {mal && <p className="nota mt-2 font-semibold text-logrado">{T.ordenamiento.iba(lugar + 1, question.items[lugar] ?? '')}</p>}
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
