import type { MetadataRoute } from 'next'
import { urlDelSitio } from '@/lib/sitio'
import { GUIAS } from '@/lib/ayuda'
import { leerNovedades } from '@/lib/novedades-server'

/** Ronda V · V5 — Las páginas públicas, para los buscadores. Las URLs salen de NEXT_PUBLIC_SITE_URL. */
const PAGINAS_PUBLICAS = ['/', '/precios', '/profes', '/ayuda', ...GUIAS.map((g) => `/ayuda/${g}`), '/terminos', '/privacidad']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = urlDelSitio()
  // Y3: las novedades también.
  const novedades = (await leerNovedades()).map((n) => `/novedades/${n.slug}`)
  return [...PAGINAS_PUBLICAS, '/novedades', ...novedades].map((ruta) => ({
    url: `${base}${ruta === '/' ? '' : ruta}`,
    changeFrequency: ruta === '/' ? 'weekly' : 'monthly',
    priority: ruta === '/' ? 1 : 0.5,
  }))
}
