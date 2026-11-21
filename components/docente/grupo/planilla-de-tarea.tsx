'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Download } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { formatDateTime, formatScore } from '@/components/classroom-report-parts'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { NOTA_DE_APROBACION } from '@/lib/answer-grading'
import { pedirJson } from '@/lib/pedir-json'
import { cuantasPorFiltro, filasVisibles, type FilaDePlanilla } from '@/lib/planilla-grupo'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { BarraDePlanilla, CLASES_DE_TABLA as C, EncabezadoOrdenable, useEstadoDePlanilla } from './controles-de-planilla'
import { descargarCsv } from './planilla-del-grupo'

const T = PAGINA_DEL_GRUPO.tareas.planilla
const TP = PAGINA_DEL_GRUPO.planilla

/** Una fila de GET /api/teacher/classrooms/[id]/assignments/[assignmentId]. */
export interface AlumnoEnTarea {
  memberId: number
  userId: string
  nombre: string
  verificado: boolean
  intentos: number
  mejor: number | null
  promedio: number | null
  ultimo: string | null
}

type FilaDeTarea = FilaDePlanilla & { alumno: AlumnoEnTarea }

/**
 * Para la tarea, "Promedio" y "Debajo de 6" miran la MEJOR nota: es la que
 * cuenta para el docente (la misma que usa el promedio del curso de la tarjeta).
 */
export function filasDeTarea(alumnos: AlumnoEnTarea[]): FilaDeTarea[] {
  return alumnos.map((alumno) => ({
    nombre: alumno.nombre,
    resueltos: alumno.intentos,
    promedio: alumno.mejor,
    mejor: alumno.mejor,
    ultimaActividad: alumno.ultimo,
    temasFlojos: 0,
    alumno,
  }))
}

const notaCsv = (nota: number | null) => (nota === null ? '' : nota.toFixed(1).replace('.', ','))

/**
 * M4: la planilla de UNA tarea —quién la hizo, cuántas veces, con qué nota—,
 * con el mismo orden, búsqueda y filtros que la del grupo. Su estado va en la
 * URL con el prefijo `t-`, para no pisar el de la planilla del grupo.
 */
export function PlanillaDeTarea({ grupoId, tareaId, titulo }: { grupoId: number; tareaId: number; titulo: string }) {
  const [alumnos, setAlumnos] = useState<AlumnoEnTarea[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { estado, cambiar } = useEstadoDePlanilla('t-')

  const [vuelta, setVuelta] = useState(0)
  const leer = useCallback(() => setVuelta((n) => n + 1), [])

  useEffect(() => {
    let vigente = true
    void pedirJson<{ alumnos: AlumnoEnTarea[] }>(`/api/teacher/classrooms/${grupoId}/assignments/${tareaId}`).then((respuesta) => {
      if (!vigente) return
      if ('error' in respuesta) setError(respuesta.error)
      else {
        setError(null)
        setAlumnos(respuesta.data.alumnos ?? [])
      }
    })
    return () => {
      vigente = false
    }
  }, [grupoId, tareaId, vuelta])

  const todas = useMemo(() => filasDeTarea(alumnos ?? []), [alumnos])
  const visibles = useMemo(() => filasVisibles(todas, estado), [todas, estado])
  const cuantas = useMemo(() => cuantasPorFiltro(todas), [todas])

  if (error && !alumnos) return <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
  if (!alumnos) {
    return (
      <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
        <Cargando /> {T.cargando}
      </p>
    )
  }

  function descargar() {
    const seguro = titulo.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    descargarCsv(`tarea-${seguro}.csv`, [
      [...T.columnas],
      ...visibles.map(({ alumno }) => [
        alumno.nombre,
        String(alumno.intentos),
        notaCsv(alumno.mejor),
        notaCsv(alumno.promedio),
        alumno.ultimo ? formatDateTime(alumno.ultimo) : '',
      ]),
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="cuerpo-s font-bold text-texto">{T.titulo(titulo)}</h3>
        <Boton variante="secundario" disabled={visibles.length === 0} onClick={descargar}>
          <Download aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {T.descargar}
        </Boton>
      </div>
      {alumnos.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <>
          <BarraDePlanilla
            estado={estado}
            onCambiar={cambiar}
            filtros={[
              { id: 'todos', etiqueta: T.filtros.todos(cuantas.todos) },
              { id: 'nada', etiqueta: T.filtros.nada(cuantas.nada) },
              { id: 'debajo', etiqueta: T.filtros.debajo(NOTA_DE_APROBACION, cuantas.debajo) },
            ]}
          />
          <p className="nota text-texto-suave" aria-live="polite">
            {TP.mostrando(visibles.length, todas.length)}
          </p>
          <div className={C.contenedor}>
            <table className={cn(C.tabla, 'min-w-[520px]')}>
              <caption className="sr-only">{T.titulo(titulo)}</caption>
              <thead>
                <tr>
                  <EncabezadoOrdenable columna="alumno" etiqueta={T.alumno} estado={estado} onCambiar={cambiar} className={C.esquina} />
                  <EncabezadoOrdenable columna="resueltos" etiqueta={T.intentos} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="mejor" etiqueta={T.nota} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="actividad" etiqueta={T.ultima} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className={cn(C.celda, 'cuerpo-s text-texto-suave')}>
                      {TP.ningunoCoincide}
                    </td>
                  </tr>
                )}
                {visibles.map(({ alumno }) => (
                  <tr key={alumno.memberId}>
                    <th scope="row" className={cn(C.celda, C.primeraCelda, 'text-left font-medium text-texto')}>
                      <span className="flex items-center gap-1.5">
                        {alumno.nombre}
                        {alumno.verificado && <BadgeCheck className="size-4 shrink-0 text-logrado" aria-label={TP.verificada} />}
                      </span>
                    </th>
                    <td className={cn(C.celda, 'tabular-nums')}>{alumno.intentos}</td>
                    <td className={cn(C.celda, 'font-semibold tabular-nums')}>{formatScore(alumno.mejor)}</td>
                    <td className={cn(C.celda, 'whitespace-nowrap text-texto-suave')}>{formatDateTime(alumno.ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
