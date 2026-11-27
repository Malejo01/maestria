'use client'

import { useId, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { cn } from '@/lib/utils'

/**
 * AB3 · Lo que no es la oferta principal de /precios (Aula, Institución,
 * Autodidacta), detrás de un botón. Cerrado no está en la página: no se
 * dibuja, así que no compite con el plan Particular. Abierto de entrada si
 * se pidió (`?camino=aula`) o si el docente ya usa el plan Aula.
 */
export function OtrosPlanes({
  etiqueta,
  etiquetaCerrar,
  abiertoDeEntrada = false,
  children,
}: {
  etiqueta: string
  etiquetaCerrar: string
  abiertoDeEntrada?: boolean
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(abiertoDeEntrada)
  const sinMovimiento = useReducedMotion()
  const id = useId()
  return (
    <div className="space-y-4">
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
        className="cuerpo-s mx-auto flex min-h-11 items-center gap-1.5 font-semibold text-accion underline-offset-4 hover:underline"
        data-otros-planes
      >
        {abierto ? etiquetaCerrar : etiqueta}
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', abierto && 'rotate-180')}
          aria-hidden="true"
          strokeWidth={TRAZO_ICONO}
        />
      </button>
      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            id={id}
            key="otros"
            initial={sinMovimiento ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={sinMovimiento ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: sinMovimiento ? 0 : 0.2 }}
            className="space-y-8"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
