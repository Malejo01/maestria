import type { SubjectColorName, SubjectIconName } from '@/lib/types'

export const SUBJECT_ICON_OPTIONS: SubjectIconName[] = [
  'book-open',
  'calculator',
  'sigma',
  'chart-line',
  'flask-conical',
  'atom',
  'ruler',
  'landmark',
  'pie-chart',
  'target',
]

export const SUBJECT_COLOR_OPTIONS: SubjectColorName[] = [
  'teal',
  'blue',
  'orange',
  'green',
  'red',
  'indigo',
  'amber',
  'cyan',
  'emerald',
  'pink',
]

interface SubjectColorClasses {
  active: string
  inactive: string
  chip: string
  /** Text-only color, e.g. for a score number or an icon glyph. */
  text: string
  /** Light background, meant for an icon circle. */
  iconBg: string
  /** Light border, meant for card outlines. */
  border: string
}

/**
 * Un solo azul. Antes cada materia tenía su color (verde agua, naranja, rosa…)
 * y el panel se llenaba de colores que no significaban nada. El sistema de
 * diseño reserva el color para lo que informa: acción, dominado, flojo
 * (design-reference/sistema/brand-book.md).
 *
 * `color_name` se sigue guardando en cada materia —y el tipo se conserva— para
 * no tocar el modelo de datos; simplemente ya no cambia cómo se ve.
 */
const UN_SOLO_AZUL: SubjectColorClasses = {
  active: 'bg-accion text-texto-sobre-accion border-accion',
  inactive: 'bg-superficie-suave text-accion border-accion-tenue-borde hover:border-accion',
  chip: 'bg-accion',
  text: 'text-accion',
  iconBg: 'bg-superficie-suave',
  border: 'border-borde',
}

export const SUBJECT_COLOR_CLASS: Record<SubjectColorName, SubjectColorClasses> = Object.fromEntries(
  SUBJECT_COLOR_OPTIONS.map((nombre) => [nombre, UN_SOLO_AZUL]),
) as Record<SubjectColorName, SubjectColorClasses>
