'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Boton } from '@/components/sistema/boton'
import { OpcionesDePago } from '@/components/docente/opciones-de-pago'
import { cupoDeNivel, type CuerpoDeBloqueo } from '@/lib/planes'
import { PLAN } from '@/lib/textos'

const T = PLAN.limite

/** Título y bajada de la pantalla según por qué se frenó. */
export function textosDelLimite(bloqueo: CuerpoDeBloqueo): { titulo: string; detalle: string } {
  const { plan } = bloqueo
  const siguiente = plan.siguiente

  if (plan.motivo === 'vencido' || (plan.motivo === 'sin_cupo' && plan.cupo === null)) {
    return { titulo: PLAN.vencimiento.tituloPlan, detalle: T.vencido(plan.cupoGratis) }
  }
  if (plan.motivo === 'tope_cuestionarios') {
    return {
      titulo: T.tituloCuestionarios(plan.cuestionarios ?? plan.topeCuestionarios, plan.topeCuestionarios),
      detalle: T.detalleCuestionarios(plan.topeCuestionarios, siguiente?.nivel ?? null),
    }
  }
  const titulo = T.titulo(plan.alumnos, plan.cupo ?? 0)
  if (!siguiente) return { titulo, detalle: T.sinNivel }
  if (plan.estado === 'gratis') {
    return { titulo, detalle: T.detalleGratis(plan.cupoGratis, siguiente.nivel, cupoDeNivel(siguiente.nivel)) }
  }
  return { titulo, detalle: T.detalle(siguiente.nivel) }
}

/**
 * G3, "al excederse": el docente intentó sumar un alumno por encima del cupo,
 * generar con el plan vencido o pasar el tope de cuestionarios del gratis
 * (H7). Cuántos tiene, cuál es su tope, cuánto cuesta lo siguiente —por mes y
 * el pase— y el botón al pago, si el link existe.
 */
export function PantallaDeLimite({ bloqueo, onVolver }: { bloqueo: CuerpoDeBloqueo; onVolver: () => void }) {
  const { plan } = bloqueo
  const { titulo, detalle } = textosDelLimite(bloqueo)
  const conBarra = plan.motivo === 'tope_cuestionarios' || (plan.motivo === 'sin_cupo' && plan.cupo !== null)

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <DialogTitle className="titulo-m text-texto">{titulo}</DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">{detalle}</DialogDescription>
      </div>

      {conBarra && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-superficie-suave" role="img" aria-label={titulo}>
          <div className="h-full w-full rounded-full bg-flojo" />
        </div>
      )}

      {plan.siguiente && <OpcionesDePago opcion={plan.siguiente} />}

      <Boton variante="secundario" onClick={onVolver}>
        {T.volver}
      </Boton>
    </div>
  )
}

/**
 * La pantalla de límite en su propio diálogo, para los caminos que no tienen
 * uno abierto: generar desde una materia, regenerar una pregunta.
 */
export function DialogoDeLimite({ bloqueo, onCerrar }: { bloqueo: CuerpoDeBloqueo | null; onCerrar: () => void }) {
  return (
    <Dialog open={bloqueo !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="rounded-lg border-borde sm:max-w-[560px]">
        {bloqueo && <PantallaDeLimite bloqueo={bloqueo} onVolver={onCerrar} />}
      </DialogContent>
    </Dialog>
  )
}
