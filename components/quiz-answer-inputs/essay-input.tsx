'use client'

import type { EssayQuestion } from '@/lib/types'
import { LARGO_MAXIMO_RESPUESTA } from '@/lib/ensayo'
import { ENSAYO } from '@/lib/textos'

interface EssayInputProps {
  question: EssayQuestion
  value: string
  submitted: boolean
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Ronda W · W5 — La respuesta larga: un campo grande y los criterios con los
 * que la va a corregir el docente (así el alumno sabe qué se espera). Nunca se
 * marca bien o mal acá: queda "En corrección".
 */
export function EssayInput({ question, value, submitted, onChange, disabled = false }: EssayInputProps) {
  const palabras = value.trim() ? value.trim().split(/\s+/).length : 0
  return (
    <div className="space-y-3" data-ensayo>
      {question.rubrica.length > 0 && (
        <div className="rounded-md border border-borde bg-superficie-suave p-3">
          <p className="nota font-semibold text-texto">{ENSAYO.loQueSeEspera}</p>
          <ul className="nota mt-1 list-disc space-y-0.5 pl-5 text-texto-suave">
            {question.rubrica.map((c) => (
              <li key={c.criterio}>{c.criterio}</li>
            ))}
          </ul>
        </div>
      )}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, LARGO_MAXIMO_RESPUESTA))}
        disabled={submitted || disabled}
        placeholder={ENSAYO.placeholder}
        aria-label={ENSAYO.tuRespuesta}
        rows={9}
        maxLength={LARGO_MAXIMO_RESPUESTA}
        className="cuerpo w-full resize-y rounded-lg border-2 border-borde-fuerte bg-superficie-tarjeta p-4 text-texto focus:border-accion focus:outline-none"
      />
      <p className="nota text-right text-texto-suave">{ENSAYO.palabras(palabras)}</p>
    </div>
  )
}
