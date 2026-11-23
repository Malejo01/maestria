import type { MetadataRoute } from 'next'
import { urlDelSitio } from '@/lib/sitio'

/** Ronda V · V5 — Las páginas públicas, para los buscadores. Las URLs salen de NEXT_PUBLIC_SITE_URL. */
const PAGINAS_PUBLICAS = ['/', '/precios', '/terminos', '/privacidad'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlDelSitio()
  return PAGINAS_PUBLICAS.map((ruta) => ({
    url: `${base}${ruta === '/' ? '' : ruta}`,
    changeFrequency: ruta === '/' ? 'weekly' : 'monthly',
    priority: ruta === '/' ? 1 : 0.5,
  }))
}
