'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import type { ProgramUnit } from '@/lib/types'
import { SEPARAR_EN_TEMAS as T } from '@/lib/textos'

/**
 * Ronda T · D2 — "Separar en temas" un tema largo ya guardado. Pide la
 * propuesta (corte seguro o la IA, verificada), la muestra para revisar —se
 * puede corregir cada tema o sacarlo— y recién al guardar cambia el programa.
 * El primer tema conserva el id (A reforzar y diagnósticos siguen apuntando).
 */
export function SepararTema({
  programId,
  unidadId,
  tema,
  onGuardado,
}: {
  programId: number
  unidadId: string
  tema: { id: string; name: string }
  onGuardado: (units: ProgramUnit[]) => void
}) {
  const [pedazos, setPedazos] = useState<string[] | null>(null)
  const [viaIA, setViaIA] = useState(false)
  const [estado, setEstado] = useState<'quieto' | 'buscando' | 'guardando'>('quieto')
  const [error, setError] = useState<string | null>(null)
  const ruta = `/api/teacher/programs/${programId}/separar-tema`

  async function proponer() {
    setEstado('buscando')
    setError(null)
    const res = await pedirJson<{ pedazos: string[]; viaIA: boolean }>(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadId, temaId: tema.id, accion: 'proponer' }),
    })
    setEstado('quieto')
    if ('error' in res) return setError(res.error)
    if (res.data.pedazos.length < 2) return setError(T.sinPropuesta)
    setPedazos(res.data.pedazos)
    setViaIA(res.data.viaIA)
  }

  async function guardar() {
    if (!pedazos) return
    setEstado('guardando')
    setError(null)
    const res = await pedirJson<{ units: ProgramUnit[] }>(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidadId, temaId: tema.id, accion: 'aplicar', pedazos }),
    })
    setEstado('quieto')
    if ('error' in res) return setError(res.error)
    setPedazos(null)
    onGuardado(res.data.units)
  }

  if (!pedazos) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          onClick={proponer}
          disabled={estado === 'buscando'}
          aria-label={T.botonEtiqueta(tema.name)}
          className="nota inline-flex min-h-11 items-center gap-1 self-start font-semibold text-accion underline-offset-2 hover:underline disabled:opacity-60"
        >
          {estado === 'buscando' && <Cargando />}
          {estado === 'buscando' ? T.buscando : T.boton}
        </button>
        {error && (
          <span role="alert" className="nota text-flojo">
            {error}
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-accion-tenue-borde bg-accion-tenue p-3" data-separar-tema="">
      <p className="cuerpo-s font-semibold text-texto">{T.titulo}</p>
      <p className="nota text-texto-suave">{T.detalle}</p>
      {viaIA && <p className="nota text-texto-suave">{T.conIA}</p>}
      <ol className="space-y-1.5">
        {pedazos.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              aria-label={T.temaN(i + 1)}
              className="h-10 min-w-0 flex-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-2 cuerpo-s text-texto"
              value={p}
              maxLength={200}
              onChange={(e) => setPedazos((prev) => prev && prev.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              type="button"
              aria-label={T.quitar(p)}
              onClick={() => setPedazos((prev) => prev && prev.filter((_, j) => j !== i))}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-suave hover:text-texto"
            >
              <X className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Boton onClick={guardar} disabled={estado === 'guardando' || pedazos.filter((p) => p.trim()).length < 2}>
          {estado === 'guardando' ? T.guardando : T.guardar}
        </Boton>
        <Boton variante="secundario" onClick={() => setPedazos(null)}>
          {T.cancelar}
        </Boton>
      </div>
      {error && (
        <p role="alert" className="nota text-flojo">
          {error}
        </p>
      )}
    </div>
  )
}
