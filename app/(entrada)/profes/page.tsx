import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { EmpezarProfes } from '@/components/entrada/empezar-profes'
import { ALUMNOS_POR_BLOQUE, cupoGratis, formatearPesos, precioMensual } from '@/lib/planes'
import { linkDeWhatsApp } from '@/lib/precios'
import { PROFES as T } from '@/lib/textos'

/**
 * Tandas AA3 + AB2 · /profes: la página a la que llega el docente desde el
 * anuncio de Meta (`/profes?origen=meta&ref=AD-<nombre>`).
 *
 * Corta y para el celular: título, bajada, tres puntos y un botón, sin hacer
 * scroll de más. Es estática a propósito (Lighthouse en celular ≥ 85): se arma
 * en el build, con el precio del bloque y el número de WhatsApp de ese
 * momento, y el `origen`/`ref` de la URL los suma el botón en el navegador.
 *
 * El video es `public/profes/reel.mp4` (lo pasa Mauro): sin reproducción
 * automática, con controles y la captura como portada. Si el archivo no está,
 * se muestra sólo la captura.
 */
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Empezá gratis con 2 alumnos | MaestrIA',
  description: T.descripcion,
  openGraph: { title: 'Empezá gratis con 2 alumnos', description: T.descripcion },
}

const CAPTURA = '/portada/particulares.png'
const VIDEO = '/profes/reel.mp4'

function hayVideo(): boolean {
  try {
    return existsSync(join(process.cwd(), 'public', 'profes', 'reel.mp4'))
  } catch {
    return false
  }
}

export default function ProfesPage() {
  const gratis = cupoGratis()
  const bloque = precioMensual(1)
  const whatsapp = linkDeWhatsApp(T.mensajeCargamelo)
  const video = hayVideo()

  return (
    <div className="flex w-full max-w-xl flex-col gap-6" data-profes>
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="titulo-l text-balance text-texto">{T.titulo(gratis)}</h1>
        <p className="cuerpo-l font-semibold text-texto">{T.bajada}</p>
      </header>

      <ol className="flex flex-col gap-3" aria-label={T.titulo(gratis)}>
        {T.puntos.map((punto, i) => (
          <li key={punto} className="flex gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <span
              aria-hidden="true"
              className="etiqueta flex size-7 shrink-0 items-center justify-center rounded-full bg-accion text-texto-sobre-accion"
            >
              {i + 1}
            </span>
            <p className="cuerpo-s text-texto">{punto}</p>
          </li>
        ))}
      </ol>

      <EmpezarProfes texto={T.empezar(gratis)} />

      <section aria-label={T.video} className="space-y-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-borde bg-superficie-base">
          {video ? (
            <video
              className="size-full object-cover"
              controls
              playsInline
              preload="none"
              poster={CAPTURA}
              aria-label={T.video}
              data-video-profes
            >
              <source src={VIDEO} type="video/mp4" />
            </video>
          ) : (
            <Image
              src={CAPTURA}
              alt={T.captura}
              fill
              sizes="(min-width: 640px) 576px, 100vw"
              className="object-cover object-top"
              data-captura-profes
            />
          )}
        </div>
        <p className="nota text-center text-texto-suave">{T.datosDeEjemplo}</p>
      </section>

      <div className="flex flex-col items-center gap-3">
        {whatsapp && (
          <Boton asChild variante="secundario" ancho className="gap-1.5">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" data-cargamelo>
              {T.cargamelo}
              <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </a>
          </Boton>
        )}
        <Link href="/precios" className="cuerpo-s font-semibold text-accion underline-offset-4 hover:underline">
          {T.verPrecios}
        </Link>
        <p className="nota text-center text-texto-suave" data-ancla>
          {T.ancla(bloque === null ? null : formatearPesos(bloque), gratis, ALUMNOS_POR_BLOQUE)}
        </p>
      </div>
    </div>
  )
}
