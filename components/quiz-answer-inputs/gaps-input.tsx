'use client'

import { useMemo, useState } from 'react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { barajarFijo, partesDelTexto } from '@/lib/tipos-moodle'
import { cn } from '@/lib/utils'
import type { GapsQuestion } from '@/lib/types'
import { TIPOS_MOODLE_TEXTOS as T } from '@/lib/textos'

/**
 * Ronda T · F5 — Completar los huecos de un texto.
 *
 *  - `gapselect` (seleccionar): en cada hueco, una lista con las palabras.
 *  - `ddwtos` (arrastrar): un banco de palabras; se toca una palabra y
 *    después el hueco (también con teclado y lector de pantalla, sin
 *    arrastrar). Tocar un hueco lleno lo vacía. Cada palabra va en un solo
 *    hueco.
 *
 * `elegidas[i]` es el índice en `choices` de lo puesto en el hueco i+1.
 */
export function GapsInput({
  question,
  elegidas,
  submitted,
  disabled = false,
  onChange,
}: {
  question: GapsQuestion
  elegidas: (number | null)[]
  submitted: boolean
  disabled?: boolean
  onChange: (elegidas: (number | null)[]) => void
}) {
  const partes = useMemo(() => partesDelTexto(question.text), [question.text])
  const orden = useMemo(() => barajarFijo(question.choices.map((_, i) => i), question.id), [question])
  const [enMano, setEnMano] = useState<number | null>(null)
  const bloqueado = submitted || disabled
  const arrastrar = question.type === 'ddwtos'

  const poner = (hueco: number, valor: number | null) => {
    const nuevo = elegidas.map((v) => (valor !== null && v === valor ? null : v))
    nuevo[hueco] = valor
    onChange(nuevo)
  }

  const estadoDe = (hueco: number) => (!submitted ? null : elegidas[hueco] === hueco ? 'bien' : 'mal')

  return (
    <div className="space-y-4">
      <p className="cuerpo-s font-semibold text-texto-suave">{arrastrar ? T.huecos.consignaArrastrar : T.huecos.consignaSeleccionar}</p>
      <div className="rounded-2xl border-2 border-border bg-card/80 p-4 text-base leading-10 text-texto" data-texto-con-huecos>
        {partes.map((parte, i) => {
          if (parte.tipo === 'texto') return <LaTeXRenderer key={i} content={parte.texto} className="!inline" />
          const h = parte.hueco - 1
          const estado = estadoDe(h)
          const clases = cn(
            'mx-1 inline-flex min-h-11 min-w-24 items-center justify-center rounded-md border-2 px-2 align-middle text-base font-semibold',
            !estado && 'border-borde-fuerte bg-superficie-tarjeta',
            estado === 'bien' && 'border-logrado bg-logrado-fondo',
            estado === 'mal' && 'border-destructive bg-destructive/10',
          )
          if (!arrastrar) {
            return (
              <select
                key={i}
                className={cn(clases, 'cuerpo-s')}
                aria-label={T.huecos.hueco(parte.hueco)}
                value={elegidas[h] ?? ''}
                disabled={bloqueado}
                data-hueco={parte.hueco}
                onChange={(e) => poner(h, e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">{T.huecos.elegir}</option>
                {orden.map((c) => (
                  <option key={c} value={c}>
                    {question.choices[c]}
                  </option>
                ))}
              </select>
            )
          }
          const puesta = elegidas[h]
          return (
            <button
              key={i}
              type="button"
              className={clases}
              aria-label={T.huecos.huecoCon(parte.hueco, puesta === null || puesta === undefined ? null : question.choices[puesta])}
              disabled={bloqueado}
              data-hueco={parte.hueco}
              onClick={() => {
                if (enMano !== null) {
                  poner(h, enMano)
                  setEnMano(null)
                } else if (puesta !== null && puesta !== undefined) {
                  poner(h, null)
                }
              }}
            >
              {puesta === null || puesta === undefined ? ' ' : question.choices[puesta]}
            </button>
          )
        })}
      </div>

      {arrastrar && !bloqueado && (
        <div className="space-y-2">
          <p className="nota text-texto-suave">{enMano === null ? T.huecos.tocaPalabra : T.huecos.tocaHueco(question.choices[enMano])}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={T.huecos.banco}>
            {orden.map((c) => {
              const usada = elegidas.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={enMano === c}
                  disabled={usada}
                  data-palabra={c}
                  onClick={() => setEnMano(enMano === c ? null : c)}
                  className={cn(
                    'min-h-11 rounded-full border-2 px-4 text-base font-semibold',
                    enMano === c ? 'border-accion bg-accion text-texto-sobre-accion' : 'border-borde-fuerte bg-superficie-tarjeta text-texto',
                    usada && 'opacity-40',
                  )}
                >
                  {question.choices[c]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {submitted && elegidas.some((v, i) => v !== i) && (
        <p className="nota font-semibold text-logrado">{T.huecos.correctas(partes.flatMap((p) => (p.tipo === 'hueco' ? [question.choices[p.hueco - 1] ?? ''] : [])))}</p>
      )}
    </div>
  )
}
