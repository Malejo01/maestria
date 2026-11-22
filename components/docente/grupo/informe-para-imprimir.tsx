'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { formatScore } from '@/components/classroom-report-parts'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { descripcionDelEstado, tareasParaImprimir, temasParaImprimir } from '@/lib/informe-para-imprimir'
import { filasVisibles } from '@/lib/planilla-grupo'
import { INFORME_IMPRESO as T } from '@/lib/textos'
import { useEstadoDePlanilla } from './controles-de-planilla'
import { filasDelCsv, filasDelGrupo } from './planilla-del-grupo'
import { useInformeDelGrupo } from './use-informe-del-grupo'

/**
 * O9: el informe del grupo para imprimir (FASE 4). La planilla con el orden y
 * el filtro que el docente dejó en la página del grupo (vienen en la URL), los
 * temas flojos y las tareas con cuántos las hicieron. Como la hoja del
 * diagnóstico (J7): nada de PDF en el servidor; el navegador imprime a PDF
 * solo y `print:` saca lo que no va al papel.
 */
export function InformeParaImprimir({ grupoId, nombre, materia }: { grupoId: number; nombre: string; materia: string }) {
  const { informe, error, leer } = useInformeDelGrupo(grupoId)
  const { estado } = useEstadoDePlanilla()

  const planilla = useMemo(() => {
    if (!informe) return null
    const visibles = filasVisibles(filasDelGrupo(informe.students), estado).map((f) => f.alumno)
    return filasDelCsv(visibles)
  }, [informe, estado])

  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  const filtro = descripcionDelEstado(estado)

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/teacher/grupos/${grupoId}`} className="nota inline-flex items-center gap-1 text-texto-suave hover:text-texto">
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} /> {T.volver}
        </Link>
        <Boton disabled={!informe} onClick={() => window.print()}>
          <Printer aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {T.imprimir}
        </Boton>
      </div>
      <p className="nota mb-6 text-texto-suave print:hidden">{T.ayuda}</p>

      {error && !informe ? (
        <CargaFallida que={T.queCargamos} detalle={error} onReintentar={() => void leer()} />
      ) : !informe || !planilla ? (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando /> {T.cargando}
        </p>
      ) : (
        <article className="hoja-impresa flex flex-col gap-6 text-texto">
          <header>
            <p className="nota text-texto-suave">{materia}</p>
            <h1 className="titulo-l">{T.titulo(nombre)}</h1>
            <p className="nota mt-1 text-texto-suave">
              {T.fecha(hoy)}
              {informe.summary &&
                ` · ${T.resumen(informe.summary.studentCount, formatScore(informe.summary.groupAverage), informe.summary.totalAttempts)}`}
            </p>
          </header>

          <section className="flex flex-col gap-2">
            <h2 className="titulo-m">{T.planilla}</h2>
            {filtro && <p className="nota text-texto-suave">{filtro}</p>}
            {planilla.length <= 1 ? (
              <p className="cuerpo-s text-texto-suave">{T.sinAlumnos}</p>
            ) : (
              <Tabla filas={planilla} />
            )}
          </section>

          <section className="flex flex-col gap-2 break-inside-avoid">
            <h2 className="titulo-m">{T.temas}</h2>
            {informe.topics.length === 0 ? (
              <p className="cuerpo-s text-texto-suave">{T.sinTemas}</p>
            ) : (
              <Tabla filas={[[...T.temasColumnas], ...temasParaImprimir(informe.topics)]} />
            )}
          </section>

          <section className="flex flex-col gap-2 break-inside-avoid">
            <h2 className="titulo-m">{T.tareas}</h2>
            {tareasParaImprimir(informe.assignments, informe.summary?.studentCount ?? informe.students.length).length === 0 ? (
              <p className="cuerpo-s text-texto-suave">{T.sinTareas}</p>
            ) : (
              <Tabla
                filas={[[...T.tareasColumnas], ...tareasParaImprimir(informe.assignments, informe.summary?.studentCount ?? informe.students.length)]}
              />
            )}
          </section>
        </article>
      )}
    </div>
  )
}

/** Una tabla para papel: la primera fila es el encabezado; las filas no se parten entre páginas. */
function Tabla({ filas }: { filas: string[][] }) {
  const [encabezado, ...cuerpo] = filas
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="nota w-full border-collapse text-left">
        <thead>
          <tr>
            {encabezado.map((c) => (
              <th key={c} scope="col" className="border-b-2 border-texto px-2 py-1 font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cuerpo.map((fila, i) => (
            <tr key={i} className="break-inside-avoid border-b border-borde">
              {fila.map((c, j) => (
                <td key={j} className="px-2 py-1 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
