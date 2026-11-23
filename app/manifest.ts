import type { MetadataRoute } from 'next'
import { COLOR_DE_BARRA_DEL_NAVEGADOR } from '@/lib/tema'
import { MARCA, PWA } from '@/lib/textos'

/**
 * Ronda X · X4 — El manifiesto: MaestrIA se puede instalar. Los colores son
 * los de la barra del navegador (lib/tema.ts, el espejo de los tokens); los
 * íconos se dibujan desde los tokens (app/icono-pwa).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: MARCA.nombre,
    short_name: MARCA.nombre,
    description: PWA.descripcion,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'es-AR',
    background_color: COLOR_DE_BARRA_DEL_NAVEGADOR.claro,
    theme_color: COLOR_DE_BARRA_DEL_NAVEGADOR.claro,
    icons: [
      { src: '/icono-pwa/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-pwa/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-pwa/maskable-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
