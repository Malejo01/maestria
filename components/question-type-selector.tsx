'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QUESTION_TYPE_OPTIONS, type QuestionTypeOption } from '@/lib/question-types'
import { esTipoMoodle } from '@/lib/tipos-moodle'
import { TIPOS_MOODLE_TEXTOS as T } from '@/lib/textos'
import type { QuestionType } from '@/lib/types'

interface QuestionTypeSelectorProps {
  value: QuestionType[]
  onChange: (next: QuestionType[]) => void
  disabled?: boolean
  className?: string
  /**
   * Ronda T · F8: los tipos "como en Moodle" (varias correctas,
   * emparejamiento, ordenamiento, huecos, palabra faltante, calculada), en un
   * grupo aparte. Sólo para el docente: son para llevar a Moodle.
   */
  conMasTipos?: boolean
}

/**
 * Multi-select chips for which question types the generator may use.
 * Always keeps at least one type selected — an empty selection would
 * silently fall back to multiple_choice server-side, which is confusing
 * when the checkboxes on screen show nothing checked.
 *
 * F8: los cuatro de siempre a la vista; los de Moodle, en "Más tipos (como en
 * Moodle)", que se abre solo si ya hay alguno elegido.
 */
export function QuestionTypeSelector({ value, onChange, disabled = false, className, conMasTipos = false }: QuestionTypeSelectorProps) {
  const sinMovimiento = useReducedMotion()
  const idDelGrupo = useId()
  const deSiempre = QUESTION_TYPE_OPTIONS.filter((o) => !esTipoMoodle(o.value))
  const deMoodle = conMasTipos ? QUESTION_TYPE_OPTIONS.filter((o) => esTipoMoodle(o.value)) : []
  const elegidosDeMoodle = value.filter(esTipoMoodle).length
  const [abierto, setAbierto] = useState(elegidosDeMoodle > 0)

  const toggle = (type: QuestionType) => {
    if (disabled) return

    if (value.includes(type)) {
      if (value.length === 1) return
      onChange(value.filter((t) => t !== type))
    } else {
      onChange([...value, type])
    }
  }

  const chip = ({ value: type, label, description, Icon }: QuestionTypeOption) => {
    const isSelected = value.includes(type)
    return (
      <button
        key={type}
        type="button"
        disabled={disabled}
        onClick={() => toggle(type)}
        aria-pressed={isSelected}
        data-tipo-de-pregunta={type}
        className={cn(
          'flex items-start gap-2 rounded-xl border p-3 text-left transition-all disabled:opacity-50 disabled:pointer-events-none',
          isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/50',
        )}
      >
        <Icon className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-tight">{label}</span>
          <span className="block text-xs opacity-80 leading-snug">{description}</span>
        </span>
      </button>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-2 gap-2">{deSiempre.map(chip)}</div>
      {deMoodle.length > 0 && (
        <div className="rounded-xl border border-borde">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-semibold text-texto"
            aria-expanded={abierto}
            aria-controls={idDelGrupo}
            onClick={() => setAbierto((a) => !a)}
          >
            <span>
              {T.masTipos.titulo}
              {elegidosDeMoodle > 0 && <span className="ml-2 font-normal text-texto-suave">{T.masTipos.elegidos(elegidosDeMoodle)}</span>}
            </span>
            <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 transition-transform', abierto && 'rotate-180')} />
          </button>
          <AnimatePresence initial={false}>
            {abierto && (
              <motion.div
                id={idDelGrupo}
                initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={sinMovimiento ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: sinMovimiento ? 0 : 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 px-3 pb-3">
                  <p className="text-xs text-texto-suave">{T.masTipos.detalle}</p>
                  {/* A 360-390 px, "Emparejamiento" no entra en media columna: una sola. */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{deMoodle.map(chip)}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
