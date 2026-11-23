'use client'

import { useEffect, useMemo, useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { pedirJson } from '@/lib/pedir-json'
import type { PreguntaDelBanco, Valoracion } from '@/lib/banco'
import { ETIQUETA_DE_TIPO } from '@/lib/tipos-moodle'
import type { QuestionType } from '@/lib/types'
import { BANCO as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

interface Facetas {
  materias: { id: number; nombre: string }[]
  unidades: string[]
  temas: string[]
  tipos: QuestionType[]
}
interface RespuestaDelBanco {
  preguntas: PreguntaDelBanco[]
  total: number
  facetas: Facetas
}
export interface FiltrosEnPantalla {
  texto: string
  materia: string
  unidad: string
  tema: string
  tipo: string
  valoracion: string
}

const CAMPO = 'h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s text-texto'

function Selector({ etiqueta, valor, opciones, onCambiar }: { etiqueta: string; valor: string; opciones: { valor: string; texto: string }[]; onCambiar: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="nota font-semibold text-texto">{etiqueta}</span>
      <select className={CAMPO} value={valor} onChange={(e) => onCambiar(e.target.value)}>
        <option value="">{T.todas}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Ronda W · W1 — El banco con sus filtros. Con `elegidas`/`onElegir`, cada
 * pregunta se puede tildar (para sumarla a una tarea); sin eso, sólo se lee.
 */
export function ListaDelBanco({
  inicial,
  fijos = {},
  elegidas,
  onElegir,
}: {
  inicial?: Partial<FiltrosEnPantalla>
  /** Filtros que no se muestran (por ejemplo, la materia de la tarea). */
  fijos?: Partial<FiltrosEnPantalla> & { temas?: string[] }
  elegidas?: Map<string, PreguntaDelBanco>
  onElegir?: (p: PreguntaDelBanco, elegida: boolean) => void
}) {
  const [f, setF] = useState<FiltrosEnPantalla>({ texto: '', materia: '', unidad: '', tema: '', tipo: '', valoracion: '', ...inicial })
  const [datos, setDatos] = useState<RespuestaDelBanco | null>(null)
  const [cargando, setCargando] = useState(true)
  const consulta = useMemo(() => {
    const q = new URLSearchParams()
    const todos = { ...f, ...fijos }
    for (const k of ['texto', 'materia', 'unidad', 'tema', 'tipo', 'valoracion'] as const) if (todos[k]) q.set(k, String(todos[k]))
    return q.toString()
  }, [f, fijos])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    const t = setTimeout(() => {
      void pedirJson<RespuestaDelBanco>(`/api/teacher/banco?${consulta}`).then((res) => {
        if (!vigente) return
        setCargando(false)
        if (!('error' in res)) setDatos(res.data)
      })
    }, 250)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta])

  const cambiar = (k: keyof FiltrosEnPantalla) => (v: string) => setF((x) => ({ ...x, [k]: v }))
  const facetas = datos?.facetas
  const visibles = (datos?.preguntas ?? []).filter((p) => !fijos.temas?.length || fijos.temas.includes(p.tema))

  return (
    <div className="space-y-4" data-banco>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block space-y-1 sm:col-span-2 lg:col-span-3">
          <span className="nota font-semibold text-texto">{T.buscar}</span>
          <input className={CAMPO} value={f.texto} maxLength={100} onChange={(e) => cambiar('texto')(e.target.value)} type="search" />
        </label>
        {!fijos.materia && (
          <Selector etiqueta={T.filtros.materia} valor={f.materia} onCambiar={cambiar('materia')} opciones={(facetas?.materias ?? []).map((m) => ({ valor: String(m.id), texto: m.nombre }))} />
        )}
        <Selector etiqueta={T.filtros.unidad} valor={f.unidad} onCambiar={cambiar('unidad')} opciones={(facetas?.unidades ?? []).map((u) => ({ valor: u, texto: u }))} />
        {!fijos.temas?.length && (
          <Selector etiqueta={T.filtros.tema} valor={f.tema} onCambiar={cambiar('tema')} opciones={(facetas?.temas ?? []).map((t) => ({ valor: t, texto: t }))} />
        )}
        <Selector etiqueta={T.filtros.tipo} valor={f.tipo} onCambiar={cambiar('tipo')} opciones={(facetas?.tipos ?? []).map((t) => ({ valor: t, texto: ETIQUETA_DE_TIPO[t] ?? t }))} />
        <Selector
          etiqueta={T.filtros.valoracion}
          valor={f.valoracion}
          onCambiar={cambiar('valoracion')}
          opciones={(['arriba', 'abajo', 'sin'] as Valoracion[]).map((v) => ({ valor: v, texto: T.valoraciones[v] }))}
        />
      </div>

      <p className="nota text-texto-suave" role="status">
        {cargando ? T.cargando : datos ? T.resultados(visibles.length, fijos.temas?.length ? visibles.length : datos.total) : ''}
      </p>

      {!cargando && datos && visibles.length === 0 && <p className="cuerpo-s text-texto-suave">{datos.facetas.materias.length === 0 ? T.sinPreguntas : T.vacio}</p>}

      <ul className="space-y-2">
        {visibles.map((p) => {
          const elegida = elegidas?.has(p.clave) ?? false
          const contenido = (
            <>
              <p className="cuerpo-s text-texto">{String(p.pregunta.question)}</p>
              <p className="nota mt-1 text-texto-suave">
                {ETIQUETA_DE_TIPO[p.tipo] ?? p.tipo} · {p.materia}
                {p.unidad ? ` · ${p.unidad}` : ''}
                {p.tema ? ` · ${p.tema}` : ''}
              </p>
              <p className="nota text-texto-suave">{T.deCuestionario(p.cuestionario)}</p>
            </>
          )
          return (
            <li key={p.clave} className={cn('flex gap-3 rounded-md border bg-superficie-tarjeta p-3', elegida ? 'border-accion' : 'border-borde')} data-pregunta-del-banco={p.clave}>
              {onElegir ? (
                <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--accion)]" checked={elegida} onChange={(e) => onElegir(p, e.target.checked)} aria-label={T.elegir(String(p.pregunta.question))} />
                  <div className="min-w-0">{contenido}</div>
                </label>
              ) : (
                <div className="min-w-0 flex-1">{contenido}</div>
              )}
              {p.valoracion !== 'sin' &&
                (p.valoracion === 'arriba' ? (
                  <ThumbsUp className="size-4 shrink-0 text-logrado" aria-label={T.valoraciones.arriba} strokeWidth={TRAZO_ICONO} />
                ) : (
                  <ThumbsDown className="size-4 shrink-0 text-flojo" aria-label={T.valoraciones.abajo} strokeWidth={TRAZO_ICONO} />
                ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * W1 · "Sumar del banco" al armar una tarea: elige preguntas de la materia
 * (por defecto, de los temas elegidos). Las elegidas van tal cual; la IA
 * completa el resto (subject-content).
 */
export function ElegirDelBanco({
  materiaId,
  temas,
  elegidas,
  onCambiar,
}: {
  materiaId: number
  temas: string[]
  elegidas: Map<string, PreguntaDelBanco>
  onCambiar: (m: Map<string, PreguntaDelBanco>) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [soloTemas, setSoloTemas] = useState(true)
  return (
    <>
      <Boton variante="secundario" onClick={() => setAbierto(true)} data-sumar-del-banco>
        {T.sumarCon(elegidas.size)}
      </Boton>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogTitle className="titulo-m text-texto">{T.elegirTitulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.elegirDetalle}</DialogDescription>
          <label className="cuerpo-s flex min-h-11 items-center gap-2 text-texto">
            <input type="checkbox" className="size-5 accent-[var(--accion)]" checked={soloTemas} onChange={(e) => setSoloTemas(e.target.checked)} />
            {T.soloTemas}
          </label>
          <ListaDelBanco
            fijos={{ materia: String(materiaId), ...(soloTemas ? { temas } : {}) }}
            elegidas={elegidas}
            onElegir={(p, si) => {
              const nuevo = new Map(elegidas)
              if (si) nuevo.set(p.clave, p)
              else nuevo.delete(p.clave)
              onCambiar(nuevo)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Boton onClick={() => setAbierto(false)}>{T.listo}</Boton>
            {elegidas.size > 0 && (
              <Boton variante="secundario" onClick={() => onCambiar(new Map())}>
                {T.quitarTodas}
              </Boton>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
