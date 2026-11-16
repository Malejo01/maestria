'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import type { ResumenDelPlan } from '@/lib/planes'
import { pedirJson } from '@/lib/pedir-json'
import { PLAN } from '@/lib/textos'

const T = PLAN.avisoDePrueba

/** Si corresponde mostrar el aviso: prueba sin arrancar. Nunca a la cuenta exenta. */
export function debeMostrarAvisoDePrueba(plan: ResumenDelPlan | null | undefined): boolean {
  return Boolean(plan && plan.estado !== 'exento' && plan.avisoDePruebaPendiente)
}

interface Props {
  plan: ResumenDelPlan | null | undefined
  /** Después de arrancar la prueba: relee el plan. */
  onArranco: () => void
}

/**
 * G2: el aviso que ven los docentes la primera vez que entran después del
 * rediseño (y los nuevos, en su primer panel). Dice qué cambió y que la
 * prueba de 30 días empieza hoy.
 *
 * Se muestra una sola vez: cerrarlo, de cualquier forma, es aceptarlo. La
 * prueba arranca en el servidor (POST /api/teacher/plan), que no la vuelve a
 * arrancar si ya arrancó; a partir de ahí `avisoDePruebaPendiente` es false y
 * esto no se dibuja más.
 */
export function AvisoDePrueba({ plan, onArranco }: Props) {
  const [cerrado, setCerrado] = useState(false)
  const [mandando, setMandando] = useState(false)

  if (cerrado || !debeMostrarAvisoDePrueba(plan)) return null

  const aceptar = async () => {
    if (mandando) return
    setMandando(true)
    await pedirJson('/api/teacher/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'empezar-prueba' }),
    })
    // Aunque el POST falle, el aviso no vuelve en esta visita: insistir con un
    // diálogo que no se puede cerrar es peor que mostrarlo de nuevo mañana.
    setCerrado(true)
    setMandando(false)
    onArranco()
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && void aceptar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.queIncluye}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="cuerpo-s font-bold text-texto">{T.queHayDeNuevo}</p>
          <ul className="space-y-2">
            {T.novedades.map((novedad) => (
              <li key={novedad} className="flex gap-2 cuerpo-s text-texto">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accion" aria-hidden="true" strokeWidth={1.75} />
                <span>{novedad}</span>
              </li>
            ))}
          </ul>
        </div>
        <Boton ancho onClick={() => void aceptar()} disabled={mandando}>
          {T.boton}
        </Boton>
      </DialogContent>
    </Dialog>
  )
}
