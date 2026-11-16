import type { ReactNode } from 'react'
import { Aparecer } from '@/components/sistema/aparecer'
import { Logo } from '@/components/sistema/logo'
import { cn } from '@/lib/utils'

/**
 * La tarjeta de las pantallas de entrada: logo arriba y una sola decisión
 * adentro. La comparten la entrada (¿docente o alumno?), el ingreso, la
 * bienvenida y el link de grupo, así que pasar de una a otra se lee como el
 * paso siguiente dentro de la misma tarjeta y no como otra pantalla.
 *
 * Medidas de design-reference/sistema/componentes/ElegirRol: radio `radio-xl`,
 * borde `borde`, sin sombra.
 */
export function TarjetaEntrada({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'w-full max-w-[380px] rounded-3xl border border-borde bg-superficie-tarjeta px-6 py-8',
        className,
      )}
    >
      <div className="mb-7 flex justify-center">
        <Logo />
      </div>
      {/* `key` lo pone quien la usa cuando cambia de paso: así el contenido
          nuevo entra animado y el marco se queda quieto. */}
      <Aparecer>{children}</Aparecer>
    </section>
  )
}

export function TituloEntrada({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('titulo-l text-texto', className)}>{children}</h1>
}

export function BajadaEntrada({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('nota mt-1 mb-5 text-texto-suave', className)}>{children}</p>
}

export function Separador({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-3" role="presentation">
      <span className="h-px flex-1 bg-borde" />
      <span className="etiqueta tracking-normal text-texto-suave">{children}</span>
      <span className="h-px flex-1 bg-borde" />
    </div>
  )
}

/** Un enlace de texto con área táctil de 44 px, para las salidas secundarias de cada paso. */
export const CLASE_ENLACE_ENTRADA =
  'inline-flex min-h-11 items-center cuerpo-s font-semibold text-accion hover:text-accion-hover rounded-sm'
export const CLASE_ENLACE_SUAVE =
  'inline-flex min-h-11 items-center cuerpo-s text-texto-suave hover:text-texto rounded-sm'
