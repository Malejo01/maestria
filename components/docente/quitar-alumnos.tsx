'use client'

import { useState } from 'react'
import { Cargando } from '@/components/sistema/cargando'
import { Boton } from '@/components/sistema/boton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { FilaQuitado } from '@/lib/alumnos-docente'
import { MIS_ALUMNOS } from '@/lib/textos'

const Q = MIS_ALUMNOS.quitarAlumno
const L = MIS_ALUMNOS.sinRespuestas
const V = MIS_ALUMNOS.quitados

export interface AQuitar {
  userId: string
  nombre: string
}

/**
 * J1: confirmar antes de quitar. Con uno, dice su nombre; con varios (la acción
 * en lote de fin de cuatrimestre), lista quiénes son antes de confirmar. En los
 * dos casos dice lo que el docente necesita saber para animarse: no se borra
 * nada de lo que respondió.
 */
export function ConfirmarQuitar({
  quienes,
  lote,
  onCerrar,
  alQuitar,
}: {
  /** null: el diálogo está cerrado. */
  quienes: AQuitar[] | null
  lote: boolean
  onCerrar: () => void
  alQuitar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState(false)

  function cerrar() {
    if (enviando) return
    setFallo(false)
    onCerrar()
  }

  async function confirmar() {
    if (!quienes || quienes.length === 0) return
    setEnviando(true)
    setFallo(false)
    try {
      const res = lote
        ? await fetch('/api/teacher/alumnos/quitar-sin-respuestas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: quienes.map((q) => q.userId) }),
          })
        : await fetch(`/api/teacher/alumnos/${encodeURIComponent(quienes[0].userId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEnviando(false)
      alQuitar()
      onCerrar()
    } catch {
      setEnviando(false)
      setFallo(true)
    }
  }

  const n = quienes?.length ?? 0

  return (
    <Dialog open={quienes !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="rounded-lg border-borde sm:max-w-[480px]">
        <DialogTitle className="titulo-m text-texto">
          {lote ? L.titulo(n) : Q.titulo(quienes?.[0]?.nombre ?? '')}
        </DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">{lote ? L.detalle : Q.detalle}</DialogDescription>

        {lote && quienes && (
          <div>
            <p className="nota mb-2 font-semibold text-texto-suave">{L.lista}</p>
            <ul className="cuerpo-s flex max-h-60 flex-col gap-1 overflow-y-auto rounded-md border border-borde bg-superficie-base p-3 text-texto">
              {quienes.map((q) => (
                <li key={q.userId}>{q.nombre}</li>
              ))}
            </ul>
          </div>
        )}

        {fallo && (
          <p className="nota text-flojo" role="alert">
            {Q.fallo}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={cerrar} disabled={enviando}>
            {Q.cancelar}
          </Boton>
          <Boton onClick={confirmar} disabled={enviando || n === 0}>
            {enviando && <Cargando />}
            {enviando ? Q.quitando : lote ? L.confirmar(n) : Q.confirmar}
          </Boton>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * J1: los quitados, plegados abajo del listado. Cada uno con "Volver a sumar",
 * que vuelve a ocupar un lugar del plan (el servidor lo mira y responde 402 si
 * no hay).
 */
export function ListaQuitados({ quitados, alCambiar }: { quitados: FilaQuitado[]; alCambiar: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [volviendo, setVolviendo] = useState<string | null>(null)
  const [aviso, setAviso] = useState<{ userId: string; texto: string } | null>(null)

  if (quitados.length === 0) return null

  async function volver(userId: string) {
    setVolviendo(userId)
    setAviso(null)
    try {
      const res = await fetch(`/api/teacher/alumnos/${encodeURIComponent(userId)}/volver`, { method: 'POST' })
      if (res.status === 402) {
        setAviso({ userId, texto: V.sinLugar })
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      alCambiar()
    } catch {
      setAviso({ userId, texto: V.fallo })
    } finally {
      setVolviendo(null)
    }
  }

  return (
    <section aria-label={V.titulo(quitados.length)} className="mt-1">
      <Boton variante="secundario" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)}>
        {abierto ? V.ocultar : V.mostrar(quitados.length)}
      </Boton>
      {abierto && (
        <div className="mt-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <h2 className="titulo-m text-texto">{V.titulo(quitados.length)}</h2>
          <p className="nota mt-1 text-texto-suave">{V.detalle}</p>
          <ul className="mt-3 flex flex-col">
            {quitados.map((q) => (
              <li
                key={q.userId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-borde py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <span className="cuerpo block truncate text-texto">{q.nombre}</span>
                  <span className="nota block truncate text-texto-suave">
                    {q.materias.map((m) => m.nombre).join(' · ')}
                    {' · '}
                    {V.quitadoEl(new Date(q.quitadoEl).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }))}
                  </span>
                  {aviso?.userId === q.userId && (
                    <span className="nota mt-1 block text-flojo" role="alert">
                      {aviso.texto}
                    </span>
                  )}
                </span>
                <Boton
                  variante="secundario"
                  aria-label={V.volverAria(q.nombre)}
                  disabled={volviendo !== null}
                  onClick={() => volver(q.userId)}
                >
                  {volviendo === q.userId && <Cargando />}
                  {volviendo === q.userId ? V.volviendo : V.volver}
                </Boton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
