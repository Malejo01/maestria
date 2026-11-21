'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Cargando } from '@/components/sistema/cargando'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import { tamanoDeTarea } from '@/lib/diagnostico'
import { exportQuizToMoodleGift } from '@/lib/moodle-export'
import { pedirJson } from '@/lib/pedir-json'
import { tareaDesdeFila } from '@/lib/tarea-docente'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import type { TeacherQuiz } from '@/lib/types'

const T = PAGINA_DEL_GRUPO.elegirTarea

/**
 * M3: "Mandar tarea" desde la página del grupo. Primero se elige una de las
 * tareas de la materia; después es el diálogo de siempre (fechas, intentos,
 * el mensaje para WhatsApp), con este grupo ya elegido.
 */
export function MandarTareaAlGrupo({
  abierto,
  onCambiar,
  grupoId,
  materiaId,
  alMandar,
}: {
  abierto: boolean
  onCambiar: (abierto: boolean) => void
  grupoId: number
  materiaId: number
  alMandar: () => void
}) {
  const [tareas, setTareas] = useState<TeacherQuiz[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegida, setElegida] = useState<TeacherQuiz | null>(null)

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    void pedirJson<{ quizzes: Record<string, unknown>[] }>(`/api/teacher/quizzes?programId=${materiaId}`).then((respuesta) => {
      if (!vigente) return
      if ('error' in respuesta) {
        setError(respuesta.error)
        setTareas([])
        return
      }
      setError(null)
      setTareas((respuesta.data.quizzes ?? []).map(tareaDesdeFila))
    })
    return () => {
      vigente = false
    }
  }, [abierto, materiaId])

  return (
    <>
      <Dialog open={abierto} onOpenChange={onCambiar}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[520px]">
          <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle}</DialogDescription>

          {tareas === null ? (
            <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
              <Cargando /> {T.cargando}
            </p>
          ) : tareas.length === 0 ? (
            <div className="flex flex-col gap-2">
              {error && (
                <p className="nota text-flojo" role="alert">
                  {error}
                </p>
              )}
              <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
              <Link href={`/teacher?seccion=tareas&armar=1&materia=${materiaId}`} className="cuerpo-s font-semibold text-accion underline">
                {T.armar}
              </Link>
            </div>
          ) : (
            <ul className="flex max-h-[50vh] flex-col overflow-y-auto rounded-md border border-borde">
              {tareas.map((tarea) => (
                <li key={tarea.id} className="border-b border-borde last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setElegida(tarea)
                      onCambiar(false)
                    }}
                    className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-left hover:bg-superficie-suave"
                  >
                    <span className="min-w-0">
                      <span className="cuerpo-s block break-words text-texto">{tarea.title}</span>
                      <span className="nota block text-texto-suave">{tamanoDeTarea(tarea.questionCount)}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-texto-suave" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ShareQuizDialog
        open={elegida !== null}
        onOpenChange={(abre) => {
          if (!abre) {
            setElegida(null)
            alMandar()
          }
        }}
        quiz={elegida}
        grupoInicial={grupoId}
        onExportMoodle={() => elegida && exportQuizToMoodleGift(elegida)}
      />
    </>
  )
}
