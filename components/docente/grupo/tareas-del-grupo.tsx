'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { formatDateTime, formatScore } from '@/components/classroom-report-parts'
import { tamanoDeTarea } from '@/lib/diagnostico'
import { pedirJson } from '@/lib/pedir-json'
import { ASIGNACIONES_INDIVIDUALES, PAGINA_DEL_GRUPO } from '@/lib/textos'
import type { TareaDelInforme } from './use-informe-del-grupo'

const T = PAGINA_DEL_GRUPO.tareas

/** M3: la pestaña Tareas. Lo mandado al grupo, con su estado y cuántos lo hicieron. */
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
  const delGrupo = tareas.filter((t) => !t.individual)
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
            <Boton variante="secundario" disabled={ocupada === tarea.id} onClick={() => void quitar(tarea)}>
              <Trash2 aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              {T.quitar}
            </Boton>
          </li>
        ))}
      </ul>

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
    </section>
  )
}
