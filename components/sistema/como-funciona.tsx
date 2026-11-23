import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { Guia } from '@/lib/ayuda'
import { AYUDA } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Ronda V · V6 — "¿Cómo funciona esto?": el ícono que lleva a la guía de esa
 * pantalla en el centro de ayuda. Con `soloIcono`, el texto queda para el
 * lector de pantalla.
 */
export function ComoFunciona({ guia, soloIcono = false, className }: { guia: Guia; soloIcono?: boolean; className?: string }) {
  return (
    <Link
      href={`/ayuda/${guia}`}
      className={cn('nota inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md text-texto-suave hover:text-accion', className)}
      aria-label={soloIcono ? AYUDA.comoFunciona : undefined}
      title={AYUDA.comoFunciona}
      data-como-funciona={guia}
    >
      <CircleHelp className="size-[18px]" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      {!soloIcono && <span>{AYUDA.comoFunciona}</span>}
    </Link>
  )
}
