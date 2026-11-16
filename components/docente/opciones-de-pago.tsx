'use client'

import { ExternalLink } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { formatearPesos, type OpcionDePago } from '@/lib/planes'
import { PLAN } from '@/lib/textos'
import { cn } from '@/lib/utils'

const T = PLAN.opciones

/**
 * Las dos formas de pagar un nivel: por mes y el pase de 90 días. Una opción
 * sin link de pago no se ofrece (G4: si falta la variable, no rompe nada).
 *
 * Es la única fuerza de ventas que hay: dice qué se paga, por cuánto tiempo,
 * cuántos alumnos entran y lleva directo al pago. Nada de "contactá al
 * administrador".
 */
export function OpcionesDePago({ opcion, className }: { opcion: OpcionDePago | null; className?: string }) {
  const mensual = opcion?.mensual?.link ? opcion.mensual : null
  const pase = opcion?.pase?.link ? opcion.pase : null

  if (!opcion || (!mensual && !pase)) {
    return <p className={cn('nota text-texto-suave', className)}>{T.sinPago}</p>
  }

  const ahorro = mensual && pase ? mensual.monto * 3 - pase.monto : 0

  return (
    <div className={cn('space-y-3', className)}>
      <p className="etiqueta text-texto-suave">
        {T.nivel(opcion.nivel)} · {T.cupo(opcion.cupo)}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {mensual && (
          <Opcion
            titulo={T.mensual}
            monto={mensual.monto}
            detalle={T.mensualDetalle}
            link={mensual.link!}
            boton={T.pagarMensual}
            variante="secundario"
          />
        )}
        {pase && (
          <Opcion
            titulo={T.pase}
            monto={pase.monto}
            detalle={T.paseDetalle}
            extra={ahorro > 0 ? T.ahorro(formatearPesos(ahorro)) : null}
            link={pase.link!}
            boton={T.pagarPase}
            variante="principal"
          />
        )}
      </div>
      <p className="nota text-texto-suave">{T.acreditacion}</p>
    </div>
  )
}

function Opcion({
  titulo,
  monto,
  detalle,
  extra,
  link,
  boton,
  variante,
}: {
  titulo: string
  monto: number
  detalle: string
  extra?: string | null
  link: string
  boton: string
  variante: 'principal' | 'secundario'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        variante === 'principal' ? 'border-accion-tenue-borde bg-accion-tenue' : 'border-borde bg-superficie-tarjeta',
      )}
    >
      <div>
        <p className="cuerpo-s font-bold text-texto">{titulo}</p>
        <p className="titulo-m text-texto">{formatearPesos(monto)}</p>
        <p className="nota text-texto-suave">{detalle}</p>
        {extra && <p className="nota mt-1 font-semibold text-logrado">{extra}</p>}
      </div>
      <Boton asChild ancho variante={variante} className="mt-auto">
        <a href={link} target="_blank" rel="noopener noreferrer">
          {boton}
          <ExternalLink aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        </a>
      </Boton>
    </div>
  )
}
