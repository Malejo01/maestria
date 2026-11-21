'use client'

import { useEffect, useMemo, useState } from 'react'
import { Boton } from '@/components/sistema/boton'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import { useViewerId } from '@/hooks/use-viewer-id'
import { CUESTIONARIO_EMPEZADO } from '@/lib/textos'
import {
  almacenDelNavegador,
  armarBorrador,
  cargarBorrador,
  descartarBorrador,
  esPractica,
  evaluarBorrador,
  guardarBorrador,
  idDeBorrador,
  reconciliarBorrador,
  resumenDeBorrador,
  type Borrador,
} from '@/lib/borrador-cuestionario'
import type { Question } from '@/lib/types'

/**
 * M1 · El borrador local en el motor de cuestionarios. La lógica pura está en
 * lib/borrador-cuestionario.ts; acá, sólo dónde se lee y cuándo se escribe.
 */

/**
 * Escribe el borrador después de cada respuesta (y al pasar de pregunta, que
 * es cuando cambia el índice). Nunca en la vista previa del docente.
 */
export function useGuardarBorrador() {
  const viewerId = useViewerId()
  const currentQuiz = useAppStore((s) => s.currentQuiz)
  const activeView = useAppStore((s) => s.activeView)

  useEffect(() => {
    if (!viewerId || activeView !== 'quiz') return
    const { config, questions, answers, currentIndex, startedAt } = currentQuiz
    if (!config) return
    const borrador = armarBorrador({ config, questions, answers, currentIndex, startedAt }, { ahora: new Date() })
    if (borrador) guardarBorrador(almacenDelNavegador(), viewerId, borrador)
  }, [viewerId, activeView, currentQuiz])
}

/**
 * El borrador que corresponde ofrecer al abrir este cuestionario, si hay uno
 * que sirva. Sólo antes de la primera respuesta, y sólo para tareas y
 * cuestionarios del docente: la práctica libre se ofrece en /practicar, antes
 * de generar otra (ver `BorradorDePractica`). Uno que ya no sirve (viejo,
 * preguntas editadas, tarea vencida) se borra.
 */
export function useBorradorParaRetomar(): Borrador | null {
  const viewerId = useViewerId()
  const currentQuiz = useAppStore((s) => s.currentQuiz)
  const { config, questions, answers, currentIndex, startedAt } = currentQuiz
  const id = idDeBorrador(config)
  const recienEmpezado = currentIndex === 0 && answers.length === 0

  // Se lee del almacén al arrancar el cuestionario (cambia `startedAt`) o
  // cuando se sabe quién mira; no en cada render.
  const revision = useMemo(() => {
    if (!viewerId || !id || esPractica(id)) return null
    const guardado = cargarBorrador(almacenDelNavegador(), viewerId, id)
    if (!guardado) return null
    const evaluacion = evaluarBorrador(guardado, { ahora: new Date(), preguntasActuales: questions })
    return evaluacion.valido ? { borrador: guardado, descartar: false } : { borrador: null, descartar: true }
    // `startedAt` marca un arranque nuevo del mismo cuestionario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId, id, startedAt, questions])

  // Uno que ya no sirve (viejo, preguntas editadas, tarea vencida) se borra.
  useEffect(() => {
    if (revision?.descartar && viewerId && id) descartarBorrador(almacenDelNavegador(), viewerId, id)
  }, [revision, viewerId, id])

  // Si ya respondió algo (empezó de nuevo, o siguió), el aviso no va más.
  return recienEmpezado ? (revision?.borrador ?? null) : null
}

/** Pone el cuestionario donde quedó. Si ya había respondido todo, va directo al resultado. */
export function useRetomar() {
  const { retomarQuiz, finishQuiz, setActiveView } = useAppStore()
  return (borrador: Borrador, preguntasActuales?: Question[]) => {
    const { questions, answers, currentIndex, completo } = reconciliarBorrador(borrador, preguntasActuales)
    retomarQuiz({ config: borrador.config, questions, answers, currentIndex, startedAt: borrador.startedAt })
    if (completo) {
      finishQuiz()
      setActiveView('results')
    }
  }
}

/** Borra el borrador de este cuestionario (al empezar de nuevo). */
export function useDescartarBorrador() {
  const viewerId = useViewerId()
  return (borrador: Borrador) => {
    if (viewerId) descartarBorrador(almacenDelNavegador(), viewerId, borrador.id)
  }
}

/**
 * La pantalla "Tenés un cuestionario empezado: 12 de 20 respondidas", con
 * Seguir donde estaba y Empezar de nuevo (que pide confirmación).
 */
export function RetomarCuestionario({
  borrador,
  titulo,
  onSeguir,
  onEmpezarDeNuevo,
}: {
  borrador: Borrador
  /** Qué cuestionario es, si se sabe ("Práctica de Matemática"). */
  titulo?: string
  onSeguir: () => void
  onEmpezarDeNuevo: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const { respondidas, total } = resumenDeBorrador(borrador)
  const T = CUESTIONARIO_EMPEZADO

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-4 px-4" data-testid="retomar-cuestionario">
      <h1 className="titulo-l text-texto">{T.titulo}</h1>
      {titulo && <p className="cuerpo-s text-texto-suave">{titulo}</p>}
      <p className="titulo-m text-texto">{T.progreso(respondidas, total)}</p>
      <p className="cuerpo text-texto-suave">{T.detalle}</p>
      <div className="flex flex-col gap-2">
        <Boton onClick={onSeguir} className="h-14 text-base">
          {T.seguir}
        </Boton>
        <Boton variante="secundario" onClick={() => setConfirmando(true)} className="h-12">
          {T.empezarDeNuevo}
        </Boton>
      </div>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[420px]">
          <DialogTitle className="titulo-m text-texto">{T.confirmar.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.confirmar.detalle}</DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setConfirmando(false)}>
              {T.confirmar.no}
            </Boton>
            <Boton
              onClick={() => {
                setConfirmando(false)
                onEmpezarDeNuevo()
              }}
            >
              {T.confirmar.si}
            </Boton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * /practicar: la práctica libre a medio hacer se ofrece ANTES de generar otra
 * (sus preguntas las generó la IA para este alumno y sólo existen en el
 * borrador). Devuelve `null` si no hay ninguna que sirva.
 */
export function BorradorDePractica({ onDescartado }: { onDescartado?: () => void }) {
  const viewerId = useViewerId()
  const [cerrado, setCerrado] = useState(false)
  const retomar = useRetomar()

  const revision = useMemo(() => {
    if (!viewerId) return null
    const guardado = cargarBorrador(almacenDelNavegador(), viewerId, 'practica')
    if (!guardado) return null
    return evaluarBorrador(guardado, { ahora: new Date() }).valido
      ? { borrador: guardado, descartar: false }
      : { borrador: null, descartar: true }
  }, [viewerId])

  useEffect(() => {
    if (revision?.descartar && viewerId) descartarBorrador(almacenDelNavegador(), viewerId, 'practica')
  }, [revision, viewerId])

  const borrador = revision?.borrador
  if (!borrador || !viewerId || cerrado) return null

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-superficie-base">
      <RetomarCuestionario
        borrador={borrador}
        titulo={CUESTIONARIO_EMPEZADO.practica(borrador.config.subjectName || borrador.config.subject)}
        onSeguir={() => {
          setCerrado(true)
          retomar(borrador)
        }}
        onEmpezarDeNuevo={() => {
          descartarBorrador(almacenDelNavegador(), viewerId, 'practica')
          setCerrado(true)
          onDescartado?.()
        }}
      />
    </div>
  )
}
