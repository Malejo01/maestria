'use client'

import { Check, CloudOff, AlertCircle } from 'lucide-react'
import { Cargando } from '@/components/sistema/cargando'
import { GUARDADO_DEL_RESULTADO as T } from '@/lib/textos'
import type { EstadoDeGuardado } from '@/lib/guardado-pendiente'

/**
 * M1: en la pantalla de resultados, si el intento llegó al servidor.
 * Guardando… / Guardado / Sin conexión: lo guardamos apenas vuelva internet.
 */
export function EstadoDelGuardado({
  estado,
  onReintentar,
}: {
  estado: EstadoDeGuardado | undefined
  onReintentar?: () => void
}) {
  if (!estado) return null

  return (
    <div role="status" aria-live="polite" className="cuerpo-s flex flex-wrap items-center justify-center gap-2 text-center">
      {estado.tipo === 'guardando' && (
        <span className="flex items-center gap-2 text-texto-suave">
          <Cargando /> {T.guardando}
        </span>
      )}
      {estado.tipo === 'guardado' && (
        <span className="flex items-center gap-1.5 text-logrado">
          <Check className="h-4 w-4" aria-hidden="true" /> {T.guardado}
        </span>
      )}
      {estado.tipo === 'sin-conexion' && (
        <>
          <span className="flex items-center gap-1.5 text-texto">
            <CloudOff className="h-4 w-4" aria-hidden="true" /> {T.sinConexion}
          </span>
          {onReintentar && (
            <button type="button" onClick={onReintentar} className="font-semibold text-accion underline underline-offset-2">
              {T.reintentar}
            </button>
          )}
        </>
      )}
      {estado.tipo === 'error' && (
        <span className="flex items-center gap-1.5 text-flojo">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> {T.error(estado.mensaje)}
        </span>
      )}
    </div>
  )
}
