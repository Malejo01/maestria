'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Un bloque gris del tamaño de lo que va a venir. Es decorativo: quien lee con
 * lector de pantalla recibe el texto de `ZonaDeCarga`, no una lista de cajas.
 */
export function Esqueleto({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('block rounded-[var(--radio-sm)] bg-borde', className)} />
}

/**
 * Envuelve los bloques de una pantalla que todavía está leyendo sus datos.
 *
 * Existe porque "todavía no sé" no se puede dibujar como una pantalla vacía:
 * cinco segundos en blanco se leen como que la app está rota. El esqueleto
 * tiene la forma de lo que viene, así que cuando llegan los datos nada salta.
 *
 * El latido es de Framer Motion, como toda animación del sistema, y es UNO por
 * zona (no uno por bloque). Con `prefers-reduced-motion` queda quieto: sigue
 * diciendo "acá va a haber algo" sin moverse. `role="status"` lo anuncia.
 */
export function ZonaDeCarga({
  etiqueta,
  children,
  className,
}: {
  /** Qué se está cargando, para quien no ve los bloques. */
  etiqueta: string
  children: ReactNode
  className?: string
}) {
  const sinMovimiento = useReducedMotion()

  return (
    <motion.div
      role="status"
      aria-busy="true"
      className={className}
      animate={sinMovimiento ? undefined : { opacity: [1, 0.55, 1] }}
      transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
    >
      <span className="sr-only">{etiqueta}</span>
      {children}
    </motion.div>
  )
}
