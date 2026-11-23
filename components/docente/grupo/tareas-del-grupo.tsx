'use client'

import type { TeacherQuiz } from '@/lib/types'
import { tareaDesdeFila } from '@/lib/tarea-docente'
import { exportarParaMoodle } from '@/lib/moodle-xml'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Trash2, Users } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { formatDateTime, formatScore } from '@/components/classroom-report-parts'
import { tamanoDeTarea } from '@/lib/diagnostico'
import { pedirJson } from '@/lib/pedir-json'
import { ASIGNACIONES_INDIVIDUALES, DUPLICAR_TAREA, PAGINA_DEL_GRUPO } from '@/lib/textos'
import type { TareaDelInforme } from './use-informe-del-grupo'
import { PlanillaDeTarea } from './planilla-de-tarea'

const T = PAGINA_DEL_GRUPO.tareas

/**
 * M3: la pestaña Tareas. Lo mandado al grupo, con su estado y cuántos lo
 * hicieron. M4: cada tarea abre su planilla (quién la hizo), con `?tarea=ID`
 * en la URL.
 */
export function TareasDelGrupo({
  grupoId,
  tareas,
  alCambiar,
}: {
  grupoId: number
  tareas: TareaDelInforme[]
  alCambiar: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  // W2: la copia que se está mandando a otro grupo.
  const [copia, setCopia] = useState<TeacherQuiz | null>(null)

  async function duplicar(tarea: TareaDelInforme) {
    if (!tarea.teacherQuizId) return
    setOcupada(tarea.id)
    const res = await pedirJson<{ quiz: Record<string, unknown> }>(`/api/teacher/quizzes/${tarea.teacherQuizId}/duplicar`, { method: 'POST' })
    setOcupada(null)
    if ('error' in res) {
      setError(DUPLICAR_TAREA.noSePudo)
      return
    }
    setCopia(tareaDesdeFila(res.data.quiz))
  }
  const delGrupo = tareas.filter((t) => !t.individual)
  const router = useRouter()
  const ruta = usePathname()
  const consulta = useSearchParams()
  const abierta = Number(consulta?.get('tarea') ?? 0)
  const tareaAbierta = delGrupo.find((t) => t.id === abierta) ?? null
  const planillaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (tareaAbierta) planillaRef.current?.scrollIntoView({ block: 'nearest' })
  }, [tareaAbierta])

  function verQuienes(id: number | null) {
    const params = new URLSearchParams(consulta?.toString() ?? '')
    if (id) params.set('tarea', String(id))
    else params.delete('tarea')
    for (const clave of [...params.keys()]) if (clave.startsWith('t-')) params.delete(clave)
    const texto = params.toString()
    router.replace(`${ruta}${texto ? `?${texto}` : ''}`, { scroll: false })
  }
  const individuales = tareas.filter((t) => t.individual)

  async function quitar(tarea: TareaDelInforme) {
    setOcupada(tarea.id)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupoId}/assignments/${tarea.id}`, { method: 'DELETE' })
    setOcupada(null)
    setError('error' in respuesta ? respuesta.error : null)
    alCambiar()
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <h2 className="cuerpo font-bold text-texto">{T.titulo}</h2>
      {error && (
        <p className="nota text-flojo" role="alert">
          {error}
        </p>
      )}
      {delGrupo.length === 0 && <p className="cuerpo-s text-texto-suave">{T.vacio}</p>}

      <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {delGrupo.map((tarea) => (
          <li key={tarea.id} className="flex flex-col gap-2 self-start rounded-md border border-borde p-3">
            <div>
              <p className="cuerpo-s break-words font-semibold text-texto">{tarea.title}</p>
              <p className="nota text-texto-suave">{tamanoDeTarea(tarea.questionCount)}</p>
            </div>
            <p className="flex flex-wrap gap-2">
              <span className="nota rounded-sm bg-superficie-suave px-2 py-0.5 text-texto">{T.entregaron(tarea.submittedCount)}</span>
              {tarea.pendingCount > 0 && (
                <span className="nota rounded-sm border border-flojo bg-flojo-fondo px-2 py-0.5 text-flojo">
                  {T.pendientes(tarea.pendingCount)}
                </span>
              )}
            </p>
            <ul className="nota flex flex-col gap-0.5 text-texto-suave">
              <li>{T.promedio(formatScore(tarea.averageScore))}</li>
              <li>{T.desde(formatDateTime(tarea.opensAt))}</li>
              <li>{T.hasta(formatDateTime(tarea.dueAt))}</li>
              <li>{T.intentos(tarea.maxAttempts, tarea.attemptCount)}</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante={tareaAbierta?.id === tarea.id ? 'principal' : 'secundario'}
                aria-expanded={tareaAbierta?.id === tarea.id}
                onClick={() => verQuienes(tareaAbierta?.id === tarea.id ? null : tarea.id)}
              >
                <Users aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {tareaAbierta?.id === tarea.id ? T.ocultarQuienes : T.verQuienes}
              </Boton>
              {tarea.teacherQuizId && (
                <Boton variante="secundario" disabled={ocupada === tarea.id} onClick={() => void duplicar(tarea)}>
                  {DUPLICAR_TAREA.botonGrupo}
                </Boton>
              )}
              <Boton variante="secundario" disabled={ocupada === tarea.id} onClick={() => void quitar(tarea)}>
                <Trash2 aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {T.quitar}
              </Boton>
            </div>
          </li>
        ))}
      </ul>

      {tareaAbierta && (
        <div ref={planillaRef} className="border-t border-borde pt-4">
          <PlanillaDeTarea key={tareaAbierta.id} grupoId={grupoId} tareaId={tareaAbierta.id} titulo={tareaAbierta.title} />
        </div>
      )}

      {/* L0: lo armado para un solo alumno va aparte y no cuenta para el grupo. */}
      {individuales.length > 0 && (
        <div className="flex flex-col gap-2 pt-2">
          <h3 className="cuerpo-s font-semibold text-texto">{ASIGNACIONES_INDIVIDUALES.titulo}</h3>
          <p className="nota text-texto-suave">{ASIGNACIONES_INDIVIDUALES.detalle}</p>
          <ul className="flex flex-col rounded-md border border-borde">
            {individuales.map((tarea) => (
              <li
                key={tarea.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde p-3 text-sm last:border-b-0"
              >
                <span className="min-w-0 break-words text-texto">
                  {tarea.title}
                  <span className="nota block text-texto-suave">
                    {ASIGNACIONES_INDIVIDUALES.para(tarea.destinatario ?? ASIGNACIONES_INDIVIDUALES.sinNombre)}
                  </span>
                </span>
                <span className="nota text-texto-suave">
                  {tarea.submittedCount > 0 ? ASIGNACIONES_INDIVIDUALES.entregado : ASIGNACIONES_INDIVIDUALES.pendiente}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ShareQuizDialog
        open={copia !== null}
        onOpenChange={(abre) => {
          if (!abre) {
            setCopia(null)
            alCambiar()
          }
        }}
        quiz={copia}
        onExportMoodle={(formato) => copia && exportarParaMoodle(copia, formato)}
      />
    </section>
  )
}
