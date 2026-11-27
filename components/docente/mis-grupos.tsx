'use client'

import type { Modalidad } from '@/lib/modalidad'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { CrearGrupo } from '@/components/docente/grupo/crear-grupo'
import { TarjetaDeGrupo } from '@/components/docente/tarjeta-de-grupo'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { etiquetaDeMateria, materiaDePrograma } from '@/lib/etiqueta-materia'
import { pedirJson } from '@/lib/pedir-json'
import { MIS_GRUPOS as T } from '@/lib/textos'
import type { TeacherProgram } from '@/lib/types'
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

/**
 * L4: la pestaña *Mis grupos*, al mismo nivel que *Mis alumnos*. Cada grupo
 * con su materia, código, alumnos, tareas mandadas y link; cerrar, y los
 * cerrados aparte (plegados) con reabrir y borrar. Cerrar o borrar un grupo
 * nunca borra la materia.
 *
 * M3: la tarjeta abre la página del grupo (`/teacher/grupos/[id]`), donde
 * vive todo el seguimiento —alumnos, tareas, temas, diagnósticos— y se arma
 * un diagnóstico o se manda una tarea. "+ Crear grupo" va arriba.
 */
export function MisGrupos({
  materias,
  alCambiar,
  modalidad = null,
}: {
  materias: TeacherProgram[]
  alCambiar?: () => void
  /** AC1: el particular ve «Crear grupo» deshabilitado. */
  modalidad?: Modalidad | null
}) {
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
      <div className="flex justify-end">
        <CrearGrupo materias={materias} modalidad={modalidad} />
      </div>

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

      {/* El diagnóstico del 10/08 no se tomó dentro de un grupo: no aparece en
          la página de ninguno. Antes vivía en la gestión plegada (M3 la sacó). */}
      <Link
        href="/teacher/diagnostico"
        className="flex items-center justify-between gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 hover:border-borde-fuerte"
      >
        <span className="min-w-0">
          <span className="cuerpo-s block font-bold text-texto">{T.diagnosticoAgosto.titulo}</span>
          <span className="nota block text-texto-suave">{T.diagnosticoAgosto.detalle}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-texto-suave" aria-hidden="true" />
      </Link>

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
