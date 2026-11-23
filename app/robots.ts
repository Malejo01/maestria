import type { MetadataRoute } from 'next'
import { urlDelSitio } from '@/lib/sitio'

/**
 * Ronda V · V5 — Lo público se indexa; lo de cuentas, grupos, informes de
 * alumnos y la API, no (los informes además llevan `noindex`).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/teacher', '/admin', '/aula/', '/aulas', '/informe/', '/autodidacta', '/practicar', '/sign-in/dev'],
    },
    sitemap: `${urlDelSitio()}/sitemap.xml`,
  }
}
