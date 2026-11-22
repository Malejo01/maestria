'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { TemaDominado } from '@/lib/a-reforzar'
import { fechaCorta } from '@/lib/avisos-de-reporte'
import { A_REFORZAR as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * O2: "Ya lo dominás", en /history. Los temas que el alumno tenía para
 * reforzar y ya superó (3 aciertos seguidos en ese tema, o los marcó su
 * docente). Plegado: es un premio para mirar, no una lista para trabajar.
 */
export function YaLoDominas({ dominados }: { dominados: TemaDominado[] }) {
  const [abierto, setAbierto] = useState(false)
  const sinMovimiento = useReducedMotion()
  if (dominados.length === 0) return null

  return (
    <section className="rounded-lg border border-borde bg-superficie-tarjeta">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls="ya-lo-dominas"
        onClick={() => setAbierto((a) => !a)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1">
          <span className="cuerpo block font-semibold text-texto">{T.yaLoDominas}</span>
          <span className="nota block text-texto-suave">{T.yaLoDominasDetalle(dominados.length)}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={TRAZO_ICONO}
          className={cn('size-5 text-texto-suave transition-transform', abierto && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.ul
            id="ya-lo-dominas"
            initial={sinMovimiento ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={sinMovimiento ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
            transition={{ duration: sinMovimiento ? 0 : 0.2 }}
            className="flex flex-col gap-2 overflow-hidden border-t border-borde px-4 py-3"
          >
            {dominados.map((d) => (
              <li key={`${d.materia}|${d.tema}`} className="flex flex-col">
                <span className="cuerpo-s text-texto">{d.tema}</span>
                <span className="nota text-texto-suave">
                  {d.materia}
                  {d.superadoEl ? ` · ${T.superadoEl(fechaCorta(d.superadoEl))}` : ''}
                </span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  )
}
