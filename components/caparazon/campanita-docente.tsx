'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { noLeidos, type AvisoDocente } from '@/lib/avisos-docente'
import { pedirJson } from '@/lib/pedir-json'
import { AVISOS_DOCENTE as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/** "Hoy", "Ayer" o "20/11", con el día en hora de Argentina (lo arma la base). */
function etiquetaDelDia(dia: string): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date())
  const ayer = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(Date.now() - 86_400_000))
  if (dia === hoy) return T.hoy
  if (dia === ayer) return T.ayer
  const [, mes, d] = dia.split('-')
  return `${d}/${mes}`
}

/**
 * O10: la campanita de la barra del docente. Se pide una vez al montar la
 * barra; abrirla marca todo como visto (el número se va, los avisos quedan).
 * No hay correo ni push: es lo que ya pasó en sus grupos.
 */
export function CampanitaDocente() {
  const [avisos, setAvisos] = useState<AvisoDocente[] | null>(null)
  const [abierta, setAbierta] = useState(false)

  useEffect(() => {
    let vigente = true
    void pedirJson<{ avisos: AvisoDocente[] }>('/api/teacher/avisos').then((r) => {
      if (vigente) setAvisos('error' in r || !Array.isArray(r.data.avisos) ? [] : r.data.avisos)
    })
    return () => {
      vigente = false
    }
  }, [])

  const sinVer = noLeidos(avisos ?? [])

  function cambiar(abre: boolean) {
    setAbierta(abre)
    if (abre && sinVer > 0) {
      void pedirJson('/api/teacher/avisos', { method: 'POST' })
    }
    if (!abre && sinVer > 0) setAvisos((prev) => (prev ?? []).map((a) => ({ ...a, noLeido: false })))
  }

  return (
    <Popover open={abierta} onOpenChange={cambiar}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={T.boton(sinVer)}
          className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md sm:size-11 border border-borde bg-superficie-tarjeta text-texto hover:border-borde-fuerte"
        >
          <Bell aria-hidden="true" className="size-5" strokeWidth={TRAZO_ICONO} />
          {sinVer > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accion px-1 text-center text-[11px] font-bold leading-5 text-texto-sobre-accion"
            >
              {sinVer > 9 ? '9+' : sinVer}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <p className="cuerpo-s border-b border-borde px-4 py-3 font-bold text-texto">{T.titulo}</p>
        {!avisos ? (
          <p className="cuerpo-s flex items-center gap-2 px-4 py-3 text-texto-suave" role="status">
            <Cargando /> {T.cargando}
          </p>
        ) : avisos.length === 0 ? (
          <p className="cuerpo-s px-4 py-3 text-texto-suave">{T.vacio}</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {avisos.map((a) => (
              <li key={a.clave} className="border-b border-borde last:border-b-0">
                <Link
                  href={a.href}
                  onClick={() => cambiar(false)}
                  className={cn('flex flex-col gap-0.5 px-4 py-3 hover:bg-superficie-base', a.noLeido && 'bg-accion-tenue')}
                >
                  <span className="cuerpo-s text-texto">{a.texto}</span>
                  <span className="nota text-texto-suave">{etiquetaDelDia(a.dia)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
