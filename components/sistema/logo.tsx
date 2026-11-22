import { cn } from '@/lib/utils'
import { MARCA } from '@/lib/textos'

/**
 * El isotipo de MaestrIA: la M de Malejo en la tinta `accion`.
 *
 * Va inline con `stroke="currentColor"`, así es un solo SVG para los dos modos.
 * Reglas de design-reference/sistema/componentes/Logo:
 *  - 27 px o más: trazo 4,8. Por debajo: 8,5, porque si no los nodos se cierran.
 *  - No se rota, no se deforma, no se le pone fondo ni otro color que `accion`.
 */
const TRAZO_GRANDE = 4.8
const TRAZO_CHICO = 8.5
const UMBRAL_TRAZO_PX = 27

interface IsotipoProps {
  /** Lado en px. Decide el grosor del trazo. */
  size?: number
  /** Si el nombre escrito está al lado, el isotipo es decorativo. */
  decorativo?: boolean
  className?: string
}

export function Isotipo({ size = 28, decorativo = false, className }: IsotipoProps) {
  return (
    <svg
      viewBox="-22.2 -29.7 144.4 144.4"
      width={size}
      height={size}
      className={cn('shrink-0 text-accion', className)}
      {...(decorativo ? { 'aria-hidden': true } : { role: 'img', 'aria-label': MARCA.nombre })}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={size >= UMBRAL_TRAZO_PX ? TRAZO_GRANDE : TRAZO_CHICO}
        strokeLinejoin="round"
      >
        <path d="M-11.8 0 L-11.8 85 A11.8 11.8 0 0 0 11.8 85 L11.8 0 A11.8 11.8 0 0 0 -11.8 0 Z" />
        <path d="M88.2 0 L88.2 85 A11.8 11.8 0 0 0 111.8 85 L111.8 0 A11.8 11.8 0 0 0 88.2 0 Z" />
        <path d="M-8.34 8.34 L41.66 58.34 A11.8 11.8 0 0 0 58.34 41.66 L8.34 -8.34 A11.8 11.8 0 0 0 -8.34 8.34 Z" />
        <path d="M91.66 -8.34 L41.66 41.66 A11.8 11.8 0 0 0 58.34 58.34 L108.34 8.34 A11.8 11.8 0 0 0 91.66 -8.34 Z" />
        <circle cx="0" cy="0" r="9.8" />
        <circle cx="0" cy="85" r="9.8" />
        <circle cx="100" cy="0" r="9.8" />
        <circle cx="100" cy="85" r="9.8" />
        <circle cx="50" cy="50" r="9.8" />
      </g>
    </svg>
  )
}

interface LogoProps {
  /** `entrada`: el de la tarjeta de entrada (28 px). `barra`: el de la barra de la app (22 px). */
  variante?: 'entrada' | 'barra'
  /**
   * P1: sólo el isotipo en el celular (la palabra vuelve desde `sm`). Para la
   * barra del admin docente, que suma el botón Admin y no entra en 360 px.
   */
  soloIsotipoEnCelular?: boolean
  className?: string
}

/** Isotipo + "MaestrIA" escrito, con las letras IA en `accion`. */
export function Logo({ variante = 'entrada', soloIsotipoEnCelular = false, className }: LogoProps) {
  const enBarra = variante === 'barra'
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Isotipo size={enBarra ? 22 : 28} decorativo />
      <span
        className={cn(
          'font-titulo font-extrabold tracking-[-0.02em] text-texto',
          enBarra ? 'text-[17px] leading-none' : 'text-[20px] leading-none',
          soloIsotipoEnCelular && 'hidden sm:inline',
        )}
      >
        Maestr<span className="text-accion">IA</span>
      </span>
    </span>
  )
}
