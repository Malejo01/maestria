'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useEffect, useId, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ONBOARDING_DOCENTE } from '@/lib/textos'

const T = ONBOARDING_DOCENTE.link

interface Grupo {
  id: number
  nombre: string
  codigo: string
}

/**
 * El link para invitar a un alumno, con el grupo automático detrás.
 *
 * El docente nunca ve un botón "crear aula". Pide el link y, si la materia
 * todavía no tiene grupo, se crea en ese momento (el endpoint es idempotente).
 *
 * Esta es la versión mínima que necesita el onboarding: el link y un botón de
 * copiar. La pantalla de compartir completa —con el texto prearmado para
 * WhatsApp— es el bloque 5 del rediseño.
 */
export function LinkDelGrupo({
  abierto,
  onCambiar,
  materia,
  alPrepararlo,
}: {
  abierto: boolean
  onCambiar: (abierto: boolean) => void
  materia: { id: number; nombre: string }
  /** Se llama cuando el grupo quedó listo, para que quien lo abrió relea su estado. */
  alPrepararlo?: () => void
}) {
  const idLink = useId()
  const [grupo, setGrupo] = useState<Grupo | null>(null)
  const [fallo, setFallo] = useState(false)
  const [copiado, setCopiado] = useState<'no' | 'si' | 'fallo'>('no')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!abierto || grupo) return

    let vigente = true
    setFallo(false)

    fetch('/api/teacher/onboarding/grupo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherProgramId: materia.id }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { grupo: Grupo }
      })
      .then((data) => {
        if (!vigente) return
        setGrupo(data.grupo)
        alPrepararlo?.()
      })
      .catch(() => {
        if (vigente) setFallo(true)
      })

    return () => {
      vigente = false
    }
    // `alPrepararlo` se omite: quien lo pasa lo recrea por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, grupo, materia.id, intento])

  const link = grupo ? `${window.location.origin}/aula/${grupo.codigo}` : ''

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado('si')
    } catch {
      setCopiado('fallo')
    }
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(siguiente) => {
        onCambiar(siguiente)
        if (!siguiente) setCopiado('no')
      }}
    >
      <DialogContent className="rounded-lg border-borde sm:max-w-[480px]">
        <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle(materia.nombre)}</DialogDescription>

        {!grupo && !fallo && (
          <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
            <Cargando />
            {T.preparando}
          </p>
        )}

        {fallo && (
          <div className="flex flex-col items-start gap-3">
            <p className="cuerpo-s text-texto" role="alert">
              {T.fallo}
            </p>
            <Boton variante="secundario" onClick={() => setIntento((n) => n + 1)}>
              {T.reintentar}
            </Boton>
          </div>
        )}

        {grupo && (
          <div className="flex flex-col gap-3">
            <div>
              <label htmlFor={idLink} className="nota mb-2 block font-semibold text-texto-suave">
                {T.etiquetaLink}
              </label>
              <input
                id={idLink}
                readOnly
                value={link}
                onFocus={(evento) => evento.currentTarget.select()}
                className="h-12 w-full rounded-md border border-borde-fuerte bg-superficie-base px-3 text-[15px] text-texto"
              />
            </div>

            <Boton ancho onClick={copiar}>
              {copiado === 'si' ? (
                <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              ) : (
                <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              )}
              <span aria-live="polite">{copiado === 'si' ? T.copiado : T.copiar}</span>
            </Boton>

            {copiado === 'fallo' && (
              <p className="nota text-flojo" role="alert">
                {T.noSeCopio}
              </p>
            )}

            <p className="nota text-texto-suave">
              {T.recordatorio} {T.codigo(grupo.codigo)}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
