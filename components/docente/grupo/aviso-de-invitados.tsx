'use client'

import { AlertTriangle } from 'lucide-react'
import { guestCapStatus } from '@/lib/classrooms'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import { cn } from '@/lib/utils'

const T = PAGINA_DEL_GRUPO.invitados

/**
 * Aviso de tope de invitados nuevos (salió de la vista vieja de un aula, M3).
 * Sin esto, cuando el grupo llega al tope el docente sólo se entera por un
 * alumno que dice "no me deja entrar", que es otra vez un corte disfrazado de
 * "no anda". Aparece al 75% para dar tiempo a que el resto entre con Google
 * antes de que alguien quede afuera.
 */
export function AvisoDeInvitados({ nuevos, tope }: { nuevos: number; tope: number }) {
  const estado = guestCapStatus(nuevos, tope)
  if (estado === 'ok') return null
  const lleno = estado === 'reached'

  return (
    <div
      role={lleno ? 'alert' : 'status'}
      className={cn(
        'nota flex gap-2 rounded-md border p-3 leading-relaxed',
        lleno ? 'border-flojo bg-flojo-fondo text-texto' : 'border-flojo/40 bg-flojo-fondo/60 text-texto',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-flojo" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{lleno ? T.lleno(tope) : T.cerca(nuevos, tope)}</p>
        <p>
          {lleno ? T.llenoDetalle : T.cercaDetalle}
          {T.queHacer}
        </p>
      </div>
    </div>
  )
}
