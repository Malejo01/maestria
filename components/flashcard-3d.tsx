'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Flashcard3DProps {
  front: React.ReactNode
  back: React.ReactNode
  className?: string
  flipped?: boolean
  onFlippedChange?: (flipped: boolean) => void
}

export function Flashcard3D({ front, back, className, flipped, onFlippedChange }: Flashcard3DProps) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const isFlipped = flipped ?? internalFlipped
  const sinMovimiento = useReducedMotion()

  const toggle = () => {
    onFlippedChange?.(!isFlipped)
    if (flipped === undefined) setInternalFlipped((prev) => !prev)
  }

  return (
    // Un <button> de verdad: Tab lo alcanza y Enter y Espacio lo activan sin
    // código propio. `block` y `text-left` le devuelven el aspecto de tarjeta.
    <button
      type="button"
      className={cn('relative block h-56 w-full cursor-pointer select-none rounded-lg text-left', className)}
      style={{ perspective: 1000 }}
      onClick={toggle}
      aria-pressed={isFlipped}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          {front}
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {back}
        </div>
      </motion.div>
    </button>
  )
}
