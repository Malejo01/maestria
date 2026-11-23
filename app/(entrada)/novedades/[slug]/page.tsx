import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ExplicacionMarkdown } from '@/components/explicacion-markdown'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { leerNovedad, leerNovedades } from '@/lib/novedades-server'
import { NOVEDADES as T } from '@/lib/textos'

/** Ronda Y · Y3 — Una novedad (content/novedades/<slug>.md). */
export async function generateStaticParams() {
  return (await leerNovedades()).map((n) => ({ slug: n.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const n = await leerNovedad((await params).slug)
  return n ? { title: `${n.titulo} · ${T.titulo}`, description: n.resumen } : { title: T.titulo }
}

const fecha = (f: string) => new Date(`${f}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })

export default async function NovedadPage({ params }: { params: Promise<{ slug: string }> }) {
  const n = await leerNovedad((await params).slug)
  if (!n) notFound()
  return (
    <div className="w-full max-w-2xl space-y-6">
      <Link href="/novedades" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {T.volver}
      </Link>
      <article className="space-y-5 rounded-lg border border-borde bg-superficie-tarjeta p-5 sm:p-6" data-novedad={n.slug}>
        <header className="space-y-1">
          <p className="nota text-texto-suave">
            <time dateTime={n.fecha}>{fecha(n.fecha)}</time> · {T.para[n.para]}
          </p>
          <h1 className="titulo-l text-texto">{n.titulo}</h1>
          {n.resumen && <p className="cuerpo-s text-texto-suave">{n.resumen}</p>}
        </header>
        <ExplicacionMarkdown content={n.markdown} />
      </article>
    </div>
  )
}
