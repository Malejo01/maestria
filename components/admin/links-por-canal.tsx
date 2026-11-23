'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { CANALES, linkDeCanal, NOMBRE_DEL_CANAL, normalizarRef, type Canal } from '@/lib/origen'
import { ORIGEN } from '@/lib/textos'

const T = ORIGEN.links

/**
 * V1 · El generador de links de difusión: uno por canal, con el código de
 * referido si se carga. Copiar deja el link en el portapapeles.
 */
export function LinksPorCanal({ base }: { base: string }) {
  const [ref, setRef] = useState('')
  const [copiado, setCopiado] = useState<Canal | null>(null)
  const codigo = normalizarRef(ref)

  async function copiar(canal: Canal, link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(canal)
      setTimeout(() => setCopiado((c) => (c === canal ? null : c)), 2000)
    } catch {
      // Sin permiso de portapapeles: el link igual se ve y se puede seleccionar.
    }
  }

  return (
    <section aria-labelledby="admin-links" className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4" data-links-por-canal>
      <h2 id="admin-links" className="titulo-m text-texto">
        {T.titulo}
      </h2>
      <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      <label className="block max-w-xs space-y-1">
        <span className="nota font-semibold text-texto">{T.ref}</span>
        <input
          className="h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s uppercase text-texto"
          value={ref}
          maxLength={40}
          onChange={(e) => setRef(e.target.value)}
        />
      </label>
      <ul className="divide-y divide-borde">
        {CANALES.map((canal) => {
          const link = linkDeCanal(base, canal, codigo)
          return (
            <li key={canal} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:gap-3">
              <span className="cuerpo-s w-24 shrink-0 font-semibold text-texto">{NOMBRE_DEL_CANAL[canal]}</span>
              <code className="nota min-w-0 flex-1 break-all text-texto-suave">{link}</code>
              <button
                type="button"
                onClick={() => copiar(canal, link)}
                className="nota inline-flex min-h-11 shrink-0 items-center gap-1 self-start rounded-md border border-borde px-3 font-semibold text-texto hover:border-borde-fuerte sm:self-auto"
                aria-label={`${T.copiar} ${NOMBRE_DEL_CANAL[canal]}`}
              >
                {copiado === canal ? <Check className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
                {copiado === canal ? T.copiado : T.copiar}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
