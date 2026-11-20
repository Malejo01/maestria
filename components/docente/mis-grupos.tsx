'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ClipboardCheck, Copy } from 'lucide-react'
import { ArmarDiagnostico } from '@/components/docente/armar-diagnostico'
import { AccionesDeCuestionario } from '@/components/docente/acciones-de-cuestionario'
import { CargaFallida } from '@/components/carga-fallida'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { etiquetaDeMateria, materiaDePrograma } from '@/lib/etiqueta-materia'
import { pedirJson } from '@/lib/pedir-json'
import { MIS_GRUPOS as T } from '@/lib/textos'
import type { DiagnosticoDelGrupo } from '@/lib/diagnostico-grupo-server'
import type { ProgramUnit, TeacherProgram } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Una fila de GET /api/teacher/classrooms. */
export interface GrupoDelDocente {
  id: number
  teacher_program_id: number
  name: string
  join_code: string
  status: 'open' | 'closed'
  subject_name: string
  nivel: string | null
  grado: string | null
  member_count: number
  assignment_count: number
}

interface DatosDelGrupo {
  disponible: boolean
  grupo?: { classroomId: number; materiaId: number; materia: string; unidades: ProgramUnit[] }
  diagnosticos?: DiagnosticoDelGrupo[]
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })

/**
 * L4: la pestaña *Mis grupos*, al mismo nivel que *Mis alumnos*. Cada grupo
 * con su materia, código, alumnos, tareas mandadas y link; armar un
 * diagnóstico o una práctica del grupo eligiendo temas, con su seguimiento;
 * cerrar, y los cerrados aparte (plegados) con reabrir y borrar. Cerrar o
 * borrar un grupo nunca borra la materia.
 */
export function MisGrupos({ materias, alCambiar }: { materias: TeacherProgram[]; alCambiar?: () => void }) {
  const [grupos, setGrupos] = useState<GrupoDelDocente[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cerradosAbiertos, setCerradosAbiertos] = useState(false)
  const [borrando, setBorrando] = useState<GrupoDelDocente | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)

  const leer = useCallback(async () => {
    const respuesta = await pedirJson<{ classrooms: GrupoDelDocente[] }>('/api/teacher/classrooms')
    if ('error' in respuesta) setError(respuesta.error)
    else {
      setError(null)
      setGrupos(respuesta.data.classrooms)
    }
  }, [])

  useEffect(() => {
    void leer()
  }, [leer])

  const todas = materias.map(materiaDePrograma)
  const etiqueta = (g: GrupoDelDocente) => {
    const programa = materias.find((m) => m.id === g.teacher_program_id)
    return programa ? etiquetaDeMateria(materiaDePrograma(programa), todas) : g.subject_name
  }

  async function cambiarEstado(grupo: GrupoDelDocente, status: 'open' | 'closed') {
    setOcupado(grupo.id)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOcupado(null)
    if ('error' in respuesta) setError(respuesta.error)
    await leer()
    alCambiar?.()
  }

  async function borrar(grupo: GrupoDelDocente) {
    setOcupado(grupo.id)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupo.id}`, { method: 'DELETE' })
    setOcupado(null)
    setBorrando(null)
    if ('error' in respuesta) setError(respuesta.error)
    await leer()
    alCambiar?.()
  }

  if (error && !grupos) {
    return (
      <div className="rounded-lg border border-borde bg-superficie-tarjeta">
        <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
      </div>
    )
  }
  if (!grupos) {
    return (
      <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
        <Cargando /> {T.cargando}
      </p>
    )
  }

  const abiertos = grupos.filter((g) => g.status === 'open')
  const cerrados = grupos.filter((g) => g.status === 'closed')

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="nota text-flojo" role="alert">
          {error}
        </p>
      )}

      {abiertos.length === 0 ? (
        <div className="rounded-lg border border-borde bg-superficie-tarjeta p-6">
          <h2 className="titulo-m text-texto">{T.vacio.titulo}</h2>
          <p className="cuerpo-s mt-1 max-w-prose text-texto-suave">{T.vacio.detalle}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {abiertos.map((g) => (
            <TarjetaDeGrupo
              key={g.id}
              grupo={g}
              materia={etiqueta(g)}
              ocupado={ocupado === g.id}
              alCerrar={() => void cambiarEstado(g, 'closed')}
            />
          ))}
        </ul>
      )}

      {cerrados.length > 0 && (
        <section className="rounded-lg border border-borde bg-superficie-tarjeta">
          <button
            type="button"
            aria-expanded={cerradosAbiertos}
            onClick={() => setCerradosAbiertos((abierto) => !abierto)}
            className="flex min-h-11 w-full items-center justify-between gap-3 p-4 text-left"
          >
            <span>
              <span className="cuerpo block text-texto">{T.cerrados.titulo(cerrados.length)}</span>
              <span className="nota block text-texto-suave">{T.cerrados.detalle}</span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn('size-5 shrink-0 text-texto-suave transition-transform', cerradosAbiertos && 'rotate-180')}
              strokeWidth={TRAZO_ICONO}
            />
          </button>
          {cerradosAbiertos && (
            <ul className="flex flex-col border-t border-borde">
              {cerrados.map((g) => (
                <li key={g.id} className="flex flex-col gap-3 border-b border-borde p-4 last:border-b-0 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="nota text-texto-suave">{etiqueta(g)}</p>
                    <p className="cuerpo-s font-bold text-texto">{g.name}</p>
                    <p className="nota text-texto-suave">{T.resumen(g.join_code, g.member_count, g.assignment_count)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Boton variante="secundario" disabled={ocupado === g.id} onClick={() => void cambiarEstado(g, 'open')}>
                      {T.reabrir}
                    </Boton>
                    <Boton variante="secundario" disabled={ocupado === g.id} onClick={() => setBorrando(g)}>
                      {T.borrar}
                    </Boton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Dialog open={Boolean(borrando)} onOpenChange={(abierto) => !abierto && setBorrando(null)}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[460px]">
          <DialogTitle className="titulo-m text-texto">{T.borrarDialogo.titulo(borrando?.name ?? '')}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">
            {borrando ? T.borrarDialogo.detalle(borrando.member_count, borrando.assignment_count) : ''}
          </DialogDescription>
          <p className="cuerpo-s text-texto">{T.borrarDialogo.materia}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setBorrando(null)}>
              {T.borrarDialogo.cancelar}
            </Boton>
            <Boton disabled={ocupado !== null} onClick={() => borrando && void borrar(borrando)}>
              {ocupado !== null ? <Cargando /> : null}
              {T.borrarDialogo.confirmar}
            </Boton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TarjetaDeGrupo({
  grupo,
  materia,
  ocupado,
  alCerrar,
}: {
  grupo: GrupoDelDocente
  materia: string
  ocupado: boolean
  alCerrar: () => void
}) {
  const [datos, setDatos] = useState<DatosDelGrupo | null>(null)
  const [armando, setArmando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [seguimientoAbierto, setSeguimientoAbierto] = useState(false)

  const leer = useCallback(async () => {
    const respuesta = await pedirJson<DatosDelGrupo>(`/api/teacher/grupos/${grupo.id}/diagnosticos`)
    setDatos('error' in respuesta ? { disponible: false } : respuesta.data)
  }, [grupo.id])

  useEffect(() => {
    void leer()
  }, [leer])

  const link = typeof window === 'undefined' ? `/aula/${grupo.join_code}` : `${window.location.origin}/aula/${grupo.join_code}`
  const diagnosticos = datos?.diagnosticos ?? []

  return (
    <li className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="nota text-texto-suave">{materia}</p>
          <h2 className="titulo-m text-texto">{grupo.name}</h2>
          <p className="nota mt-1 text-texto-suave">{T.resumen(grupo.join_code, grupo.member_count, grupo.assignment_count)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {datos?.disponible && datos.grupo && (
            <Boton onClick={() => setArmando(true)}>
              <ClipboardCheck aria-hidden="true" strokeWidth={TRAZO_ICONO} />
              {T.armar}
            </Boton>
          )}
          <Boton variante="secundario" disabled={ocupado} onClick={alCerrar}>
            {T.cerrar}
          </Boton>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="nota min-w-0 break-all rounded-sm bg-superficie-base px-2 py-1 text-texto">{link}</code>
        <Boton
          variante="secundario"
          aria-label={T.copiarLink(grupo.name)}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopiado(true)
            } catch {
              setCopiado(false)
            }
          }}
        >
          {copiado ? <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
          <span aria-live="polite">{copiado ? T.copiado : T.copiar}</span>
        </Boton>
      </div>

      {diagnosticos.length > 0 && (
        <div className="mt-4 border-t border-borde pt-2">
          <button
            type="button"
            aria-expanded={seguimientoAbierto}
            onClick={() => setSeguimientoAbierto((abierto) => !abierto)}
            className="cuerpo-s flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold text-texto"
          >
            {T.seguimiento.titulo(diagnosticos.length)}
            <ChevronDown
              aria-hidden="true"
              className={cn('size-5 shrink-0 text-texto-suave transition-transform', seguimientoAbierto && 'rotate-180')}
              strokeWidth={TRAZO_ICONO}
            />
          </button>
          {seguimientoAbierto && (
            <div className="flex flex-col gap-6 pt-2">
              {diagnosticos.map((d) => (
                <SeguimientoDeDiagnostico key={d.id} diagnostico={d} grupoId={grupo.id} />
              ))}
            </div>
          )}
        </div>
      )}

      {datos?.grupo && (
        <ArmarDiagnostico
          abierto={armando}
          onCambiar={(abierto) => {
            setArmando(abierto)
            if (!abierto) {
              void leer()
              setSeguimientoAbierto(true)
            }
          }}
          destino={{ grupo: grupo.id }}
          materia={datos.grupo.materia}
          unidades={datos.grupo.unidades}
          temasDificiles={[]}
          alTerminar={leer}
        />
      )}
    </li>
  )
}

/** L4: por cuestionario, cuántos lo hicieron; por tema, cuántos lo acertaron. */
function SeguimientoDeDiagnostico({ diagnostico: d, grupoId }: { diagnostico: DiagnosticoDelGrupo; grupoId: number }) {
  return (
    <article className="flex flex-col gap-3">
      <p className="nota font-semibold text-texto-suave">{T.seguimiento.armado(fechaCorta(d.creadoEl), d.modo)}</p>
      <ul className="flex flex-col">
        {d.cuestionarios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde py-2 last:border-b-0">
            <span className="min-w-0 flex-1 basis-48">
              <span className="cuerpo-s block text-texto">{c.titulo}</span>
              <span className="nota block text-texto-suave">{T.seguimiento.hicieron(c.preguntas, c.hicieron, c.total)}</span>
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
        <p className="cuerpo-s text-texto-suave">{T.seguimiento.sinRespuestas}</p>
      ) : (
        <div>
          <h3 className="cuerpo-s font-bold text-texto">{T.seguimiento.porTema}</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {d.temas.map((t) => {
              const porcentaje = t.rindieron > 0 ? Math.round((t.acertaron / t.rindieron) * 100) : 0
              return (
                <li key={t.temaId}>
                  <p className="cuerpo-s text-texto">{T.seguimiento.tema(t.nombre, t.acertaron, t.rindieron)}</p>
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
