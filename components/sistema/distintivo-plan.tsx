'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { Distintivo } from '@/lib/distintivo-del-plan'

/**
 * Ronda T · B2 — Los distintivos del plan sobre las iniciales del avatar. SVG
 * propio, colores de los tokens (`currentColor` con clases del sistema). Son
 * decorativos (`aria-hidden`): el estado lo dice el `aria-label` del avatar.
 *
 * `caer`: al acreditarse un plan, el birrete cae sobre las iniciales una sola
 * vez. Con movimiento reducido, aparece sin animación.
 */
export function DistintivoPlan({ distintivo, punto, caer = false }: { distintivo: Distintivo; punto: boolean; caer?: boolean }) {
  const sinMovimiento = useReducedMotion()
  const animar = caer && !sinMovimiento

  return (
    <>
      {(distintivo === 'birrete' || distintivo === 'birrete-estrella') && (
        <motion.span
          aria-hidden="true"
          data-distintivo={distintivo}
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-accion"
          initial={animar ? { y: -18, opacity: 0, rotate: -12 } : false}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={animar ? { type: 'spring', stiffness: 380, damping: 16, delay: 0.15 } : { duration: 0 }}
        >
          <Birrete estrella={distintivo === 'birrete-estrella'} />
        </motion.span>
      )}
      {distintivo === 'reloj' && (
        <span aria-hidden="true" data-distintivo="reloj" className="pointer-events-none absolute -bottom-1 -right-1 text-accion">
          <Reloj />
        </span>
      )}
      {punto && (
        <span
          aria-hidden="true"
          data-distintivo="punto"
          className="pointer-events-none absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-superficie-tarjeta bg-flojo"
        />
      )}
    </>
  )
}

function Birrete({ estrella }: { estrella: boolean }) {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      {/* El tablero */}
      <path d="M12 1 1.5 5.5 12 10l10.5-4.5L12 1Z" fill="currentColor" stroke="var(--superficie-tarjeta)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* La copa */}
      <path d="M6 8v3.2c0 1.2 2.7 2.3 6 2.3s6-1.1 6-2.3V8l-6 2.6L6 8Z" fill="currentColor" stroke="var(--superficie-tarjeta)" strokeWidth="1.2" strokeLinejoin="round" />
      {/* La borla */}
      <path d="M20.5 6.4v4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20.5" cy="11.4" r="1.1" fill="currentColor" />
      {estrella && (
        <path
          d="m12 2.6.9 1.7 1.9.3-1.4 1.3.3 1.9L12 6.9l-1.7.9.3-1.9-1.4-1.3 1.9-.3.9-1.7Z"
          fill="var(--superficie-tarjeta)"
        />
      )}
    </svg>
  )
}

function Reloj() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.6" fill="var(--superficie-tarjeta)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 4.6V8l2.3 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
