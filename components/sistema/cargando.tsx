'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { cn } from '@/lib/utils'

/**
 * El ícono de "esto está trabajando". Gira con Framer Motion, como toda
 * animación del sistema, y con `prefers-reduced-motion` se queda quieto: el
 * texto que lo acompaña ya dice qué está pasando.
 *
 * Es decorativo: quien lo usa pone el texto (o un `sr-only`) al lado.
 */
export function Cargando({ className }: { className?: string }) {
  const sinMovimiento = useReducedMotion()

  return (
    <motion.span
      aria-hidden="true"
      className={cn('inline-flex size-4 shrink-0', className)}
      animate={sinMovimiento ? undefined : { rotate: 360 }}
      transition={{ duration: 0.9, ease: 'linear', repeat: Infinity }}
    >
      <Loader2 className="size-full" strokeWidth={TRAZO_ICONO} />
    </motion.span>
  )
}
