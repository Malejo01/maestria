'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ResumenDePago } from '@/components/pagos/resumen-de-pago'
import { fraseDeEvidencia, hayEvidencia, type Evidencia } from '@/lib/evidencia-del-muro'
import { pedirJson } from '@/lib/pedir-json'
import { ALUMNOS_POR_BLOQUE, formatearPesos } from '@/lib/planes'
import { MURO as T, PLAN } from '@/lib/textos'
import { cn } from '@/lib/utils'

interface VistaProps {
  cupoGratis: number
  /** `precioMensual(1)`, o null sin la variable: la oferta no dice el número. */
  precioBloque: number | null
  /** undefined mientras se lee; null si no se pudo leer (se muestra el texto honesto). */
  evidencia: Evidencia | null | undefined
  ahora?: Date
  /** El pago: «¿Tenés un código?» y el botón al checkout. */
  pago: ReactNode
  onVolver: () => void
}

/**
 * AB6 · El muro del 3.er alumno, presentación pura: la evidencia primero, la
 * oferta después, la garantía, «sin débito automático» y el pago (con el
 * código fundador que crea Mauro en /admin/codigos).
 */
export function VistaDelMuro({ cupoGratis, precioBloque, evidencia, ahora = new Date(), pago, onVolver }: VistaProps) {
  const conEvidencia = hayEvidencia(evidencia)
  return (
    <div className="flex flex-col gap-4" data-muro>
      <DialogTitle className="titulo-m text-texto">{T.titulo(cupoGratis)}</DialogTitle>

      <section
        aria-label={T.evidencia}
        className={cn('rounded-lg border p-4', conEvidencia ? 'border-accion-tenue-borde bg-accion-tenue' : 'border-borde bg-superficie-suave')}
        data-evidencia={conEvidencia ? 'si' : 'no'}
      >
        <DialogDescription className="cuerpo text-texto">
          {evidencia === undefined ? T.cargando : fraseDeEvidencia(evidencia, ahora, cupoGratis)}
        </DialogDescription>
      </section>

      <div className="space-y-2">
        <p className="cuerpo font-bold text-texto" data-oferta>
          {T.oferta(precioBloque === null ? null : formatearPesos(precioBloque), ALUMNOS_POR_BLOQUE)}
        </p>
        <ul className="space-y-1">
          <li className="cuerpo-s flex items-start gap-2 text-texto">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accion" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {T.garantia}
          </li>
          <li className="cuerpo-s flex items-start gap-2 text-texto">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accion" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {T.sinDebito}
          </li>
        </ul>
      </div>

      {pago}

      <Boton variante="secundario" onClick={onVolver}>
        {PLAN.limite.volver}
      </Boton>
    </div>
  )
}

/**
 * El muro con sus datos: lee la evidencia (GET /api/teacher/evidencia) y pone
 * el resumen de pago de siempre (el plan Particular de 1 bloque, por mes).
 */
export function MuroDelTercerAlumno({
  cupoGratis,
  precioBloque,
  onVolver,
}: {
  cupoGratis: number
  precioBloque: number | null
  onVolver: () => void
}) {
  const [evidencia, setEvidencia] = useState<Evidencia | null | undefined>(undefined)
  useEffect(() => {
    let vigente = true
    void pedirJson<{ evidencia: Evidencia }>('/api/teacher/evidencia').then((res) => {
      if (vigente) setEvidencia('error' in res ? null : res.data.evidencia)
    })
    return () => {
      vigente = false
    }
  }, [])
  return (
    <VistaDelMuro
      cupoGratis={cupoGratis}
      precioBloque={precioBloque}
      evidencia={evidencia}
      onVolver={onVolver}
      pago={<ResumenDePago pedido={{ plan: 'particular', forma: 'mensual', cantidad: 1 }} />}
    />
  )
}
