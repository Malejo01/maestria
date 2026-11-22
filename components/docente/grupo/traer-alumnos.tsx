'use client'

import { useEffect, useMemo, useState } from 'react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { pedirJson } from '@/lib/pedir-json'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'

const T = PAGINA_DEL_GRUPO.planilla.traer

export interface GrupoDeOrigen {
  id: number
  name: string
  member_count: number
}

interface MiembroDeOrigen {
  user_id: string
  display_name: string
  is_verified: boolean
}

/**
 * O7: "Traer alumnos de otro grupo", en la página del grupo. Se elige el
 * grupo de origen y, con casillas, a quiénes (cuentas e invitados por igual).
 * No los saca del grupo de origen: se suman a éste. El botón final del
 * diálogo es la confirmación y dice cuántos y a dónde.
 */
export function TraerAlumnos({
  grupoId,
  nombreDelGrupo,
  otrosGrupos,
  yaEstan,
  alTraer,
}: {
  grupoId: number
  nombreDelGrupo: string
  otrosGrupos: GrupoDeOrigen[]
  /** Los user_id que ya están en este grupo. */
  yaEstan: ReadonlySet<string>
  /** Devuelve cuántos se sumaron, o un error. */
  alTraer: (resultado: { copiados: number } | { error: string }) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [origen, setOrigen] = useState('')
  const [miembros, setMiembros] = useState<MiembroDeOrigen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [trayendo, setTrayendo] = useState(false)

  useEffect(() => {
    if (!origen) return
    let vigente = true
    void pedirJson<{ members: MiembroDeOrigen[] }>(`/api/teacher/classrooms/${origen}/members`).then((r) => {
      if (!vigente) return
      if ('error' in r) {
        setError(r.error)
        return
      }
      const lista = Array.isArray(r.data.members) ? r.data.members : []
      setMiembros(lista)
      setElegidos(new Set(lista.filter((m) => !yaEstan.has(m.user_id)).map((m) => m.user_id)))
    })
    return () => {
      vigente = false
    }
  }, [origen, yaEstan])

  const traibles = useMemo(() => (miembros ?? []).filter((m) => !yaEstan.has(m.user_id)), [miembros, yaEstan])

  function abrirOCerrar(abre: boolean) {
    if (trayendo) return
    setAbierto(abre)
    if (!abre) {
      setOrigen('')
      setMiembros(null)
      setError(null)
      setElegidos(new Set())
    }
  }

  async function traer() {
    setTrayendo(true)
    const r = await pedirJson<{ copied: number }>(`/api/teacher/classrooms/${grupoId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceClassroomId: Number(origen), userIds: [...elegidos] }),
    })
    setTrayendo(false)
    if ('error' in r) {
      setError(r.error)
      return
    }
    alTraer({ copiados: Number(r.data.copied ?? 0) })
    abrirOCerrar(false)
  }

  if (otrosGrupos.length === 0) return null

  return (
    <>
      <Boton variante="secundario" onClick={() => abrirOCerrar(true)}>
        {T.boton}
      </Boton>
      <Dialog open={abierto} onOpenChange={abrirOCerrar}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words">{T.titulo(nombreDelGrupo)}</DialogTitle>
            <DialogDescription>{T.detalle}</DialogDescription>
          </DialogHeader>

          <label className="flex flex-col gap-1">
            <span className="nota font-semibold text-texto-suave">{T.deQueGrupo}</span>
            <select
              className="cuerpo-s min-h-11 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-2 text-texto"
              value={origen}
              onChange={(e) => {
                setMiembros(null)
                setError(null)
                setOrigen(e.target.value)
              }}
            >
              <option value="">{T.elegirGrupo}</option>
              {otrosGrupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.member_count})
                </option>
              ))}
            </select>
          </label>

          {origen && !miembros && !error && (
            <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
              <Cargando /> {T.buscando}
            </p>
          )}

          {miembros && miembros.length === 0 && <p className="cuerpo-s text-texto-suave">{T.vacio}</p>}

          {miembros && miembros.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Boton variante="secundario" className="min-h-9" onClick={() => setElegidos(new Set(traibles.map((m) => m.user_id)))}>
                  {T.todos}
                </Boton>
                <Boton variante="secundario" className="min-h-9" onClick={() => setElegidos(new Set())}>
                  {T.ninguno}
                </Boton>
              </div>
              <ul className="flex flex-col gap-1">
                {miembros.map((m) => {
                  const esta = yaEstan.has(m.user_id)
                  const id = `traer-${m.user_id}`
                  return (
                    <li key={m.user_id} className="flex min-h-11 items-center gap-3">
                      <Checkbox
                        id={id}
                        disabled={esta}
                        checked={esta || elegidos.has(m.user_id)}
                        onCheckedChange={(v) =>
                          setElegidos((prev) => {
                            const sig = new Set(prev)
                            if (v === true) sig.add(m.user_id)
                            else sig.delete(m.user_id)
                            return sig
                          })
                        }
                      />
                      <label htmlFor={id} className="cuerpo-s flex-1 text-texto">
                        {m.display_name}
                        {!m.is_verified && <span className="nota text-texto-suave"> · {T.invitado}</span>}
                        {esta && <span className="nota text-texto-suave"> · {T.yaEsta}</span>}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {error && (
            <p className="cuerpo-s text-flojo" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Boton variante="secundario" disabled={trayendo} onClick={() => abrirOCerrar(false)}>
              {T.cancelar}
            </Boton>
            {/* El nombre del grupo puede ser largo: el botón parte renglón en vez de desbordar a 390. */}
            <Boton className="h-auto min-h-11 whitespace-normal py-2" disabled={trayendo || elegidos.size === 0} onClick={() => void traer()}>
              {trayendo ? T.trayendo : T.confirmar(elegidos.size, nombreDelGrupo)}
            </Boton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
