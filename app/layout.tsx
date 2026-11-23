import { urlDelSitio } from '@/lib/sitio'
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { SessionProvider } from 'next-auth/react'
import { COLOR_DE_BARRA_DEL_NAVEGADOR, SCRIPT_TEMA } from '@/lib/tema'
import './globals.css'

/**
 * Las tipografías se sirven desde `app/fonts/` y no desde `next/font/google`.
 *
 * `next/font/google` descarga en tiempo de BUILD. Cuando esa descarga falla no
 * falla la tipografía: falla la resolución del módulo, y toda la app devuelve
 * 500 — la home incluida (medido el 16/08/2026, ver docs/roadmap.md). Con los
 * archivos versionados el build no toca la red nunca.
 *
 * Son las dos familias del sistema de diseño y ninguna más: Plus Jakarta Sans
 * para títulos (se usa en 800) e Inter para todo lo demás. Las dos son fuentes
 * VARIABLES, así que un archivo cubre todo el rango de pesos; los rangos
 * declarados son los que trae el archivo, no más.
 *
 * Para actualizarlas: bajar el subset `latin` de la API de Google con un
 * User-Agent de navegador (con otro devuelve TTF en vez de woff2) y reemplazar
 * el archivo. Los nombres de variable CSS no cambian.
 */
const jakarta = localFont({
  src: './fonts/plus-jakarta-sans-latin-variable.woff2',
  variable: '--font-jakarta',
  weight: '200 800',
  display: 'swap',
})

const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
})

const DESCRIPCION =
  'Cargás tu programa y MaestrIA arma las tareas de tu materia y te muestra tema por tema qué tiene que reforzar cada alumno. Para clases particulares, cursos y para prepararse solo para un examen.'

/** V5: las URLs absolutas (Open Graph, canónica) salen de NEXT_PUBLIC_SITE_URL (lib/sitio.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(urlDelSitio()),
  title: 'MaestrIA: tu alumno llega a la mesa sabiendo qué le falta',
  description: DESCRIPCION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    siteName: 'MaestrIA',
    title: 'MaestrIA: tu alumno llega a la mesa sabiendo qué le falta',
    description: DESCRIPCION,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: 'MaestrIA: tu alumno llega a la mesa sabiendo qué le falta', description: DESCRIPCION },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Sin `maximumScale` ni `userScalable: false`: bloquear el zoom deja afuera a
  // quien necesita agrandar una fórmula para leerla (WCAG 1.4.4).
  themeColor: COLOR_DE_BARRA_DEL_NAVEGADOR.claro,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Las variables de las fuentes van en <html> y no en <body>: los tokens
    // tipográficos se resuelven en :root. `suppressHydrationWarning` es por
    // data-theme, que el script de abajo puede cambiar antes de hidratar.
    <html
      lang="es"
      data-theme="claro"
      className={`${jakarta.variable} ${inter.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="font-sans antialiased min-h-screen">
        <SessionProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </SessionProvider>
      </body>
    </html>
  )
}
