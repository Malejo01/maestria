import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ADMIN } from '@/lib/textos'

/**
 * P1 · El botón al panel de administrador, al lado de la campanita. Sólo se
 * pinta para la lista de admin (`esAdmin` sale de `isAdminEmail` en el
 * servidor); para cualquier otra cuenta no existe. En el celular es sólo el
 * escudo, del tamaño de la campanita, para que la barra entre en 360 px.
 */
export function BotonAdmin({ esAdmin }: { esAdmin: boolean }) {
  if (!esAdmin) return null
  return (
    <Link
      href="/admin"
      aria-label={ADMIN.botonEtiqueta}
      className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-md border border-borde bg-superficie-tarjeta text-texto hover:border-borde-fuerte sm:size-auto sm:min-h-11 sm:px-3"
    >
      <ShieldCheck className="size-5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      <span className="cuerpo-s hidden font-semibold lg:inline">{ADMIN.boton}</span>
    </Link>
  )
}
