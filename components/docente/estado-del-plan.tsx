'use client'

import { useState } from 'react'
import { Clock, Check, Lock } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { OpcionesDePago } from '@/components/docente/opciones-de-pago'
import type { PlanDelPanel } from '@/components/docente/use-plan-docente'
import { DIAS_DE_AVISO } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

const T = PLAN.vencimiento

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' })

/** Qué mostrar arriba del panel según el plan: nada, el aviso de días o la pantalla de vencido. */
export function queMostrar(datos: PlanDelPanel | null): 'nada' | 'por-vencer' | 'vencido' {
  const plan = datos?.plan
  if (!plan || plan.estado === 'exento') return 'nada'
  if (plan.estado === 'vencido') return 'vencido'
  if (plan.diasRestantes !== null && plan.diasRestantes > 0 && plan.diasRestantes <= DIAS_DE_AVISO) return 'por-vencer'
  return 'nada'
}

/**
 * G3, "al vencer": un banner persistente con los días que faltan cuando
 * quedan 7 o menos, y la pantalla de solo lectura cuando ya venció. Ninguna
 * de las dos tapa el panel: el docente sigue viendo todo lo suyo.
 */
export function EstadoDelPlan({ datos }: { datos: PlanDelPanel | null }) {
  const [planesAbiertos, setPlanesAbiertos] = useState(false)
  const modo = queMostrar(datos)
  if (modo === 'nada' || !datos) return null
  const { plan, renovar } = datos
  const esPrueba = plan.nivel === 0

  if (modo === 'por-vencer') {
    return (
      <section
        aria-label={T.banner(plan.diasRestantes ?? 0, esPrueba)}
        className="flex flex-col gap-3 rounded-lg border border-flojo bg-flojo-fondo p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-flojo" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          <div>
            <p className="cuerpo-s font-bold text-texto">{T.banner(plan.diasRestantes ?? 0, esPrueba)}</p>
            <p className="nota text-texto-suave">{T.bannerDetalle}</p>
          </div>
        </div>
        <Boton variante="secundario" onClick={() => setPlanesAbiertos(true)} className="shrink-0">
          {T.verPlanes}
        </Boton>
        <Dialog open={planesAbiertos} onOpenChange={setPlanesAbiertos}>
          <DialogContent className="rounded-lg border-borde sm:max-w-[560px]">
            <DialogTitle className="titulo-m text-texto">{T.planesTitulo}</DialogTitle>
            <DialogDescription className="cuerpo-s text-texto-suave">
              {T.banner(plan.diasRestantes ?? 0, esPrueba)} {T.bannerDetalle}
            </DialogDescription>
            <OpcionesDePago opcion={renovar} />
          </DialogContent>
        </Dialog>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="plan-vencido-titulo"
      className="space-y-4 rounded-lg border border-flojo bg-superficie-tarjeta p-5"
    >
      <div className="space-y-1">
        <h2 id="plan-vencido-titulo" className="titulo-m text-texto">
          {esPrueba ? T.tituloPrueba : T.tituloPlan}
        </h2>
        {plan.venceEl && <p className="cuerpo-s text-texto-suave">{T.detalle(fechaCorta(plan.venceEl))}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Lista titulo={T.podes} items={T.puede} icono="si" />
        <Lista titulo={T.noPodes} items={T.noPuede} icono="no" />
      </div>
      <OpcionesDePago opcion={renovar} />
    </section>
  )
}

function Lista({ titulo, items, icono }: { titulo: string; items: readonly string[]; icono: 'si' | 'no' }) {
  const Icono = icono === 'si' ? Check : Lock
  return (
    <div>
      <p className="etiqueta mb-2 text-texto-suave">{titulo}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 cuerpo-s text-texto">
            <Icono
              className={`mt-0.5 h-4 w-4 shrink-0 ${icono === 'si' ? 'text-logrado' : 'text-texto-suave'}`}
              aria-hidden="true"
              strokeWidth={TRAZO_ICONO}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
