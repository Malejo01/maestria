import type { MetadataRoute } from 'next'
import { urlDelSitio } from '@/lib/sitio'
import { GUIAS } from '@/lib/ayuda'

/** Ronda V · V5 — Las páginas públicas, para los buscadores. Las URLs salen de NEXT_PUBLIC_SITE_URL. */
const PAGINAS_PUBLICAS = ['/', '/precios', '/ayuda', ...GUIAS.map((g) => `/ayuda/${g}`), '/terminos', '/privacidad']

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlDelSitio()
  return PAGINAS_PUBLICAS.map((ruta) => ({
    url: `${base}${ruta === '/' ? '' : ruta}`,
    changeFrequency: ruta === '/' ? 'weekly' : 'monthly',
    priority: ruta === '/' ? 1 : 0.5,
  }))
}
