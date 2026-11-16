import { BookOpen, GraduationCap, University } from 'lucide-react'
import type { Nivel } from '@/lib/types'

export type { Nivel }

export const NIVEL_OPTIONS: { value: Nivel; label: string; sub: string; Icon: React.ElementType; color: string }[] = [
  {
    value: 'Primario',
    label: 'Nivel Primario',
    sub: '1er a 7mo grado',
    Icon: BookOpen,
    color: 'bg-accion',
  },
  {
    value: 'Secundario',
    label: 'Nivel Secundario',
    sub: '1er a 5to año',
    Icon: GraduationCap,
    color: 'bg-accion',
  },
  {
    value: 'Superior',
    label: 'Nivel Superior / Terciario',
    sub: 'Carrera con programa propio',
    Icon: University,
    color: 'bg-accion',
  },
]
