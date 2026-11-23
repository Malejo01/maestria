import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Ojo: esto apaga el pipeline de optimización de imágenes, que es lo único
    // que invoca a `sharp`. Reactivarlo enciende las CVEs de libvips que hoy
    // están en un camino de código muerto — ver docs/deuda-tecnica.md.
    unoptimized: true,
  },
  // X4: el service worker no se cachea en el navegador: una versión nueva se toma al toque.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Sin token no hay subida de source maps, pero el build sigue funcionando:
  // así un clon del repo sin credenciales de Sentry compila igual.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,

  sourcemaps: {
    // Los source maps se suben a Sentry y se borran del bundle: los stack
    // traces quedan legibles en el panel sin quedar expuestos en producción.
    deleteSourcemapsAfterUpload: true,
  },

  // Ruta propia para los eventos del navegador, de modo que un bloqueador de
  // anuncios no se coma los reportes del cliente. Está en PUBLIC_PATHS de
  // proxy.ts: si el middleware la interceptara, se perderían justamente los
  // errores de quien todavía no inició sesión.
  tunnelRoute: '/monitoring',
})
