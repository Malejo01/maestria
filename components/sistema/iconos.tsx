import { BarChart3, BookOpen, ClipboardList, PencilLine, Users, type LucideIcon } from 'lucide-react'
import type { IconoNav } from '@/lib/navegacion'

/**
 * Iconografía del sistema: trazo de 1,9 px, extremos y uniones redondeados,
 * caja de 24 px, pintados con currentColor (brand-book.md). Los íconos de
 * lucide-react ya cumplen todo menos el grosor, que se pasa con esta constante.
 */
export const TRAZO_ICONO = 1.9

export const ICONO_NAV: Record<IconoNav, LucideIcon> = {
  personas: Users,
  libro: BookOpen,
  tarea: ClipboardList,
  lapiz: PencilLine,
  avance: BarChart3,
}
