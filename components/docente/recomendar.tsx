'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { REFERIDOS as T } from '@/lib/textos'

interface DatosDeReferidos {
  activo: boolean
  codigo: string | null
  link: string | null
  registrados: number
  pagaron: number
  diasGanados: number
}

/**
 * Ronda V · V3 — "Recomendá MaestrIA": el código y el link de referido del
 * docente, para copiar o mandar por WhatsApp (sin número: elige el contacto).
 * No se muestra nada si los referidos están apagados (la válvula).
 */
export function Recomendar() {
  const [datos, setDatos] = useState<DatosDeReferidos | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vigente = true
    void pedirJson<DatosDeReferidos>('/api/teacher/referidos').then((res) => {
      if (vigente && !('error' in res)) setDatos(res.data)
    })
    return () => {
      vigente = false
    }
  }, [])

  if (!datos?.activo || !datos.codigo || !datos.link) return null
  const link = datos.link

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin portapapeles: el link igual se ve.
    }
  }

  return (
    <section aria-labelledby="recomendar" className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4" data-recomendar>
      <h2 id="recomendar" className="titulo-m text-texto">
        {T.titulo}
      </h2>
      <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      <dl className="grid gap-2 sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="nota text-texto-suave">{T.tuCodigo}</dt>
        <dd className="cuerpo-s font-bold tabular-nums text-texto">{datos.codigo}</dd>
        <dt className="nota text-texto-suave">{T.tuLink}</dt>
        <dd className="nota break-all text-texto">{link}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Boton variante="secundario" onClick={copiar}>
          {copiado ? <Check className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
          {copiado ? T.copiado : T.copiar}
        </Boton>
        <Boton asChild variante="secundario">
          <a href={`https://wa.me/?text=${encodeURIComponent(T.mensaje(link))}`} target="_blank" rel="noopener noreferrer">
            {T.compartir}
          </a>
        </Boton>
      </div>
      <p className="nota text-texto-suave">{T.resumen(datos.registrados, datos.pagaron, datos.diasGanados)}</p>
    </section>
  )
}
