import type { Metadata } from 'next'
import Link from 'next/link'
import { leerNovedades } from '@/lib/novedades-server'
import { NOVEDADES as T } from '@/lib/textos'

/** Ronda Y · Y3 — /novedades: lo nuevo de MaestrIA (content/novedades/*.md), de lo más nuevo a lo más viejo. */
export const metadata: Metadata = { title: `${T.titulo}`, description: T.detalle }

const fecha = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })

export default async function NovedadesPage() {
  const novedades = await leerNovedades()
  return (
    <div className="w-full max-w-2xl space-y-6" data-novedades>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      </header>
      {novedades.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <ul className="space-y-3">
          {novedades.map((n) => (
            <li key={n.slug}>
              <Link href={`/novedades/${n.slug}`} className="block space-y-1 rounded-lg border border-borde bg-superficie-tarjeta p-4 transition-colors hover:border-borde-fuerte">
                <p className="nota text-texto-suave">
                  <time dateTime={n.fecha}>{fecha(n.fecha)}</time> · {T.para[n.para]}
                </p>
                <h2 className="titulo-s text-texto">{n.titulo}</h2>
                {n.resumen && <p className="cuerpo-s text-texto-suave">{n.resumen}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
