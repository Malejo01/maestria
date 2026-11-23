import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Logo } from '@/components/sistema/logo'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { leerGuias } from '@/lib/ayuda-server'
import { AYUDA } from '@/lib/textos'

/** Ronda V · V6 — El índice del centro de ayuda (público: sirve antes de registrarse). */
export const metadata: Metadata = { title: 'Ayuda · MaestrIA', description: AYUDA.detalle }

export default async function AyudaPage() {
  const guias = await leerGuias()
  return (
    <div className="w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <Link href="/" aria-label="MaestrIA">
          <Logo />
        </Link>
        <h1 className="titulo-l text-texto">{AYUDA.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{AYUDA.detalle}</p>
      </header>
      <ul className="overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta" data-guias>
        {guias.map((g) => (
          <li key={g.slug} className="border-b border-borde last:border-b-0">
            <Link href={`/ayuda/${g.slug}`} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-superficie-suave">
              <div className="min-w-0 flex-1">
                <p className="cuerpo-s font-semibold text-texto">{g.titulo}</p>
                <p className="nota text-texto-suave">{g.resumen}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-texto-suave" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
