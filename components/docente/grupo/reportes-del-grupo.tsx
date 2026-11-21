'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquareWarning } from 'lucide-react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { numeroDePregunta } from '@/lib/reportes'
import type { ReporteParaLeer } from '@/lib/reportes-server'
import { rutaDeRevision } from '@/lib/tarea-docente'
import { REPORTES_DEL_GRUPO as T } from '@/lib/textos'

/**
 * M6: en la página del grupo, lo que reportaron sus alumnos en las tareas de
 * este docente (sin resolver): el texto del reporte y la pregunta, con el link
 * para revisarla. No dice quién reportó. Sin reportes (o sin la 029), nada.
 */
export function ReportesDelGrupo({ grupoId }: { grupoId: number }) {
  const [reportes, setReportes] = useState<ReporteParaLeer[]>([])

  useEffect(() => {
    let vigente = true
    void pedirJson<{ reportes: ReporteParaLeer[] }>(`/api/teacher/grupos/${grupoId}/reportes`).then((respuesta) => {
      if (vigente && !('error' in respuesta)) setReportes(respuesta.data.reportes ?? [])
    })
    return () => {
      vigente = false
    }
  }, [grupoId])

  if (reportes.length === 0) return null

  return (
    <section
      aria-label={T.titulo(reportes.length)}
      className="flex flex-col gap-3 rounded-lg border border-flojo bg-flojo-fondo p-4"
    >
      <h2 className="cuerpo-s flex items-center gap-2 font-bold text-texto">
        <MessageSquareWarning aria-hidden="true" className="size-5 shrink-0 text-flojo" strokeWidth={TRAZO_ICONO} />
        {T.titulo(reportes.length)}
      </h2>
      <ul className="flex flex-col gap-3">
        {reportes.map((r) => {
          const numero = numeroDePregunta(r.dondeQuedo.preguntaIndice)
          return (
            <li key={r.id} className="flex flex-col gap-1 rounded-md border border-borde bg-superficie-tarjeta p-3">
              <p className="cuerpo-s whitespace-pre-wrap break-words text-texto">«{r.texto}»</p>
              {r.dondeQuedo.cuestionario && numero !== null && (
                <p className="nota font-semibold text-texto-suave">{T.pregunta(numero, r.dondeQuedo.cuestionario)}</p>
              )}
              {r.pregunta && <LaTeXRenderer content={r.pregunta.question} className="nota text-texto-suave" />}
              {r.dondeQuedo.cuestionarioId !== null && (
                <Link
                  href={rutaDeRevision(r.dondeQuedo.cuestionarioId, `/teacher/grupos/${grupoId}`)}
                  className="nota self-start font-semibold text-accion underline underline-offset-2"
                >
                  {T.revisar}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
