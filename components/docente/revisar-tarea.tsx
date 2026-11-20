'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CargaFallida } from '@/components/carga-fallida'
import { Cargando } from '@/components/sistema/cargando'
import { TeacherQuizReview } from '@/components/teacher-quiz-review'
import { pedirJson } from '@/lib/pedir-json'
import { rutaDeRevision, tareaDesdeFila } from '@/lib/tarea-docente'
import { REVISAR_TAREA as T } from '@/lib/textos'
import type { TeacherQuiz } from '@/lib/types'

/**
 * L1: la revisión de una tarea en su propia pantalla, para llegar desde la
 * ficha de un alumno. Es el mismo TeacherQuizReview de *Mis tareas*, sin
 * duplicarlo: edita en el lugar y, si alguien ya respondió, guarda una copia y
 * mueve las asignaciones (las preguntas ya contestadas no cambian por debajo).
 * Cerrar vuelve a donde se estaba.
 */
export function RevisarTarea({ quizId, volver }: { quizId: number; volver: string }) {
  const router = useRouter()
  const [tarea, setTarea] = useState<TeacherQuiz | null>(null)
  const [error, setError] = useState<string | null>(null)

  const leer = useCallback(async () => {
    setError(null)
    const respuesta = await pedirJson<{ quiz: Record<string, unknown> }>(`/api/teacher/quizzes/${quizId}`)
    if ('error' in respuesta) setError(respuesta.error)
    else setTarea(tareaDesdeFila(respuesta.data.quiz))
  }, [quizId])

  useEffect(() => {
    void leer()
  }, [leer])

  if (error) {
    return (
      <div className="rounded-lg border border-borde bg-superficie-tarjeta">
        <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
      </div>
    )
  }

  if (!tarea) {
    return (
      <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
        <Cargando /> {T.cargando}
      </p>
    )
  }

  return (
    <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <TeacherQuizReview
        quiz={tarea}
        onClose={() => router.push(volver)}
        onSaved={(guardado, info) => {
          setTarea(guardado)
          // Si se guardó como copia, la URL pasa a la copia: recargar no vuelve al original congelado.
          if (info.copiado) window.history.replaceState(null, '', rutaDeRevision(guardado.id, volver))
        }}
      />
    </section>
  )
}
