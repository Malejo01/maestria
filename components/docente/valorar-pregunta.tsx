'use client'

import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { MOTIVOS, type Motivo, type Valoracion } from '@/lib/valoraciones'
import { VALORACIONES as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * O8: el pulgar del docente en una pregunta de *Revisar y editar*. Arriba se
 * guarda al tocar; abajo pide el motivo con chips y se guarda al elegirlo.
 * Tocar el pulgar marcado lo saca. Los pulgares abajo entran al prompt de la
 * materia como "Evitá esto".
 *
 * `deshabilitado`: con cambios sin guardar, los índices pueden no coincidir
 * con lo guardado (el servidor valora lo guardado), así que se espera.
 */
export function ValorarPregunta({
  valoracion,
  deshabilitado,
  titleDeshabilitado,
  alValorar,
  alSacar,
}: {
  valoracion: Valoracion | null
  deshabilitado?: boolean
  titleDeshabilitado?: string
  alValorar: (valor: 1 | -1, motivo: Motivo | null) => Promise<boolean>
  alSacar: () => Promise<boolean>
}) {
  const [eligiendoMotivo, setEligiendoMotivo] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function correr(accion: () => Promise<boolean>) {
    setOcupado(true)
    await accion()
    setOcupado(false)
  }

  const arriba = valoracion?.valor === 1
  const abajo = valoracion?.valor === -1
  const base = 'inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50'

  return (
    <div className="flex flex-col gap-2" title={deshabilitado ? titleDeshabilitado : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={arriba}
          disabled={deshabilitado || ocupado}
          onClick={() => void correr(() => (arriba ? alSacar() : alValorar(1, null)))}
          className={cn(base, arriba ? 'border-logrado text-logrado' : 'border-borde-fuerte text-texto-suave hover:text-texto')}
        >
          <ThumbsUp aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
          {T.arriba}
        </button>
        <button
          type="button"
          aria-pressed={abajo || eligiendoMotivo}
          aria-expanded={eligiendoMotivo}
          disabled={deshabilitado || ocupado}
          onClick={() => {
            if (abajo) void correr(alSacar)
            else setEligiendoMotivo((v) => !v)
          }}
          className={cn(base, abajo || eligiendoMotivo ? 'border-flojo text-flojo' : 'border-borde-fuerte text-texto-suave hover:text-texto')}
        >
          <ThumbsDown aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
          {abajo && valoracion?.motivo ? T.motivos[valoracion.motivo] : T.abajo}
        </button>
      </div>
      {eligiendoMotivo && !abajo && (
        <div role="group" aria-label={T.porQue} className="flex flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={ocupado}
              onClick={() =>
                void correr(async () => {
                  const ok = await alValorar(-1, m)
                  if (ok) setEligiendoMotivo(false)
                  return ok
                })
              }
              className="min-h-9 rounded-full border border-borde-fuerte bg-superficie-tarjeta px-3 text-xs font-semibold text-texto hover:border-flojo"
            >
              {T.motivos[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
