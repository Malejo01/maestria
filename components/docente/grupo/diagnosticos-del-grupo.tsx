'use client'

import { useCallback, useEffect, useState } from 'react'
import { AccionesDeCuestionario } from '@/components/docente/acciones-de-cuestionario'
import { pedirJson } from '@/lib/pedir-json'
import { MIS_GRUPOS, PAGINA_DEL_GRUPO } from '@/lib/textos'
import type { DiagnosticoDelGrupo } from '@/lib/diagnostico-grupo-server'
import type { ProgramUnit } from '@/lib/types'

const T = MIS_GRUPOS.seguimiento

export interface DatosDeDiagnosticos {
  disponible: boolean
  grupo?: { classroomId: number; materiaId: number; materia: string; unidades: ProgramUnit[] }
  diagnosticos?: DiagnosticoDelGrupo[]
}

/** L4: los diagnósticos y prácticas del grupo, y lo que hace falta para armar otro. */
export function useDiagnosticosDelGrupo(grupoId: number) {
  const [datos, setDatos] = useState<DatosDeDiagnosticos | null>(null)
  const leer = useCallback(async () => {
    const respuesta = await pedirJson<DatosDeDiagnosticos>(`/api/teacher/grupos/${grupoId}/diagnosticos`)
    setDatos('error' in respuesta ? { disponible: false } : respuesta.data)
  }, [grupoId])
  useEffect(() => {
    void leer()
  }, [leer])
  return { datos, leer }
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })

/** M3: la pestaña Diagnósticos (lo de L4, que antes vivía plegado en la tarjeta). */
export function DiagnosticosDelGrupo({ grupoId, diagnosticos }: { grupoId: number; diagnosticos: DiagnosticoDelGrupo[] }) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      {diagnosticos.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{PAGINA_DEL_GRUPO.diagnosticos.vacio}</p>
      ) : (
        diagnosticos.map((d) => <SeguimientoDeDiagnostico key={d.id} diagnostico={d} grupoId={grupoId} />)
      )}
    </section>
  )
}

/** L4: por cuestionario, cuántos lo hicieron; por tema, cuántos lo acertaron. */
function SeguimientoDeDiagnostico({ diagnostico: d, grupoId }: { diagnostico: DiagnosticoDelGrupo; grupoId: number }) {
  return (
    <article className="flex flex-col gap-3">
      <p className="nota font-semibold text-texto-suave">{T.armado(fechaCorta(d.creadoEl), d.modo)}</p>
      <ul className="flex flex-col">
        {d.cuestionarios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde py-2 last:border-b-0">
            <span className="min-w-0 flex-1 basis-48">
              <span className="cuerpo-s block text-texto">{c.titulo}</span>
              <span className="nota block text-texto-suave">{T.hicieron(c.preguntas, c.hicieron, c.total)}</span>
            </span>
            <AccionesDeCuestionario
              quizId={c.id}
              titulo={c.titulo}
              consulta={`grupo=${grupoId}`}
              acciones={['revisar', 'verComoAlumno', 'hacerlo', 'imprimir']}
            />
          </li>
        ))}
      </ul>
      {d.temas.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.sinRespuestas}</p>
      ) : (
        <div>
          <h3 className="cuerpo-s font-bold text-texto">{T.porTema}</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {d.temas.map((t) => {
              const porcentaje = t.rindieron > 0 ? Math.round((t.acertaron / t.rindieron) * 100) : 0
              return (
                <li key={t.temaId}>
                  <p className="cuerpo-s text-texto">{T.tema(t.nombre, t.acertaron, t.rindieron)}</p>
                  <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-superficie-base">
                    <div className="h-full rounded-full bg-accion" style={{ width: `${porcentaje}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </article>
  )
}
