'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Cargando } from '@/components/sistema/cargando'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { PantallaDeLimite } from '@/components/docente/pantalla-de-limite'
import { AccionesDeCuestionario } from '@/components/docente/acciones-de-cuestionario'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { planDiagnostico, resumirPlan, type CuestionarioPlaneado, type ModoDiagnostico } from '@/lib/diagnostico'
import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'
import { DIAGNOSTICO } from '@/lib/textos'
import type { ProgramUnit } from '@/lib/types'
import { cn } from '@/lib/utils'

const T = DIAGNOSTICO.dialogo

type Paso =
  | { tipo: 'elegir' }
  | {
      tipo: 'generando'
      diagnosticoId: number
      estados: ('pendiente' | 'generando' | 'listo' | 'fallo')[]
      /** L1: el id de cada cuestionario ya guardado, para sus acciones. */
      ids: (number | null)[]
    }

/**
 * J4: armar el diagnóstico. Se elige el modo y qué unidades entran, se ve el
 * resumen ("4 cuestionarios · 37 preguntas · unos 45 minutos") y se genera.
 *
 * Cada cuestionario es un pedido aparte: el docente ve el avance, y si uno
 * falla, los demás quedan asignados y se puede reintentar sólo ése.
 *
 * L1: al terminar ya está todo guardado y asignado; cada cuestionario listo
 * trae sus acciones (revisar y editar, ver como alumno, hacerlo, imprimir).
 */
export function ArmarDiagnostico({
  abierto,
  onCambiar,
  destino,
  materia,
  unidades,
  temasDificiles,
  alTerminar,
  nombre = null,
}: {
  abierto: boolean
  onCambiar: (abierto: boolean) => void
  /** { alumno } o { invitacion }, tal cual lo espera POST /api/teacher/diagnosticos. */
  destino: { alumno: string } | { invitacion: number }
  materia: string
  unidades: ProgramUnit[]
  temasDificiles: string[]
  alTerminar: () => void
  /** L1: a quién quedó asignado, para el "Listo". null: al grupo. */
  nombre?: string | null
}) {
  const consulta = 'alumno' in destino ? `alumno=${encodeURIComponent(destino.alumno)}` : `invitacion=${destino.invitacion}`
  const [modo, setModo] = useState<ModoDiagnostico>('por_unidad')
  const [excluidas, setExcluidas] = useState<Set<string>>(new Set())
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' })
  const [error, setError] = useState<string | null>(null)
  const [bloqueo, setBloqueo] = useState<CuerpoDeBloqueo | null>(null)

  const conTemas = unidades.filter((u) => u.topics.length > 0)
  const plan = useMemo(
    () => planDiagnostico(unidades, modo, { temasDificiles, unidadesExcluidas: [...excluidas] }),
    [unidades, modo, temasDificiles, excluidas],
  )
  const resumen = resumirPlan(plan)
  const ocupado = paso.tipo === 'generando' && paso.estados.some((e) => e === 'generando' || e === 'pendiente')

  function cerrar(siguiente: boolean) {
    if (ocupado) return
    onCambiar(siguiente)
    if (!siguiente) {
      setPaso({ tipo: 'elegir' })
      setError(null)
      setBloqueo(null)
      setExcluidas(new Set())
    }
  }

  async function generarUno(
    diagnosticoId: number,
    cuestionario: CuestionarioPlaneado,
  ): Promise<{ quizId: number } | 'fallo' | CuerpoDeBloqueo> {
    try {
      const res = await fetch(`/api/teacher/diagnosticos/${diagnosticoId}/cuestionarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadId: cuestionario.unidadId, temas: cuestionario.temas.map(({ id, preguntas }) => ({ id, preguntas })) }),
      })
      const datos = await res.json().catch(() => null)
      if (res.status === 402) {
        const frenado = leerBloqueo(datos)
        if (frenado) return frenado
      }
      return res.ok && datos?.quizId ? { quizId: Number(datos.quizId) } : 'fallo'
    } catch {
      return 'fallo'
    }
  }

  async function correr(diagnosticoId: number, indices: number[], base: Paso & { tipo: 'generando' }) {
    const estados = [...base.estados]
    const ids = [...base.ids]
    const mostrar = () => setPaso({ tipo: 'generando', diagnosticoId, estados: [...estados], ids: [...ids] })
    for (const i of indices) {
      estados[i] = 'generando'
      mostrar()
      const resultado = await generarUno(diagnosticoId, plan[i])
      if (resultado !== 'fallo' && !('quizId' in resultado)) {
        // Se frenó por el plan: lo que falta queda sin generar.
        for (const j of indices) if (estados[j] !== 'listo') estados[j] = 'fallo'
        mostrar()
        setBloqueo(resultado)
        return
      }
      if (resultado === 'fallo') {
        estados[i] = 'fallo'
      } else {
        estados[i] = 'listo'
        ids[i] = resultado.quizId
      }
      mostrar()
    }
    // K4: la ficha de abajo ya muestra los cuestionarios, sin esperar a que se cierre.
    alTerminar()
  }

  async function generar() {
    if (plan.length === 0) return
    setError(null)
    try {
      const res = await fetch('/api/teacher/diagnosticos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...destino, modo }),
      })
      const datos = await res.json().catch(() => null)
      if (res.status === 402) {
        const frenado = leerBloqueo(datos)
        if (frenado) {
          setBloqueo(frenado)
          return
        }
      }
      if (!res.ok || !datos?.diagnosticoId) throw new Error(datos?.error)
      const inicial: Paso & { tipo: 'generando' } = {
        tipo: 'generando',
        diagnosticoId: datos.diagnosticoId,
        estados: plan.map(() => 'pendiente' as const),
        ids: plan.map(() => null),
      }
      setPaso(inicial)
      await correr(datos.diagnosticoId, plan.map((_, i) => i), inicial)
    } catch {
      setError(T.fallo)
    }
  }

  function reintentar() {
    if (paso.tipo !== 'generando') return
    const fallados = paso.estados.flatMap((e, i) => (e === 'fallo' ? [i] : []))
    void correr(paso.diagnosticoId, fallados, paso)
  }

  const fallados = paso.tipo === 'generando' ? paso.estados.filter((e) => e === 'fallo').length : 0
  const enCurso = paso.tipo === 'generando' ? paso.estados.findIndex((e) => e === 'generando') : -1

  return (
    <Dialog open={abierto} onOpenChange={cerrar}>
      <DialogContent className={cn('rounded-lg border-borde', bloqueo ? 'sm:max-w-[560px]' : 'sm:max-w-[520px]')}>
        {bloqueo ? (
          <PantallaDeLimite bloqueo={bloqueo} onVolver={() => setBloqueo(null)} />
        ) : (
          <>
            <DialogTitle className="titulo-m text-texto">{T.titulo}</DialogTitle>
            <DialogDescription className="cuerpo-s text-texto-suave">{T.detalle(materia)}</DialogDescription>

            {paso.tipo === 'elegir' ? (
              <div className="flex flex-col gap-4">
                <fieldset>
                  <legend className="nota mb-2 font-semibold text-texto-suave">{T.modo}</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['por_unidad', 'integral'] as const).map((opcion) => {
                      const textos = opcion === 'por_unidad' ? T.porUnidad : T.integral
                      return (
                        <label
                          key={opcion}
                          className={cn(
                            'flex cursor-pointer flex-col gap-1 rounded-md border p-3',
                            modo === opcion ? 'border-accion bg-accion-tenue' : 'border-borde-fuerte bg-superficie-tarjeta',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="modo-diagnostico"
                              value={opcion}
                              checked={modo === opcion}
                              onChange={() => setModo(opcion)}
                              className="size-4 accent-accion"
                            />
                            <span className="cuerpo-s font-bold text-texto">{textos.titulo}</span>
                          </span>
                          <span className="nota text-texto-suave">{textos.detalle}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="nota mb-1 font-semibold text-texto-suave">{T.unidades}</legend>
                  <p className="nota mb-2 text-texto-suave">{T.unidadesAyuda}</p>
                  <ul className="flex max-h-56 flex-col overflow-y-auto">
                    {conTemas.map((u) => (
                      <li key={u.id}>
                        <label className="cuerpo-s flex min-h-11 cursor-pointer items-center gap-3 text-texto">
                          <input
                            type="checkbox"
                            checked={!excluidas.has(u.id)}
                            onChange={() =>
                              setExcluidas((actual) => {
                                const siguiente = new Set(actual)
                                if (siguiente.has(u.id)) siguiente.delete(u.id)
                                else siguiente.add(u.id)
                                return siguiente
                              })
                            }
                            className="size-5 shrink-0 accent-accion"
                          />
                          <span className="min-w-0 flex-1">{u.name}</span>
                          <span className="nota shrink-0 text-texto-suave">{T.temas(u.topics.length)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>

                <div className="rounded-md border border-borde bg-superficie-base p-3">
                  <p className="cuerpo-s font-bold text-texto" aria-live="polite">
                    {plan.length > 0 ? T.resumen(resumen.cuestionarios, resumen.preguntas, resumen.minutos) : T.nada}
                  </p>
                  <p className="nota mt-1 text-texto-suave">{T.tipos}</p>
                </div>

                {error && (
                  <p className="nota text-flojo" role="alert">
                    {error}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Boton variante="secundario" onClick={() => cerrar(false)}>
                    {T.cancelar}
                  </Boton>
                  <Boton onClick={generar} disabled={plan.length === 0}>
                    {T.generar}
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div aria-live="polite">
                  <p className="cuerpo-s font-bold text-texto">
                    {enCurso >= 0 ? T.generando(enCurso + 1, plan.length) : fallados > 0 ? T.fallaron(fallados) : T.listo(nombre)}
                  </p>
                  {!ocupado && fallados === 0 && <p className="nota mt-1 text-texto-suave">{T.listoDetalle}</p>}
                </div>
                <ul className="flex flex-col gap-2">
                  {plan.map((c, i) => (
                    <li key={`${c.unidadId}-${i}`} className="cuerpo-s flex items-center gap-3 text-texto">
                      <span className="flex size-5 shrink-0 items-center justify-center">
                        {paso.estados[i] === 'generando' ? (
                          <Cargando />
                        ) : paso.estados[i] === 'listo' ? (
                          <Check aria-hidden="true" className="size-5 text-logrado" strokeWidth={TRAZO_ICONO} />
                        ) : paso.estados[i] === 'fallo' ? (
                          <X aria-hidden="true" className="size-5 text-flojo" strokeWidth={TRAZO_ICONO} />
                        ) : (
                          <span aria-hidden="true" className="size-2 rounded-full bg-borde-fuerte" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        {c.titulo}
                        <span className="nota block text-texto-suave">{DIAGNOSTICO.preguntas(c.total)}</span>
                      </span>
                      {!ocupado && paso.estados[i] === 'listo' && paso.ids[i] !== null && (
                        <AccionesDeCuestionario
                          quizId={paso.ids[i]!}
                          titulo={c.titulo}
                          consulta={consulta}
                          acciones={['revisar', 'verComoAlumno', 'hacerlo', 'imprimir']}
                          // El cuestionario se abre encima de la ficha: el diálogo se cierra antes.
                          antesDeAbrir={() => cerrar(false)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                {!ocupado && (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Boton variante={fallados > 0 ? 'secundario' : 'principal'} onClick={() => cerrar(false)}>
                      {T.cerrar}
                    </Boton>
                    {fallados > 0 && <Boton onClick={reintentar}>{T.reintentar}</Boton>}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
