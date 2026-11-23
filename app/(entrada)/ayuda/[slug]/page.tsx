import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ExplicacionMarkdown } from '@/components/explicacion-markdown'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { esGuia, GUIAS } from '@/lib/ayuda'
import { leerGuia, leerGuias } from '@/lib/ayuda-server'
import { AYUDA } from '@/lib/textos'

/** Ronda V · V6 — Una guía del centro de ayuda (content/ayuda/<slug>.md). */
export function generateStaticParams() {
  return GUIAS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guia = esGuia(slug) ? await leerGuia(slug) : null
  return guia ? { title: `${guia.titulo} · Ayuda · MaestrIA`, description: guia.resumen } : { title: 'Ayuda · MaestrIA' }
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!esGuia(slug)) notFound()
  const guia = await leerGuia(slug)
  if (!guia) notFound()
  const otras = (await leerGuias()).filter((g) => g.slug !== slug)

  return (
    <div className="w-full max-w-2xl space-y-6">
      <Link href="/ayuda" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {AYUDA.volver}
      </Link>
      <article className="space-y-5 rounded-lg border border-borde bg-superficie-tarjeta p-5 sm:p-6" data-guia={guia.slug}>
        <header className="space-y-1">
          <h1 className="titulo-l text-texto">{guia.titulo}</h1>
          <p className="cuerpo-s text-texto-suave">{guia.resumen}</p>
        </header>
        {guia.partes.map((p, i) =>
          p.tipo === 'texto' ? (
            <ExplicacionMarkdown key={i} content={p.markdown} />
          ) : (
            <figure key={i} className="space-y-1">
              <Image src={p.src} alt={p.alt} width={900} height={600} sizes="(min-width: 672px) 620px, 100vw" className="h-auto w-auto max-w-full rounded-md border border-borde" />
              <figcaption className="nota text-texto-suave">{p.alt}</figcaption>
            </figure>
          ),
        )}
        {guia.accion && guia.accionTexto && (
          <Boton asChild>
            <Link href={guia.accion}>{guia.accionTexto}</Link>
          </Boton>
        )}
      </article>
      {otras.length > 0 && (
        <nav aria-label={AYUDA.otras} className="space-y-2">
          <h2 className="cuerpo font-bold text-texto">{AYUDA.otras}</h2>
          <ul className="flex flex-wrap gap-2">
            {otras.map((g) => (
              <li key={g.slug}>
                <Link href={`/ayuda/${g.slug}`} className="nota inline-flex min-h-11 items-center rounded-md border border-borde px-3 text-texto hover:border-borde-fuerte">
                  {g.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
