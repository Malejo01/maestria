'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { Cargando } from '@/components/sistema/cargando'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { letra } from '@/lib/diagnostico-impreso'
import type { CuestionarioParaImprimir } from '@/lib/diagnostico-impreso-server'
import type { MarcaDePregunta } from '@/lib/diagnostico-resultados'
import { pedirJson } from '@/lib/pedir-json'
import { DIAGNOSTICO } from '@/lib/textos'
import { cn } from '@/lib/utils'

const T = DIAGNOSTICO.impreso

/** `alumno=…` o `invitacion=…`, tal cual vino en la URL. */
function useCuestionario(quizId: number, consulta: string) {
  const [datos, setDatos] = useState<CuestionarioParaImprimir | null>(null)
  const [error, setError] = useState<string | null>(null)
  const leer = useCallback(async () => {
    const res = await pedirJson<CuestionarioParaImprimir>(`/api/teacher/diagnosticos/impreso/${quizId}?${consulta}`)
    if ('error' in res) setError(res.error)
    else {
      setError(null)
      setDatos(res.data)
    }
  }, [quizId, consulta])
  useEffect(() => {
    void leer()
  }, [leer])
  return { datos, error, leer }
}

function urlDeLaFicha(consulta: string): string {
  const params = new URLSearchParams(consulta)
  const alumno = params.get('alumno')
  // L4: la hoja de un grupo vuelve a Mis grupos.
  if (params.get('grupo')) return '/teacher?seccion=aulas&vista=grupos'
  return alumno ? `/teacher/alumnos/${encodeURIComponent(alumno)}` : `/teacher/alumnos/invitacion/${params.get('invitacion')}`
}

/**
 * J7: la versión para imprimir. Una hoja para el alumno (nombre, fecha,
 * enunciados y espacio para responder) y, en una página aparte, la hoja del
 * docente con las respuestas correctas: nunca en la del alumno. Sin librería
 * de PDF: el navegador imprime a PDF solo, y `@media print` saca todo lo que
 * no es la hoja.
 */
export function ImprimirDiagnostico({ quizId, consulta }: { quizId: number; consulta: string }) {
  const { datos, error, leer } = useCuestionario(quizId, consulta)

  if (error && !datos) return <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
  if (!datos) return null

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 print:max-w-none print:p-0">
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={urlDeLaFicha(consulta)}
          className="cuerpo-s inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-texto-suave hover:text-texto"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
          {new URLSearchParams(consulta).get('grupo') ? T.volverAGrupos : T.volver}
        </Link>
        <Boton onClick={() => window.print()}>
          <Printer aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {T.imprimirAhora}
        </Boton>
      </div>
      <p className="nota mb-6 text-texto-suave print:hidden">{T.ayudaImprimir}</p>

      {/* Hoja del alumno: sin respuestas. */}
      <article className="hoja-impresa text-texto">
        <header className="border-b border-texto pb-3">
          <p className="nota uppercase tracking-wider text-texto-suave">{datos.materia}</p>
          <h1 className="titulo-m mt-1">{datos.titulo}</h1>
          <div className="cuerpo-s mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <span className="font-semibold">{T.alumno}</span>
            <span className="border-b border-borde-fuerte">{datos.alumno}</span>
            <span className="font-semibold">{T.fecha}</span>
            <span className="border-b border-borde-fuerte">&nbsp;</span>
          </div>
        </header>
        <ol className="mt-4 flex flex-col">
          {datos.preguntas.map((p) => (
            <li key={p.indice} className="break-inside-avoid border-b border-borde py-4 last:border-b-0">
              <div className="cuerpo flex gap-2">
                <span className="font-bold">{p.indice + 1}.</span>
                <LaTeXRenderer content={p.enunciado} className="min-w-0 flex-1" />
              </div>
              {p.tipo === 'multiple_choice' ? (
                <ul className="cuerpo-s mt-3 flex flex-col gap-2 pl-6">
                  {p.opciones.map((opcion, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className="mt-0.5 inline-block size-4 shrink-0 rounded-full border border-texto" />
                      <span className="font-semibold">{letra(i)}.</span>
                      <LaTeXRenderer content={opcion} className="min-w-0" />
                    </li>
                  ))}
                </ul>
              ) : p.tipo === 'true_false' ? (
                <p className="cuerpo-s mt-3 pl-6">{T.verdaderoFalso}</p>
              ) : (
                <div className="mt-3 pl-6">
                  <p className="nota text-texto-suave">{T.respuesta}</p>
                  {/* Espacio para el desarrollo: en papel se resuelve a mano. */}
                  <div aria-hidden="true" className="mt-1 h-24 rounded-sm border border-borde-fuerte" />
                </div>
              )}
            </li>
          ))}
        </ol>
      </article>

      {/* Hoja del docente: en otra página, siempre. */}
      <article className="hoja-impresa mt-10 break-before-page border-t-4 border-texto pt-6 text-texto print:mt-0 print:border-t-0 print:pt-0">
        <h2 className="titulo-m">{T.hojaDocente}</h2>
        <p className="nota mt-1 text-texto-suave">
          {datos.titulo} · {datos.alumno} · {T.noEntregar}
        </p>
        <ol className="mt-4 flex flex-col">
          {datos.preguntas.map((p) => (
            <li key={p.indice} className="cuerpo-s flex break-inside-avoid gap-2 border-b border-borde py-2 last:border-b-0">
              <span className="font-bold">{p.indice + 1}.</span>
              <LaTeXRenderer content={p.correcta} className="min-w-0 flex-1" />
            </li>
          ))}
        </ol>
      </article>
    </div>
  )
}

const MARCAS: MarcaDePregunta[] = ['bien', 'mal', 'sin_responder']

/**
 * J7: cargar a mano lo que respondió en papel. Tres botones por pregunta. Lo
 * que no se marca queda como sin responder. Se guarda en
 * `diagnostico_resultados_impresos` y aparece en el resultado (J6) igual que
 * si hubiera rendido en la app.
 */
export function CargarImpreso({ quizId, consulta }: { quizId: number; consulta: string }) {
  const { datos, error, leer } = useCuestionario(quizId, consulta)
  const [marcas, setMarcas] = useState<Record<number, MarcaDePregunta>>({})
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado' | 'fallo'>('quieto')
  const [inicializado, setInicializado] = useState(false)

  if (datos && !inicializado) {
    setInicializado(true)
    if (datos.cargaPrevia) setMarcas(Object.fromEntries(datos.cargaPrevia.map((m, i) => [i, m])))
  }

  if (error && !datos) return <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
  if (!datos) return null

  const marca = (i: number): MarcaDePregunta => marcas[i] ?? 'sin_responder'
  const cuenta = (m: MarcaDePregunta) => datos.preguntas.filter((p) => marca(p.indice) === m).length

  async function guardar() {
    if (!datos) return
    setEstado('guardando')
    const params = new URLSearchParams(consulta)
    const alumno = params.get('alumno')
    try {
      const res = await fetch(`/api/teacher/diagnosticos/impreso/${quizId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(alumno ? { alumno } : { invitacion: Number(params.get('invitacion')) }),
          respuestas: Object.fromEntries(datos.preguntas.map((p) => [String(p.indice), marca(p.indice)])),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEstado('guardado')
    } catch {
      setEstado('fallo')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={urlDeLaFicha(consulta)}
        className="cuerpo-s inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-semibold text-texto-suave hover:text-texto"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
        {T.volver}
      </Link>

      <header className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6">
        <h1 className="titulo-l text-texto">{T.cargaTitulo}</h1>
        <p className="cuerpo-s mt-1 text-texto">
          {datos.titulo} · {datos.alumno}
        </p>
        <p className="nota mt-2 text-texto-suave">{T.cargaDetalle}</p>
      </header>

      <ol className="flex flex-col gap-3">
        {datos.preguntas.map((p) => (
          <li key={p.indice} className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <p className="nota font-semibold text-texto-suave">{T.pregunta(p.indice + 1)}</p>
            <LaTeXRenderer content={p.enunciado} className="cuerpo-s mt-1 text-texto" />
            <p className="nota mt-2 text-texto-suave">
              <span className="font-semibold">{T.correcta}</span> <LaTeXRenderer content={p.correcta} className="inline" />
            </p>
            <div role="radiogroup" aria-label={T.pregunta(p.indice + 1)} className="mt-3 grid grid-cols-3 gap-2">
              {MARCAS.map((m) => {
                const elegida = marca(p.indice) === m
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    onClick={() => {
                      setMarcas((actual) => ({ ...actual, [p.indice]: m }))
                      setEstado('quieto')
                    }}
                    className={cn(
                      'cuerpo-s min-h-11 rounded-md border px-2 font-semibold',
                      elegida
                        ? m === 'bien'
                          ? 'border-logrado bg-logrado text-texto-sobre-accion'
                          : m === 'mal'
                            ? 'border-flojo bg-flojo text-texto-sobre-accion'
                            : 'border-texto bg-texto text-superficie-tarjeta'
                        : 'border-borde-fuerte bg-superficie-tarjeta text-texto',
                    )}
                  >
                    {T.marcas[m]}
                  </button>
                )
              })}
            </div>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-20 flex flex-col gap-2 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:bottom-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="cuerpo-s text-texto" aria-live="polite">
          {T.resumen(cuenta('bien'), cuenta('mal'), cuenta('sin_responder'))}
        </p>
        <Boton onClick={guardar} disabled={estado === 'guardando'}>
          {estado === 'guardando' && <Cargando />}
          {estado === 'guardando' ? T.guardando : T.guardar}
        </Boton>
      </div>
      <p role="status" className={cn('nota empty:hidden', estado === 'fallo' ? 'text-flojo' : 'text-texto-suave')}>
        {estado === 'guardado' ? T.guardado : estado === 'fallo' ? T.fallo : ''}
      </p>
      <p className="nota text-texto-suave">{T.cargaNota}</p>
    </div>
  )
}
