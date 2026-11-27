'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { MODALIDADES, type Modalidad } from '@/lib/modalidad'
import { pedirJson } from '@/lib/pedir-json'
import { MODALIDAD as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/** La ruta que abre el diálogo: la usan el menú de la cuenta y la ayuda de «Crear grupo». */
export const RUTA_COMO_DAS_CLASES = '/teacher?comoDasClases=1'

/** Las dos tarjetas de «¿Cómo das clases?»: en la bienvenida y en el diálogo. */
export function TarjetasDeModalidad({
  elegida,
  onElegir,
}: {
  elegida: Modalidad | null
  onElegir: (modalidad: Modalidad) => void
}) {
  return (
    <ul className="grid gap-3" role="radiogroup" aria-label={T.pregunta}>
      {MODALIDADES.map((m) => (
        <li key={m}>
          <button
            type="button"
            role="radio"
            aria-checked={elegida === m}
            onClick={() => onElegir(m)}
            data-modalidad={m}
            className={cn(
              'flex min-h-20 w-full flex-col justify-center rounded-lg border-2 p-4 text-left hover:border-accion',
              elegida === m ? 'border-accion bg-accion-tenue' : 'border-borde bg-superficie-tarjeta',
            )}
          >
            <span className="cuerpo font-bold text-texto">{T.opciones[m].titulo}</span>
            <span className="cuerpo-s mt-1 text-texto-suave">{T.opciones[m].detalle}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * AC1 · «Cómo das clases», con confirmación y el texto de qué cambia en el
 * plan. Se abre con `?comoDasClases=1` (desde el menú de la cuenta o desde la
 * ayuda de «Crear grupo»). Al guardar, `alGuardar` relee el plan.
 */
export function ComoDasClases({ actual, alGuardar }: { actual: Modalidad | null; alGuardar: () => void }) {
  const router = useRouter()
  const params = useSearchParams()
  const abierto = params?.get('comoDasClases') === '1'
  const [elegida, setElegida] = useState<Modalidad | null>(actual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (abierto) {
      setElegida(actual)
      setError(null)
    }
  }, [abierto, actual])

  const cerrar = () => router.replace('/teacher')

  async function guardar() {
    if (!elegida) return
    setGuardando(true)
    setError(null)
    const res = await pedirJson<{ modalidad: Modalidad | null }>('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modalidad: elegida }),
    })
    setGuardando(false)
    if ('error' in res || !res.data.modalidad) {
      setError(T.dialogo.noSeGuardo)
      return
    }
    alGuardar()
    cerrar()
  }

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && cerrar()}>
      <DialogContent className="rounded-lg border-borde sm:max-w-[480px]" data-como-das-clases>
        <DialogTitle className="titulo-m text-texto">{T.dialogo.titulo}</DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">{T.dialogo.detalle}</DialogDescription>
        <TarjetasDeModalidad elegida={elegida} onElegir={setElegida} />
        {elegida && (
          <p className="cuerpo-s rounded-md bg-superficie-suave p-3 text-texto" data-que-cambia>
            {T.dialogo.queCambia[elegida]}
          </p>
        )}
        {error && (
          <p className="nota text-flojo" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="secundario" onClick={cerrar}>
            {T.dialogo.cancelar}
          </Boton>
          <Boton disabled={!elegida || elegida === actual || guardando} onClick={() => void guardar()}>
            {guardando && <Cargando />}
            {T.dialogo.confirmar}
          </Boton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
