'use client'

import { useMemo, useState } from 'react'
import { BadgeCheck, Download, UserMinus } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ClassroomStudentDialog } from '@/components/classroom-student-dialog'
import { formatDateTime, formatPercent, formatScore } from '@/components/classroom-report-parts'
import { pedirJson } from '@/lib/pedir-json'
import { NOTA_DE_APROBACION } from '@/lib/answer-grading'
import { cuantasPorFiltro, filasVisibles, type FilaDePlanilla } from '@/lib/planilla-grupo'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import { TraerAlumnos } from '@/components/docente/grupo/traer-alumnos'
import { cn } from '@/lib/utils'
import { BarraDePlanilla, CLASES_DE_TABLA as C, EncabezadoOrdenable, useEstadoDePlanilla } from './controles-de-planilla'
import type { AlumnoDelInforme } from './use-informe-del-grupo'

const T = PAGINA_DEL_GRUPO.planilla

/**
 * Excel en es-AR separa con punto y coma, y sin BOM rompe las tildes: las dos
 * cosas importan porque el archivo va derecho a una planilla de notas.
 */
export function descargarCsv(nombreDeArchivo: string, filas: string[][]) {
  const escapar = (valor: string) => `"${String(valor).replace(/"/g, '""')}"`
  const contenido = '﻿' + filas.map((fila) => fila.map(escapar).join(';')).join('\r\n')
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreDeArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}

const notaCsv = (nota: number | null) => (nota === null ? '' : nota.toFixed(1).replace('.', ','))

/** Las filas del CSV, en el orden en que se ven. */
export function filasDelCsv(alumnos: AlumnoDelInforme[]): string[][] {
  return [
    [...T.columnas],
    ...alumnos.map((alumno) => [
      alumno.displayName,
      alumno.isVerified ? T.si : T.no,
      String(alumno.attemptCount),
      notaCsv(alumno.averageScore),
      notaCsv(alumno.bestScore),
      String(alumno.passedCount),
      alumno.lastAttemptAt ? formatDateTime(alumno.lastAttemptAt) : '',
      alumno.weakTopics.map((tema) => `${tema.topicName} (${formatPercent(tema.accuracy)})`).join(' | '),
    ]),
  ]
}

export interface OtroGrupo {
  id: number
  name: string
  member_count: number
}

/** Una fila de la planilla: lo que ordena y filtra lib/planilla-grupo.ts, más el alumno. */
type FilaDelGrupo = FilaDePlanilla & { alumno: AlumnoDelInforme }

const aNumero = (valor: number | string | null) => (valor === null || valor === undefined ? null : Number(valor))

export function filasDelGrupo(alumnos: AlumnoDelInforme[]): FilaDelGrupo[] {
  return alumnos.map((alumno) => ({
    nombre: alumno.displayName,
    resueltos: Number(alumno.attemptCount),
    promedio: aNumero(alumno.averageScore),
    mejor: aNumero(alumno.bestScore),
    ultimaActividad: alumno.lastAttemptAt,
    temasFlojos: alumno.weakTopics.length,
    alumno,
  }))
}

/**
 * M3: la pestaña Alumnos de la página del grupo. Tocar el nombre abre todo lo
 * que hizo el alumno; se puede quitar a uno, sumar los de otro grupo y bajar
 * las notas.
 *
 * M4: ordenable tocando el encabezado (segundo toque invierte, `aria-sort` y
 * la flecha), con búsqueda por nombre sin tildes ni mayúsculas y los filtros
 * rápidos. Todo en la URL, y el CSV baja exactamente lo que se ve. La lógica
 * está en lib/planilla-grupo.ts.
 */
export function PlanillaDelGrupo({
  grupoId,
  nombreDelGrupo,
  codigo,
  alumnos,
  otrosGrupos,
  alCambiar,
}: {
  grupoId: number
  nombreDelGrupo: string
  codigo: string
  alumnos: AlumnoDelInforme[]
  otrosGrupos: OtroGrupo[]
  alCambiar: () => void
}) {
  const [abierto, setAbierto] = useState<AlumnoDelInforme | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const { estado, cambiar } = useEstadoDePlanilla()
  const todas = useMemo(() => filasDelGrupo(alumnos), [alumnos])
  const visibles = useMemo(() => filasVisibles(todas, estado), [todas, estado])
  const cuantas = useMemo(() => cuantasPorFiltro(todas), [todas])
  const yaEstan = useMemo(() => new Set(alumnos.map((a) => a.userId)), [alumnos])

  async function quitar(alumno: AlumnoDelInforme) {
    setOcupado(true)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupoId}/members/${alumno.memberId}`, { method: 'DELETE' })
    setOcupado(false)
    setAviso('error' in respuesta ? respuesta.error : null)
    alCambiar()
  }

  function descargar() {
    const seguro = nombreDelGrupo.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    // Lo que se ve, en el orden en que se ve (M4).
    descargarCsv(`notas-${seguro}.csv`, filasDelCsv(visibles.map((f) => f.alumno)))
    setAviso(T.descargadas)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="cuerpo font-bold text-texto">{T.titulo}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* O7: elegir a quiénes traer, con casillas y confirmación. */}
          <TraerAlumnos
            grupoId={grupoId}
            nombreDelGrupo={nombreDelGrupo}
            otrosGrupos={otrosGrupos}
            yaEstan={yaEstan}
            alTraer={(r) => {
              setAviso('error' in r ? r.error : T.copiados(r.copiados))
              alCambiar()
            }}
          />
          <Boton variante="secundario" disabled={visibles.length === 0} onClick={descargar}>
            <Download aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {T.descargar}
          </Boton>
        </div>
      </div>

      {aviso && (
        <p className="nota text-texto-suave" role="status">
          {aviso}
        </p>
      )}

      {alumnos.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio(codigo)}</p>
      ) : (
        <>
          <BarraDePlanilla
            estado={estado}
            onCambiar={cambiar}
            filtros={[
              { id: 'todos', etiqueta: T.filtros.todos(cuantas.todos) },
              { id: 'nada', etiqueta: T.filtros.nada(cuantas.nada) },
              { id: 'debajo', etiqueta: T.filtros.debajo(NOTA_DE_APROBACION, cuantas.debajo) },
              { id: 'flojos', etiqueta: T.filtros.flojos(cuantas.flojos) },
            ]}
          />
          <p className="nota text-texto-suave" aria-live="polite">
            {T.mostrando(visibles.length, todas.length)}
          </p>
          <div className={C.contenedor}>
            <table className={C.tabla}>
              <caption className="sr-only">{T.titulo}</caption>
              <thead>
                <tr>
                  <EncabezadoOrdenable columna="alumno" etiqueta={T.alumno} estado={estado} onCambiar={cambiar} className={C.esquina} />
                  <EncabezadoOrdenable columna="resueltos" etiqueta={T.resueltos} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="promedio" etiqueta={T.promedio} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="mejor" etiqueta={T.mejor} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="temas" etiqueta={T.temasFlojos} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <EncabezadoOrdenable columna="actividad" etiqueta={T.ultimaActividad} estado={estado} onCambiar={cambiar} className={C.encabezado} />
                  <th scope="col" className={C.encabezado}>
                    <span className="sr-only">{T.acciones}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className={cn(C.celda, 'cuerpo-s text-texto-suave')}>
                      {T.ningunoCoincide}
                    </td>
                  </tr>
                )}
                {visibles.map(({ alumno }) => (
                  <tr key={alumno.memberId}>
                    <th scope="row" className={cn(C.celda, C.primeraCelda, 'max-w-[180px] text-left font-normal sm:max-w-none')}>
                      <button
                        type="button"
                        className="flex min-h-11 items-center gap-1.5 text-left text-texto hover:underline"
                        onClick={() => setAbierto(alumno)}
                      >
                        <span className="font-medium">{alumno.displayName}</span>
                        {alumno.isVerified ? (
                          <BadgeCheck className="size-4 shrink-0 text-logrado" aria-label={T.verificada} />
                        ) : (
                          <span className="nota shrink-0 rounded-sm border border-borde px-1.5 text-texto-suave">{T.sinVerificar}</span>
                        )}
                      </button>
                    </th>
                    <td className={cn(C.celda, 'tabular-nums')}>{alumno.attemptCount}</td>
                    <td className={cn(C.celda, 'font-semibold tabular-nums')}>{formatScore(alumno.averageScore)}</td>
                    <td className={cn(C.celda, 'tabular-nums text-texto-suave')}>{formatScore(alumno.bestScore)}</td>
                    <td className={C.celda}>
                      {alumno.weakTopics.length === 0 ? (
                        <span className="nota text-texto-suave">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {alumno.weakTopics.map((tema) => (
                            <span
                              key={tema.topicName}
                              className="nota max-w-[220px] truncate rounded-sm border border-flojo bg-flojo-fondo px-1.5 text-flojo"
                              title={`${tema.correct} de ${tema.total}`}
                            >
                              {tema.topicName}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={cn(C.celda, 'whitespace-nowrap text-texto-suave')}>{formatDateTime(alumno.lastAttemptAt)}</td>
                    <td className={cn(C.celda, 'text-right')}>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => void quitar(alumno)}
                        aria-label={T.quitar(alumno.displayName)}
                        className="inline-flex size-11 items-center justify-center rounded-md text-texto-suave hover:bg-superficie-suave hover:text-texto"
                      >
                        <UserMinus className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="nota text-texto-suave">{T.pie}</p>

      <ClassroomStudentDialog classroomId={grupoId} student={abierto} onOpenChange={(abre) => !abre && setAbierto(null)} />
    </section>
  )
}
