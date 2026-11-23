'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlarmClock,
  CircleCheckBig,
  ClipboardPlus,
  Flag,
  Flame,
  RotateCcw,
  Megaphone,
  ListChecks,
  ListTodo,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { horaRelativa } from '@/lib/avisos/armar'
import type { Aviso, IconoDeAviso, RolDeAviso } from '@/lib/avisos/tipos'
import { AVISOS } from '@/lib/textos'
import { cn } from '@/lib/utils'

const ICONO: Record<IconoDeAviso, LucideIcon> = {
  checkLista: ListChecks,
  personaMas: UserPlus,
  bandera: Flag,
  tareaNueva: ClipboardPlus,
  reloj: AlarmClock,
  diagnostico: ListTodo,
  resuelto: CircleCheckBig,
  trofeo: Trophy,
  llama: Flame,
  repaso: RotateCcw,
  novedad: Megaphone,
}

/** El tinte del círculo por rol semántico. Sólo tokens de app/tokens.css. */
const TINTE: Record<RolDeAviso, string> = {
  exito: 'bg-logrado-fondo text-logrado',
  informacion: 'bg-accion-tenue text-accion',
  atencion: 'bg-flojo-fondo text-flojo',
}

/**
 * P2 · Un aviso de la campanita (docente o alumno): ícono del tipo en un
 * círculo con el tinte de su rol, título corto en negrita, una línea de
 * detalle, la hora relativa y el punto de no leído. Toda la fila es un link.
 */
export function AvisoItem({
  aviso,
  ahora,
  indice = 0,
  onNavegar,
}: {
  aviso: Aviso
  ahora: Date
  /** Para escalonar la entrada. */
  indice?: number
  onNavegar?: () => void
}) {
  const sinMovimiento = useReducedMotion()
  const Icono = ICONO[aviso.icono]

  return (
    <motion.li
      initial={sinMovimiento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={sinMovimiento ? { duration: 0 } : { duration: 0.18, delay: Math.min(indice, 8) * 0.03 }}
      data-aviso={aviso.tipo}
    >
      <Link
        href={aviso.href}
        onClick={onNavegar}
        // Sin fondo para el no leído: lo marca el punto. Un fondo azul tenue se
        // comía el círculo de los avisos de información, que es del mismo tinte.
        className="flex items-start gap-3 px-4 py-3 hover:bg-superficie-suave focus-visible:bg-superficie-suave"
      >
        <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', TINTE[aviso.rol])} aria-hidden="true">
          <Icono className="size-[18px]" strokeWidth={TRAZO_ICONO} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="cuerpo-s block font-bold text-texto">{aviso.titulo}</span>
          <span className="nota block truncate text-texto-suave">{aviso.detalle}</span>
          <span className="nota block text-texto-suave">{horaRelativa(aviso.fecha, ahora)}</span>
        </span>
        {aviso.noLeido && (
          <span className="mt-2 size-2.5 shrink-0 rounded-full bg-accion">
            <span className="sr-only">{AVISOS.sinLeer}</span>
          </span>
        )}
      </Link>
    </motion.li>
  )
}
