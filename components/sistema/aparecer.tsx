'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Falso en el servidor y durante la primera hidratación; verdadero después.
 *
 * Lo que viene pintado desde el servidor NO se anima: si entrara con opacidad
 * 0, la primera pantalla quedaría invisible hasta que baje y corra el
 * JavaScript, que en un celular lento son segundos. Sólo se anima lo que se
 * monta después, ya navegando dentro de la app.
 */
let yaHidrato = false

/**
 * Entrada de un bloque de contenido: aparece subiendo unos píxeles.
 *
 * Es la única animación de entrada del sistema, y es corta a propósito. Con
 * `prefers-reduced-motion` el elemento aparece sin desplazarse
 * (accesibilidad.md, "Movimiento").
 */
export function Aparecer({
  children,
  className,
  demora = 0,
}: {
  children: ReactNode
  className?: string
  /** Segundos antes de empezar, para escalonar bloques hermanos. */
  demora?: number
}) {
  const sinMovimiento = useReducedMotion()
  const [animar] = useState(() => yaHidrato)

  useEffect(() => {
    yaHidrato = true
  }, [])

  return (
    <motion.div
      className={className}
      initial={animar ? { opacity: 0, y: sinMovimiento ? 0 : 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: demora }}
    >
      {children}
    </motion.div>
  )
}
