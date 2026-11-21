'use client'

import { useState } from 'react'
import { BadgeCheck, Download, UserMinus } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ClassroomStudentDialog } from '@/components/classroom-student-dialog'
import { formatDateTime, formatPercent, formatScore } from '@/components/classroom-report-parts'
import { pedirJson } from '@/lib/pedir-json'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
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

/**
 * M3: la pestaña Alumnos de la página del grupo. Tocar el nombre abre todo lo
 * que hizo el alumno; se puede quitar a uno, sumar los de otro grupo y bajar
 * las notas. (M4 la vuelve ordenable y filtrable.)
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
  const [origen, setOrigen] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function quitar(alumno: AlumnoDelInforme) {
    setOcupado(true)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupoId}/members/${alumno.memberId}`, { method: 'DELETE' })
    setOcupado(false)
    setAviso('error' in respuesta ? respuesta.error : null)
    alCambiar()
  }

  async function sumarDeOtroGrupo() {
    if (!origen) return
    setOcupado(true)
    const respuesta = await pedirJson<{ copied: number }>(`/api/teacher/classrooms/${grupoId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceClassroomId: Number(origen) }),
    })
    setOcupado(false)
    setAviso('error' in respuesta ? respuesta.error : T.copiados(Number(respuesta.data.copied ?? 0)))
    setOrigen('')
    alCambiar()
  }

  function descargar() {
    const seguro = nombreDelGrupo.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    descargarCsv(`notas-${seguro}.csv`, filasDelCsv(alumnos))
    setAviso(T.descargadas)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="cuerpo font-bold text-texto">{T.titulo}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {otrosGrupos.length > 0 && (
            <>
              <select
                className="min-h-11 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-2 text-sm text-texto"
                value={origen}
                onChange={(evento) => setOrigen(evento.target.value)}
                aria-label={T.copiarDe}
              >
                <option value="">{T.copiarDe}</option>
                {otrosGrupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count})
                  </option>
                ))}
              </select>
              <Boton variante="secundario" disabled={!origen || ocupado} onClick={() => void sumarDeOtroGrupo()}>
                {T.copiarBoton}
              </Boton>
            </>
          )}
          <Boton variante="secundario" disabled={alumnos.length === 0} onClick={descargar}>
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="nota border-b border-borde text-left uppercase tracking-wider text-texto-suave">
                <th className="py-2 pr-3">{T.alumno}</th>
                <th className="py-2 pr-3">{T.resueltos}</th>
                <th className="py-2 pr-3">{T.promedio}</th>
                <th className="py-2 pr-3">{T.mejor}</th>
                <th className="py-2 pr-3">{T.temasFlojos}</th>
                <th className="py-2 pr-3">{T.ultimaActividad}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {alumnos.map((alumno) => (
                <tr key={alumno.memberId} className="border-b border-borde last:border-0">
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="flex min-h-11 items-center gap-1.5 text-left text-texto hover:underline"
                      onClick={() => setAbierto(alumno)}
                    >
                      <span className="font-medium">{alumno.displayName}</span>
                      {alumno.isVerified ? (
                        <BadgeCheck className="size-4 text-logrado" aria-label={T.verificada} />
                      ) : (
                        <span className="nota rounded-sm border border-borde px-1.5 text-texto-suave">{T.sinVerificar}</span>
                      )}
                    </button>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{alumno.attemptCount}</td>
                  <td className="py-2 pr-3 font-semibold tabular-nums">{formatScore(alumno.averageScore)}</td>
                  <td className="py-2 pr-3 tabular-nums text-texto-suave">{formatScore(alumno.bestScore)}</td>
                  <td className="py-2 pr-3">
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
                  <td className="whitespace-nowrap py-2 pr-3 text-texto-suave">{formatDateTime(alumno.lastAttemptAt)}</td>
                  <td className="py-2 text-right">
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
      )}

      <p className="nota text-texto-suave">{T.pie}</p>

      <ClassroomStudentDialog classroomId={grupoId} student={abierto} onOpenChange={(abre) => !abre && setAbierto(null)} />
    </section>
  )
}
