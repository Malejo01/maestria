'use client'

import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { OpcionesDePago } from '@/components/docente/opciones-de-pago'
import type { CuerpoDeBloqueo } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

const T = PLAN.limite

/**
 * G3, "al excederse": el docente intentó sumar un alumno por encima del cupo
 * (o con el plan vencido). Va adentro del diálogo de agregar alumno, en lugar
 * del formulario: cuántos tiene, cuál es su cupo, cuánto cuesta lo siguiente
 * —por mes y el pase— y el botón al pago.
 */
export function PantallaDeLimite({ bloqueo, onVolver }: { bloqueo: CuerpoDeBloqueo; onVolver: () => void }) {
  const { plan } = bloqueo
  const vencido = plan.motivo === 'vencido'
  const siguiente = plan.siguiente

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <DialogTitle className="titulo-m text-texto">
          {vencido || plan.cupo === null ? PLAN.vencimiento.tituloPlan : T.titulo(plan.alumnos, plan.cupo)}
        </DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">
          {vencido ? T.vencido : siguiente ? T.detalle(siguiente.nivel) : T.sinNivel}
        </DialogDescription>
      </div>

      {plan.cupo !== null && !vencido && (
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-superficie-suave"
          role="img"
          aria-label={T.titulo(plan.alumnos, plan.cupo)}
        >
          <div className="h-full w-full rounded-full bg-flojo" />
        </div>
      )}

      {siguiente && <OpcionesDePago opcion={siguiente} />}

      <Boton variante="secundario" onClick={onVolver}>
        {T.volver}
      </Boton>
    </div>
  )
}
