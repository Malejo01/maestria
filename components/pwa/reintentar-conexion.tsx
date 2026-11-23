'use client'

import { Boton } from '@/components/sistema/boton'
import { PWA } from '@/lib/textos'

/** Vuelve a la página que se quería abrir (o al inicio). */
export function ReintentarConexion() {
  return <Boton onClick={() => (location.pathname === '/sin-conexion' ? location.assign('/') : location.reload())}>{PWA.sinConexion.reintentar}</Boton>
}
