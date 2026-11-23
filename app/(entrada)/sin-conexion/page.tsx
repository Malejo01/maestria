import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ReintentarConexion } from '@/components/pwa/reintentar-conexion'
import { PWA } from '@/lib/textos'

/**
 * Ronda X · X4 — La página que muestra el service worker cuando una
 * navegación falla sin internet. Estática y sin datos de nadie: es lo único
 * que se guarda de las páginas (public/sw.js).
 */
export const dynamic = 'force-static'
export const metadata: Metadata = { title: PWA.sinConexion.titulo, robots: { index: false } }

export default function SinConexionPage() {
  return (
    <section className="flex max-w-md flex-col items-center gap-4 text-center" data-sin-conexion>
      <WifiOff className="size-10 text-texto-suave" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
      <h1 className="titulo-l text-texto">{PWA.sinConexion.titulo}</h1>
      <p className="cuerpo-s text-texto-suave">{PWA.sinConexion.detalle}</p>
      <ReintentarConexion />
    </section>
  )
}
