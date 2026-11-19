'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, UserMinus } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { CargaFallida } from '@/components/carga-fallida'
import { Boton } from '@/components/sistema/boton'
import { ConfirmarQuitar } from '@/components/docente/quitar-alumnos'
import { FichaPedagogica } from '@/components/docente/ficha-pedagogica'
import { SeccionDiagnostico } from '@/components/docente/seccion-diagnostico'
import type { FichaLeida } from '@/lib/fichas-server'
import { ChipTema } from '@/components/sistema/chip-tema'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import {
  RESPUESTAS_PARA_DOMINADO,
  RESPUESTAS_PARA_FLOJO,
  haceCuanto,
  resumirTemas,
  type EstadoTema,
  type TemaDeAlumno,
} from '@/lib/alumnos-docente'
import type { FichaAlumno as Ficha } from '@/lib/alumnos-docente-server'
import { CHIP_TEMA, FICHA_ALUMNO as T, MIS_ALUMNOS } from '@/lib/textos'
import { cn } from '@/lib/utils'

const TARJETA = 'rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6'

/**
 * La ficha de un alumno: el corazón del panel.
 *
 * Quién es y qué prepara, cómo le va tema por tema, los errores que se le
 * repiten y la planilla de sus prácticas. Arriba, una sola acción: asignarle
 * una tarea, con su materia ya elegida.
 */
export function FichaAlumno({ userId }: { userId: string }) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ahora, setAhora] = useState<Date | null>(null)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false)
  // J2: la ficha por secciones. null mientras se lee; si la 027 no corrió
  // (`disponible: false`) o la lectura falla, queda el campo único de siempre.
  const [pedagogica, setPedagogica] = useState<FichaLeida | null>(null)
  const router = useRouter()

  const leer = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/alumnos/${encodeURIComponent(userId)}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(res.status === 404 ? T.noEsTuAlumno : data?.error || `HTTP ${res.status}`)
      setFicha(data.ficha)
      setAhora(new Date())
      setError(null)
    } catch (causa) {
      setError(causa instanceof Error ? causa.message : String(causa))
    }
  }, [userId])

  useEffect(() => {
    void leer()
  }, [leer])

  useEffect(() => {
    let vigente = true
    fetch(`/api/teacher/fichas?alumno=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((datos: FichaLeida | null) => {
        if (vigente && datos) setPedagogica(datos)
      })
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [userId])

  const volver = (
    <Link
      href="/teacher"
      className="cuerpo-s inline-flex min-h-11 items-center gap-2 self-start rounded-sm font-semibold text-texto-suave hover:text-texto"
    >
      <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
      {T.volver}
    </Link>
  )

  if (error && !ficha) {
    return (
      <div className="flex flex-col gap-3">
        {volver}
        <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
      </div>
    )
  }
  if (!ficha || !ahora) return null

  const materiaId = ficha.materias[0]?.id ?? null

  return (
    <div className="flex flex-col gap-3">
      {volver}

      <header className={cn(TARJETA, 'flex flex-col gap-4 sm:flex-row sm:items-start')}>
        <span
          aria-hidden="true"
          className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-superficie-suave font-titulo text-[17px] font-extrabold text-accion"
        >
          {(ficha.nombre.trim()[0] ?? '?').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="titulo-l text-texto">{ficha.nombre}</h1>
          <p className="nota mt-1 text-texto-suave">
            {ficha.materias.map((materia) => materia.nombre).join(' · ')}
            {' · '}
            {ficha.ultimaVez
              ? T.ultimaPractica(haceCuanto(new Date(ficha.ultimaVez), ahora))
              : T.nuncaPractico}
            {ficha.sinCuenta ? ` · ${T.sinCuenta}` : ''}
          </p>
          {pedagogica && !pedagogica.disponible && <EditarContexto userId={ficha.userId} inicial={ficha.contexto} />}
        </div>
        <Boton className="shrink-0" asChild>
          <Link href={`/teacher?seccion=tareas&armar=1${materiaId ? `&materia=${materiaId}` : ''}`}>{T.asignar}</Link>
        </Boton>
      </header>

      <SeccionDiagnostico destino={{ alumno: ficha.userId }} />

      {pedagogica?.disponible && (
        <FichaPedagogica
          url={`/api/teacher/fichas?alumno=${encodeURIComponent(ficha.userId)}`}
          nombreInicial={pedagogica.nombre}
          inicial={pedagogica.ficha}
          materias={pedagogica.materias}
          alGuardar={(nombre) => setFicha((actual) => (actual ? { ...actual, nombre } : actual))}
        />
      )}

      <section className={TARJETA} aria-labelledby="ficha-temas">
        <h2 id="ficha-temas" className="titulo-m text-texto">
          {T.temas.titulo}
        </h2>
        <p className="nota mt-1 text-texto-suave">{T.temas.detalle(RESPUESTAS_PARA_FLOJO, RESPUESTAS_PARA_DOMINADO)}</p>
        {ficha.temas.length === 0 ? (
          <p className="cuerpo-s mt-4 text-texto-suave">{T.temas.vacio}</p>
        ) : (
          <GraficoDeTemas temas={ficha.temas} />
        )}
      </section>

      <section className={TARJETA} aria-labelledby="ficha-errores">
        <h2 id="ficha-errores" className="titulo-m text-texto">
          {T.errores.titulo}
        </h2>
        <p className="nota mt-1 text-texto-suave">{T.errores.detalle}</p>
        {ficha.errores.length === 0 ? (
          <p className="cuerpo-s mt-4 text-texto-suave">{T.errores.vacio}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {ficha.errores.map((error, indice) => (
              <li key={indice} className="border-l-2 border-flojo pl-3">
                <p className="cuerpo-s text-texto">{error.diagnostico}</p>
                <p className="nota text-texto-suave">
                  {error.tema} · {haceCuanto(new Date(error.detectadoEl), ahora)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={TARJETA} aria-labelledby="ficha-practicas">
        <h2 id="ficha-practicas" className="titulo-m text-texto">
          {T.planilla.titulo}
        </h2>
        <p className="nota mt-1 text-texto-suave">{T.planilla.detalle}</p>
        {ficha.intentos.length === 0 ? (
          <p className="cuerpo-s mt-4 text-texto-suave">{T.planilla.vacio}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="cuerpo-s w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-borde">
                  {[T.planilla.fecha, T.planilla.que, T.planilla.temas, T.planilla.resultado].map((titulo) => (
                    <th key={titulo} scope="col" className="etiqueta py-2 pr-3 uppercase text-texto-suave">
                      {titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ficha.intentos.map((intento) => (
                  <tr key={intento.id} className="border-b border-borde last:border-b-0">
                    <td className="whitespace-nowrap py-3 pr-3 align-top tabular-nums text-texto-suave">
                      {new Date(intento.completadoEl).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}
                    </td>
                    <td className="py-3 pr-3 align-top text-texto">{intento.tarea ?? T.planilla.practicaLibre}</td>
                    <td className="py-3 pr-3 align-top text-texto-suave">
                      <TemasDeIntento temas={intento.temas} />
                    </td>
                    <td className="whitespace-nowrap py-3 align-top tabular-nums text-texto">
                      {T.temas.aciertos(intento.correctas, intento.calificadas)}
                      {intento.sinCalificar > 0 && (
                        <span className="nota block text-texto-suave">{T.planilla.sinCalificar(intento.sinCalificar)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* J1: quitar es reversible y va al final, lejos de la acción principal. */}
      <div>
        <Boton variante="secundario" onClick={() => setConfirmandoQuitar(true)}>
          <UserMinus aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {MIS_ALUMNOS.quitarAlumno.boton}
        </Boton>
      </div>
      <ConfirmarQuitar
        quienes={confirmandoQuitar ? [{ userId: ficha.userId, nombre: ficha.nombre }] : null}
        lote={false}
        onCerrar={() => setConfirmandoQuitar(false)}
        alQuitar={() => router.push('/teacher')}
      />
    </div>
  )
}

/**
 * Los temas de una práctica, en la celda de la planilla: los primeros con su
 * nombre corto y el resto contado. El detalle entero queda en `title` (mouse)
 * y en el texto para lector de pantalla; no se pierde, sólo no ocupa la fila.
 */
function TemasDeIntento({ temas }: { temas: string[] }) {
  const { visibles, resto, completo } = resumirTemas(temas)
  if (visibles.length === 0) return null
  return (
    <span title={completo}>
      <span aria-hidden="true">
        {visibles.join(' · ')}
        {resto > 0 && <span className="whitespace-nowrap"> {T.planilla.masTemas(resto)}</span>}
      </span>
      <span className="sr-only">{completo}</span>
    </span>
  )
}

/** El color de la barra según el estado. El estado va además escrito al lado: nunca color solo. */
const BARRA: Record<EstadoTema, string> = {
  dominado: 'bg-logrado',
  flojo: 'bg-flojo',
  sin_datos: 'bg-borde-fuerte',
}

/**
 * Aciertos por tema, en barras horizontales.
 *
 * Barras y no otra forma porque el dato es una magnitud (qué proporción
 * responde bien) comparada entre categorías con nombres largos: los temas se
 * leen a la izquierda, sin rotar, y a 390 px entran igual. Un solo eje, de 0 a
 * 100 %. Los temas van del que peor le va al que mejor, que es el orden en que
 * el docente los quiere mirar.
 *
 * Es una lista de verdad (<ul>), con el nombre, el estado y la cuenta escritos
 * en cada fila: el gráfico se lee igual sin ver el color y con lector de
 * pantalla, así que no necesita una tabla aparte.
 */
function GraficoDeTemas({ temas }: { temas: TemaDeAlumno[] }) {
  const sinMovimiento = useReducedMotion()
  const proporcion = (tema: TemaDeAlumno) => (tema.calificadas > 0 ? tema.correctas / tema.calificadas : 0)
  const orden: Record<EstadoTema, number> = { flojo: 0, dominado: 1, sin_datos: 2 }
  const ordenados = [...temas].sort(
    (a, b) => orden[a.estado] - orden[b.estado] || proporcion(a) - proporcion(b) || a.tema.localeCompare(b.tema, 'es'),
  )

  return (
    <ul aria-label={T.temas.grafico} className="mt-4 flex flex-col gap-4">
      {ordenados.map((tema) => {
        const porcentaje = Math.round(proporcion(tema) * 100)
        return (
          <li key={tema.tema}>
            {/* En celular el resultado baja a su propio renglón; desde `sm` va
                a la derecha y NO se achica: el nombre largo es el que cede, a
                dos renglones como mucho, con el nombre entero en `title`. */}
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 sm:flex-nowrap">
              <span className="flex min-w-0 items-start gap-2">
                <span className="cuerpo-s line-clamp-2 min-w-0 font-semibold text-texto" title={tema.tema}>
                  {tema.tema}
                </span>
                <ChipTema tema={CHIP_TEMA[tema.estado]} estado={tema.estado} className="shrink-0" />
              </span>
              <span className="nota shrink-0 whitespace-nowrap tabular-nums text-texto-suave sm:pt-0.5">
                {tema.calificadas > 0
                  ? `${T.temas.porcentaje(porcentaje)} · ${T.temas.aciertos(tema.correctas, tema.calificadas)}`
                  : T.temas.aciertos(0, 0)}
              </span>
            </div>
            <div aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-superficie-base">
              <motion.div
                className={cn('h-full rounded-full', BARRA[tema.estado])}
                initial={sinMovimiento ? false : { width: 0 }}
                animate={{ width: `${porcentaje}%` }}
                transition={sinMovimiento ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Qué prepara el alumno y para cuándo: texto libre del docente, editable en el lugar. */
function EditarContexto({ userId, inicial }: { userId: string; inicial: string }) {
  const id = useId()
  const [valor, setValor] = useState(inicial)
  const [guardadoComo, setGuardadoComo] = useState(inicial)
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado' | 'fallo'>('quieto')

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    setEstado('guardando')
    try {
      const res = await fetch(`/api/teacher/alumnos/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contexto: valor }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setGuardadoComo(valor.trim())
      setEstado('guardado')
    } catch {
      setEstado('fallo')
    }
  }

  const cambio = valor.trim() !== guardadoComo

  return (
    <form onSubmit={guardar} className="mt-4 max-w-md" noValidate>
      <label htmlFor={id} className="nota mb-2 block font-semibold text-texto-suave">
        {T.contexto.etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={valor}
          onChange={(evento) => {
            setValor(evento.target.value)
            setEstado('quieto')
          }}
          placeholder={T.contexto.ejemplo}
          maxLength={120}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70"
        />
        <Boton type="submit" variante="secundario" disabled={!cambio || estado === 'guardando'}>
          {estado === 'guardando' && <Cargando />}
          {estado === 'guardando' ? T.contexto.guardando : T.contexto.guardar}
        </Boton>
      </div>
      <p role="status" className={cn('nota mt-2 empty:hidden', estado === 'fallo' ? 'text-flojo' : 'text-texto-suave')}>
        {estado === 'guardado' ? T.contexto.guardado : estado === 'fallo' ? T.contexto.fallo : ''}
      </p>
    </form>
  )
}
