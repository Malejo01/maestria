import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import { SessionProvider } from 'next-auth/react'
import './globals.css'

/**
 * Las tipografías se sirven desde `app/fonts/` y no desde `next/font/google`.
 *
 * `next/font/google` descarga en tiempo de BUILD. Cuando esa descarga falla no
 * falla la tipografía: falla la resolución del módulo, y toda la app devuelve
 * 500 — la home incluida. Medido el 16/08/2026: `fonts.googleapis.com` contesta
 * 200, pero las URLs de fuente variable que Next pide para Playfair devuelven
 * 404. No es una red lenta, son URLs que dejaron de existir; y `display: swap`
 * no ayuda, porque actúa al renderizar y acá el problema es anterior.
 *
 * Con los archivos versionados el build no toca la red nunca más, ni acá ni en
 * la máquina de quien clone el repo. Son 63 kB entre los dos.
 *
 * Los dos son fuentes VARIABLES, así que un archivo cubre todo el rango de
 * pesos. Los rangos declarados abajo son los que se venían pidiendo, no los
 * máximos que el formato admite: cambiarlos sin cambiar el archivo haría que el
 * navegador sintetice pesos que la fuente no trae.
 *
 * Para actualizarlas: bajar el subset `latin` de la API de Google con un
 * User-Agent de navegador (con otro devuelve TTF en vez de woff2) y reemplazar
 * el archivo. Los nombres de variable CSS no cambian.
 */
const manrope = localFont({
  src: './fonts/manrope-latin-variable.woff2',
  variable: '--font-manrope',
  weight: '200 800',
  display: 'swap',
})

const playfair = localFont({
  src: './fonts/playfair-display-latin-variable.woff2',
  variable: '--font-playfair',
  // El wordmark de la navbar se dibuja en 600; 700 queda disponible porque es
  // lo que declaraba la config anterior.
  weight: '600 700',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MaestrIA - Trabajos prácticos y cuestionarios con IA',
  description: 'Plataforma de generación de trabajos prácticos y cuestionarios con Inteligencia Artificial para todas las materias, grados y niveles educativos.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0066FF',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="bg-background">
      <body className={`${manrope.variable} ${playfair.variable} font-sans antialiased min-h-screen`}>
        <SessionProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </SessionProvider>
      </body>
    </html>
  )
}
