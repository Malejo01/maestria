'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { AvisoItem } from '@/components/sistema/aviso-item'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { agruparPorDia, contarNoLeidos } from '@/lib/avisos/armar'
import type { RespuestaDeAvisos } from '@/lib/avisos/tipos'
import { pedirJson } from '@/lib/pedir-json'
import { AVISOS } from '@/lib/textos'

/**
 * P2 · La campanita, igual para el docente y el alumno: cambia sólo de dónde
 * salen los avisos (`endpoint`: GET devuelve RespuestaDeAvisos, POST marca
 * todo como leído).
 *
 * Se pide una vez al montar la barra (el caparazón no se desmonta entre
 * navegaciones, así que es una vez por pestaña) y otra cada vez que la pestaña
 * vuelve a estar a la vista (`visibilitychange`). Abrirla NO marca nada como
 * leído: para eso está "Marcar todo como leído".
 */
export function Campanita({ endpoint, vacio, vacioDetalle }: { endpoint: string; vacio: string; vacioDetalle: string }) {
  const [datos, setDatos] = useState<RespuestaDeAvisos | null>(null)
  const [abierta, setAbierta] = useState(false)
  const pidiendo = useRef(false)

  const pedir = useCallback(async () => {
    if (pidiendo.current) return
    pidiendo.current = true
    const r = await pedirJson<RespuestaDeAvisos>(endpoint)
    pidiendo.current = false
    if ('error' in r || !Array.isArray(r.data.avisos)) {
      setDatos((prev) => prev ?? { avisos: [], vistoEl: null, puedeMarcar: false })
      return
    }
    setDatos(r.data)
  }, [endpoint])

  useEffect(() => {
    // Un microtask: el primer pedido no es un setState sincrónico del efecto.
    void Promise.resolve().then(pedir)
    const alVolver = () => {
      if (document.visibilityState === 'visible') void pedir()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [pedir])

  const avisos = datos?.avisos ?? []
  const sinLeer = contarNoLeidos(avisos)
  const ahora = new Date()

  function marcarTodo() {
    setDatos((prev) => (prev ? { ...prev, avisos: prev.avisos.map((a) => ({ ...a, noLeido: false })) } : prev))
    void pedirJson(endpoint, { method: 'POST' })
  }

  return (
    <>
      <Popover open={abierta} onOpenChange={setAbierta}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={AVISOS.boton(sinLeer)}
            className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-borde bg-superficie-tarjeta text-texto hover:border-borde-fuerte sm:size-11"
          >
            <Bell aria-hidden="true" className="size-5" strokeWidth={TRAZO_ICONO} />
            {sinLeer > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 min-w-5 rounded-full bg-accion px-1 text-center text-[11px] font-bold leading-5 text-texto-sobre-accion"
              >
                {sinLeer > 9 ? '9+' : sinLeer}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
          <div className="flex items-center justify-between gap-2 border-b border-borde px-4 py-2">
            <p className="cuerpo-s py-1 font-bold text-texto">{AVISOS.titulo}</p>
            {datos?.puedeMarcar && sinLeer > 0 && (
              <button
                type="button"
                onClick={marcarTodo}
                className="nota inline-flex min-h-9 items-center gap-1 rounded-sm px-2 font-semibold text-accion hover:bg-superficie-suave"
              >
                <CheckCheck className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {AVISOS.marcarTodo}
              </button>
            )}
          </div>
          {!datos ? (
            <p className="cuerpo-s flex items-center gap-2 px-4 py-3 text-texto-suave" role="status">
              <Cargando /> {AVISOS.cargando}
            </p>
          ) : avisos.length === 0 ? (
            <SinAvisos titulo={vacio} detalle={vacioDetalle} />
          ) : (
            <div className="max-h-[min(60vh,32rem)] overflow-y-auto">
              {agruparPorDia(avisos, ahora).map((g) => (
                <section key={g.grupo} aria-label={g.titulo}>
                  <h3 className="etiqueta sticky top-0 z-10 bg-superficie-tarjeta px-4 pt-3 pb-1 text-texto-suave">{g.titulo}</h3>
                  <ul>
                    {g.avisos.map((a, i) => (
                      <AvisoItem key={a.clave} aviso={a} ahora={ahora} indice={i} onNavegar={() => setAbierta(false)} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {/* El contador para lectores de pantalla: se anuncia cuando cambia, sin robar el foco. */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {datos ? AVISOS.contador(sinLeer) : ''}
      </span>
    </>
  )
}

/** Estado vacío: una ilustración simple con los tokens del sistema, sin emojis. */
function SinAvisos({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
      <svg viewBox="0 0 96 72" className="h-16 w-auto" aria-hidden="true">
        <rect x="8" y="12" width="64" height="48" rx="10" className="fill-superficie-suave stroke-borde" strokeWidth="2" />
        <rect x="20" y="26" width="32" height="5" rx="2.5" className="fill-borde" />
        <rect x="20" y="37" width="22" height="5" rx="2.5" className="fill-borde" />
        <circle cx="72" cy="18" r="14" className="fill-accion-tenue stroke-accion-tenue-borde" strokeWidth="2" />
        <path d="M65.5 18.5 l4.5 4.5 l8.5 -9" className="fill-none stroke-accion" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="cuerpo-s font-bold text-texto">{titulo}</p>
      <p className="nota text-texto-suave">{detalle}</p>
    </div>
  )
}
