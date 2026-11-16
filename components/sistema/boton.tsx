import * as React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Los botones del sistema (design-reference/sistema/componentes/Boton), armados
 * sobre el primitivo vendored de shadcn en vez de reescribirlo.
 *
 *  - principal:  la acción que la pantalla quiere que pase. Una sola por pantalla.
 *  - secundario: una alternativa legítima a la principal.
 *  - icono:      acciones de barra sin texto. Mide 44 × 44 aunque el ícono sea de 18.
 *
 * (El cuarto, el grande de dos líneas, es exclusivo de la entrada y vive en
 * components/entrada/elegir-rol.tsx.)
 *
 * Todos miden al menos 44 px de alto: el área táctil no se negocia.
 */
type Variante = 'principal' | 'secundario' | 'icono'

const CLASES: Record<Variante, string> = {
  principal: 'min-h-11 h-auto px-4 py-2.5 rounded-md cuerpo-s font-bold bg-accion text-texto-sobre-accion hover:bg-accion-hover',
  secundario:
    'min-h-11 h-auto px-4 py-2.5 rounded-md cuerpo-s font-bold border border-borde-fuerte bg-superficie-tarjeta text-texto hover:bg-superficie-tarjeta hover:border-texto hover:text-texto dark:bg-superficie-tarjeta dark:border-borde-fuerte dark:hover:bg-superficie-tarjeta',
  icono:
    'size-11 rounded-md border border-borde bg-superficie-tarjeta text-texto-suave hover:bg-superficie-tarjeta hover:border-borde-fuerte hover:text-texto dark:bg-superficie-tarjeta dark:border-borde dark:hover:bg-superficie-tarjeta [&_svg]:size-[18px]',
}

type BotonProps = Omit<React.ComponentProps<typeof Button>, 'variant' | 'size'> & {
  variante?: Variante
  /** Ocupa todo el ancho disponible. */
  ancho?: boolean
}

export function Boton({ variante = 'principal', ancho = false, className, type, asChild, ...props }: BotonProps) {
  return (
    <Button
      // Con asChild el hijo es un <a>: no lleva `type`.
      {...(asChild ? {} : { type: type ?? 'button' })}
      asChild={asChild}
      variant={variante === 'principal' ? 'default' : 'outline'}
      className={cn(CLASES[variante], ancho && 'w-full', className)}
      {...props}
    />
  )
}
