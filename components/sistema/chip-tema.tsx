import type { EstadoTema } from '@/lib/alumnos-docente'
import { CHIP_TEMA } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Cómo le va a un alumno en un tema (design-reference/sistema/componentes/ChipTema).
 *
 *  - dominado:  `logrado` sobre `logrado-fondo`.
 *  - flojo:     `flojo` sobre `flojo-fondo`. Naranja, nunca rojo: dice "reforzá
 *               esto", no "fracasaste".
 *  - sin datos: `texto-suave` con borde. No es lo mismo que flojo.
 *
 * El color nunca va solo: el chip lleva el nombre del tema escrito, y el estado
 * va además en texto para lectores de pantalla.
 */
const CLASES: Record<EstadoTema, string> = {
  dominado: 'bg-logrado-fondo text-logrado',
  flojo: 'bg-flojo-fondo text-flojo',
  sin_datos: 'border border-borde bg-superficie-tarjeta text-texto-suave',
}

export function ChipTema({
  tema,
  estado,
  titulo,
  className,
}: {
  tema: string
  estado: EstadoTema
  /** El nombre completo, si `tema` va acortado: sale al pasar el mouse. */
  titulo?: string
  className?: string
}) {
  return (
    <span
      title={titulo && titulo !== tema ? titulo : undefined}
      className={cn(
        'inline-flex max-w-full items-center rounded-sm px-2 py-1 text-[11px] font-semibold leading-[14px]',
        CLASES[estado],
        className,
      )}
    >
      <span className="truncate">{tema}</span>
      <span className="sr-only">: {CHIP_TEMA[estado]}</span>
    </span>
  )
}
