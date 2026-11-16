'use client'

import { ArrowRight, FileText, Landmark, PenLine, type LucideIcon } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { CAMINOS_TEMARIO } from '@/lib/textos'

export type SubjectPath = 'import' | 'curriculum' | 'manual'

interface TeacherOnboardingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectPath: (path: SubjectPath) => void
}

/**
 * Los tres caminos para armar un temario, en una sola pantalla comparable.
 *
 * Antes este diálogo era el onboarding entero del docente: se abría solo en la
 * primera visita, tenía una pantalla de bienvenida en prosa, y al cerrarse
 * dejaba al docente frente a un panel vacío. Ahora el onboarding es la tarjeta
 * de hitos (components/docente/hitos-onboarding.tsx), que no termina hasta que
 * hay un alumno con una tarea, y este diálogo es sólo el primer paso de esa
 * tarjeta: lo abre el docente cuando decide crear su materia. Por eso perdió
 * la pantalla de bienvenida y ya no se abre solo.
 *
 * Cada camino dice qué pasa REALMENTE después de elegirlo. No se promete nada
 * que el wizard no haga.
 */
const CAMINOS: { id: SubjectPath; icono: LucideIcon }[] = [
  { id: 'import', icono: FileText },
  { id: 'curriculum', icono: Landmark },
  { id: 'manual', icono: PenLine },
]

export function TeacherOnboardingModal({ open, onOpenChange, onSelectPath }: TeacherOnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-lg border-borde sm:max-w-[560px]">
        <DialogTitle className="titulo-m text-texto">{CAMINOS_TEMARIO.titulo}</DialogTitle>
        <DialogDescription className="cuerpo-s text-texto-suave">{CAMINOS_TEMARIO.detalle}</DialogDescription>

        <ul className="flex flex-col gap-3">
          {CAMINOS.map(({ id, icono: Icono }) => {
            const textos = CAMINOS_TEMARIO[id]
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSelectPath(id)}
                  className="flex w-full items-start gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 text-left transition-colors hover:border-borde-fuerte"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-md bg-superficie-suave text-accion"
                  >
                    <Icono className="size-5" strokeWidth={TRAZO_ICONO} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="cuerpo block text-texto">{textos.titulo}</span>
                    <span className="cuerpo-s block text-texto-suave">{textos.para}</span>
                    <span className="nota mt-1 block text-texto-suave">{textos.despues}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-texto-suave" strokeWidth={TRAZO_ICONO} />
                </button>
              </li>
            )
          })}
        </ul>

        <div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cuerpo-s inline-flex min-h-11 items-center rounded-sm text-texto-suave hover:text-texto"
          >
            {CAMINOS_TEMARIO.masTarde}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
