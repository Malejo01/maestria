'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

/**
 * Aviso del sistema: una franja bajo la barra, en el flujo de la página (no
 * flota ni tapa nada), con una acción a la derecha. Entra y sale con un
 * fundido corto; con movimiento reducido, aparece sin animar.
 */
export function Aviso({
  visible,
  etiqueta,
  accion,
  children,
}: {
  visible: boolean
  /** Nombre accesible de la región ("Tu reporte"). */
  etiqueta: string
  accion?: ReactNode
  children: ReactNode
}) {
  const sinMovimiento = useReducedMotion()
  return (
    <AnimatePresence initial={!sinMovimiento}>
      {visible && (
        <motion.section
          aria-label={etiqueta}
          role="status"
          initial={sinMovimiento ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={sinMovimiento ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6 }}
          transition={{ duration: sinMovimiento ? 0 : 0.2 }}
          className="border-b border-accion-tenue-borde bg-accion-tenue"
        >
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">{children}</div>
            {accion && <div className="shrink-0">{accion}</div>}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
