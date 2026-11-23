'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { pedirJson } from '@/lib/pedir-json'
import { LARGO_MAXIMO_PROXIMOS_PASOS, nombreCorto } from '@/lib/informe-familia'
import { INFORME_FAMILIA as T } from '@/lib/textos'

interface LinkActivo {
  id: number
  venceEl: string
  vistoEl: string | null
}

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })

/**
 * Ronda V · V4 — "Compartir informe" en la ficha: los próximos pasos, el link
 * (se ve una sola vez), Copiar y WhatsApp sin número; abajo, los links activos
 * con "Revocar". Sin la 047, el botón no aparece.
 */
export function CompartirInforme({ userId, nombre }: { userId: string; nombre: string }) {
  const [disponible, setDisponible] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [pasos, setPasos] = useState('')
  const [armando, setArmando] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activos, setActivos] = useState<LinkActivo[]>([])
  const url = `/api/teacher/alumnos/${encodeURIComponent(userId)}/informes`

  const leer = useCallback(async () => {
    const res = await pedirJson<{ disponible: boolean; links: LinkActivo[] }>(url)
    if ('error' in res) return
    setDisponible(res.data.disponible)
    setActivos(res.data.links)
  }, [url])

  useEffect(() => {
    void leer()
  }, [leer])

  if (!disponible) return null

  async function armar(e: React.FormEvent) {
    e.preventDefault()
    setArmando(true)
    setError(null)
    const res = await pedirJson<{ link: string }>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proximosPasos: pasos }),
    })
    setArmando(false)
    if ('error' in res) {
      setError(T.noSePudo)
      return
    }
    setLink(res.data.link)
    void leer()
  }

  async function copiar() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin portapapeles: el link igual se ve.
    }
  }

  async function revocar(id: number) {
    await pedirJson(`/api/teacher/informes/${id}`, { method: 'DELETE' })
    void leer()
  }

  return (
    <>
      <Boton variante="secundario" className="shrink-0" onClick={() => setAbierto(true)}>
        <Share2 className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        {T.compartir}
      </Boton>
      <Dialog
        open={abierto}
        onOpenChange={(v) => {
          setAbierto(v)
          if (!v) {
            setLink(null)
            setPasos('')
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle}</DialogDescription>
          {link ? (
            <div className="space-y-3" data-link-del-informe>
              <p className="cuerpo-s text-texto" role="status">
                {T.listo}
              </p>
              <p className="nota break-all rounded-md bg-superficie-suave p-3 text-texto">{link}</p>
              <div className="flex flex-wrap gap-2">
                <Boton variante="secundario" onClick={copiar}>
                  {copiado ? <Check className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
                  {copiado ? T.copiado : T.copiar}
                </Boton>
                <Boton asChild variante="secundario">
                  <a href={`https://wa.me/?text=${encodeURIComponent(T.mensaje(nombreCorto(nombre), link))}`} target="_blank" rel="noopener noreferrer">
                    {T.whatsapp}
                  </a>
                </Boton>
              </div>
            </div>
          ) : (
            <form onSubmit={armar} className="space-y-3">
              <label className="block space-y-1">
                <span className="cuerpo-s font-semibold text-texto">{T.proximosPasos}</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta p-3 cuerpo-s text-texto"
                  value={pasos}
                  maxLength={LARGO_MAXIMO_PROXIMOS_PASOS}
                  placeholder={T.proximosPasosAyuda}
                  onChange={(e) => setPasos(e.target.value)}
                />
              </label>
              <Boton type="submit" disabled={armando}>
                {armando ? T.armando : T.armar}
              </Boton>
              {error && (
                <p className="cuerpo-s text-flojo" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
          <section className="space-y-2 border-t border-borde pt-3">
            <h3 className="cuerpo-s font-bold text-texto">{T.activos}</h3>
            {activos.length === 0 ? (
              <p className="nota text-texto-suave">{T.sinActivos}</p>
            ) : (
              <ul className="space-y-1">
                {activos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2">
                    <span className="nota text-texto-suave">
                      {T.venceEl(fecha(a.venceEl))} · {a.vistoEl ? T.visto : T.noVisto}
                    </span>
                    <button
                      type="button"
                      onClick={() => revocar(a.id)}
                      className="nota inline-flex min-h-11 items-center font-semibold text-accion hover:text-accion-hover"
                    >
                      {T.revocar}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </DialogContent>
      </Dialog>
    </>
  )
}
