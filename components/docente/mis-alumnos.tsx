'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { AgregarAlumno } from '@/components/docente/agregar-alumno'
import { EsqueletoMisAlumnos } from '@/components/docente/esqueletos'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { ChipTema } from '@/components/sistema/chip-tema'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { haceCuanto, temaCorto, type FilaAlumno } from '@/lib/alumnos-docente'
import type { MisAlumnos as Datos } from '@/lib/alumnos-docente-server'
import { pedirJson } from '@/lib/pedir-json'
import { MIS_ALUMNOS as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

type Vista = 'lista' | 'planilla'

/**
 * Mis alumnos: la pantalla de inicio del docente.
 *
 * Una fila por persona (design-reference/sistema/componentes/TarjetaAlumno):
 * inicial, quién es, qué prepara, cómo le va y cuándo fue la última vez. Cierra
 * con UNA sugerencia que termina en un botón, y con dos números de la semana.
 *
 * El mismo listado se puede ver como planilla: las mismas personas, con todos
 * sus números en columnas.
 */
export function MisAlumnos({
  agregarAbierto,
  onAgregarCambia,
  onArmarTarea,
  refrescarCon,
}: {
  agregarAbierto: boolean
  onAgregarCambia: (abierto: boolean) => void
  /** Lleva a armar una tarea, con la materia ya elegida si se sabe cuál. */
  onArmarTarea: (materiaId: number | null) => void
  /**
   * I5: cuando cambia, se vuelve a leer. Al crear la primera materia la
   * tarjeta de hitos decía "2 de 4 pasos" y acá seguía "Primero armá tu
   * materia" hasta recargar: dos mensajes que se contradicen en el primer
   * logro del docente.
   */
  refrescarCon?: unknown
}) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>('lista')
  // Se fija al recibir los datos: "hace 2 d" no puede depender del reloj al dibujar.
  const [ahora, setAhora] = useState<Date | null>(null)

  const leer = useCallback(async () => {
    const res = await pedirJson<Datos>('/api/teacher/alumnos')
    if ('error' in res) {
      setError(res.error)
      return
    }
    setError(null)
    setDatos(res.data)
    setAhora(new Date())
  }, [])

  useEffect(() => {
    void leer()
  }, [leer, refrescarCon])

  async function quitar(invitacionId: number) {
    await fetch(`/api/teacher/alumnos/invitaciones/${invitacionId}`, { method: 'DELETE' }).catch(() => null)
    void leer()
  }

  if (error && !datos) return <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leer} />
  // Antes devolvía null: la pantalla de inicio del docente quedaba en blanco
  // mientras respondía el servidor.
  if (!datos || !ahora) return <EsqueletoMisAlumnos />

  const { alumnos, sugerencia, resumen, materias } = datos

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        {alumnos.length > 0 && (
          <div role="group" aria-label={T.vista.etiqueta} className="flex gap-2">
            {(['lista', 'planilla'] as const).map((opcion) => (
              <Boton
                key={opcion}
                variante="secundario"
                aria-pressed={vista === opcion}
                className="aria-pressed:border-texto"
                onClick={() => setVista(opcion)}
              >
                {T.vista[opcion]}
              </Boton>
            ))}
          </div>
        )}
      </div>

      {alumnos.length === 0 ? (
        <Vacio hayMateria={materias.length > 0} onAgregar={() => onAgregarCambia(true)} />
      ) : vista === 'lista' ? (
        <ul className="flex flex-col gap-3">
          {alumnos.map((alumno) => (
            <li key={alumno.clave}>
              <Fila alumno={alumno} ahora={ahora} onQuitar={quitar} />
            </li>
          ))}
        </ul>
      ) : (
        <Planilla alumnos={alumnos} ahora={ahora} />
      )}

      {sugerencia && (
        <Aparecer>
          <section className="mt-1 flex flex-col gap-3 rounded-lg border border-accion-tenue-borde bg-accion-tenue p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="cuerpo-s font-bold text-texto">
                {sugerencia.dias !== null
                  ? T.sugerencia.inactivo(sugerencia.nombre.split(' ')[0], sugerencia.dias)
                  : T.sugerencia.leCuesta(sugerencia.nombre.split(' ')[0], temaCorto(sugerencia.tema ?? ''))}
              </h2>
              <p className="nota mt-0.5 text-texto-suave">
                {sugerencia.dias === null
                  ? T.sugerencia.reforzar
                  : sugerencia.tema
                    ? T.sugerencia.conTema(temaCorto(sugerencia.tema))
                    : T.sugerencia.sinTema}
              </p>
            </div>
            <Boton className="shrink-0" onClick={() => onArmarTarea(sugerencia.materiaId)}>
              {T.sugerencia.boton}
            </Boton>
          </section>
        </Aparecer>
      )}

      {alumnos.length > 0 && (
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <p className="etiqueta uppercase text-texto-suave">{T.resumen.estaSemana}</p>
            <p className="mt-1 font-titulo text-[27px] font-extrabold leading-8 tracking-[-0.02em] text-texto">
              {resumen.tareasEstaSemana}
            </p>
            <p className="nota text-texto-suave">{T.resumen.tareasEntregadas(resumen.tareasEstaSemana)}</p>
          </div>
          <div className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <p className="etiqueta uppercase text-texto-suave">{T.resumen.temaMasFlojo}</p>
            {resumen.temaMasFlojo ? (
              <>
                <p className="titulo-m mt-2 text-flojo" title={resumen.temaMasFlojo.tema}>
                  {temaCorto(resumen.temaMasFlojo.tema)}
                </p>
                <p className="nota text-texto-suave">
                  {T.resumen.deAlumnos(resumen.temaMasFlojo.alumnos, resumen.temaMasFlojo.deCuantos)}
                </p>
              </>
            ) : (
              <>
                <p className="titulo-m mt-2 text-texto">{T.resumen.sinTemaFlojo}</p>
                <p className="nota text-texto-suave">{T.resumen.sinTemaFlojoDetalle}</p>
              </>
            )}
          </div>
        </div>
      )}

      {materias.length > 0 && (
        <AgregarAlumno
          abierto={agregarAbierto}
          onCambiar={onAgregarCambia}
          materias={materias}
          alAgregar={leer}
        />
      )}
    </div>
  )
}

const CLASE_FILA = 'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4'

function Inicial({ nombre }: { nombre: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-[42px] shrink-0 items-center justify-center rounded-md bg-superficie-suave font-titulo text-[17px] font-extrabold text-accion"
    >
      {(nombre.trim()[0] ?? '?').toUpperCase()}
    </span>
  )
}

function Fila({
  alumno,
  ahora,
  onQuitar,
}: {
  alumno: FilaAlumno
  ahora: Date
  onQuitar: (invitacionId: number) => void
}) {
  const quien = (
    <span className="min-w-0 flex-1 basis-40">
      <span className="cuerpo block truncate text-texto">{alumno.nombre}</span>
      <span className="nota block truncate text-texto-suave">{alumno.contexto}</span>
    </span>
  )

  // Quien todavía no entró no tiene ficha: la fila no es un enlace.
  if (alumno.pendiente || !alumno.userId) {
    return (
      <div className={CLASE_FILA}>
        <Inicial nombre={alumno.nombre} />
        {quien}
        <span className="nota text-texto-suave">{T.todaviaNoEntro}</span>
        {alumno.pendiente && (
          <span className="flex items-center gap-2">
            <Boton variante="secundario" asChild>
              <a href={`/aula/${alumno.pendiente.codigo}`} target="_blank" rel="noopener noreferrer">
                {T.verLink}
              </a>
            </Boton>
            <Boton
              variante="icono"
              aria-label={T.quitar(alumno.nombre)}
              onClick={() => onQuitar(alumno.pendiente!.invitacionId)}
            >
              <X aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </Boton>
          </span>
        )}
      </div>
    )
  }

  return (
    <Link
      href={`/teacher/alumnos/${encodeURIComponent(alumno.userId)}`}
      aria-label={T.verFicha(alumno.nombre)}
      className={cn(CLASE_FILA, 'transition-colors hover:border-borde-fuerte')}
    >
      <Inicial nombre={alumno.nombre} />
      {quien}
      {alumno.chips.length > 0 && (
        <span className="order-3 flex w-full min-w-0 gap-2 pl-[58px] sm:order-none sm:w-auto sm:pl-0">
          {alumno.chips.map((chip) => (
            <ChipTema key={chip.tema} tema={temaCorto(chip.tema)} titulo={chip.tema} estado={chip.estado} />
          ))}
        </span>
      )}
      <span className="nota w-[72px] shrink-0 text-right text-texto-suave">
        {haceCuanto(alumno.ultimaVez ? new Date(alumno.ultimaVez) : null, ahora)}
      </span>
    </Link>
  )
}

function Vacio({ hayMateria, onAgregar }: { hayMateria: boolean; onAgregar: () => void }) {
  const textos = hayMateria ? T.vacio : T.sinMateria
  return (
    <section className="rounded-lg border border-borde bg-superficie-tarjeta p-6">
      <h2 className="titulo-m text-texto">{textos.titulo}</h2>
      <p className="cuerpo-s mt-1 max-w-prose text-texto-suave">{textos.detalle}</p>
      {/* Sin materia, el paso siguiente lo marca la tarjeta de primeros pasos
          de arriba: acá no se repite el botón, para que haya uno solo. */}
      {hayMateria && (
        <Boton className="mt-4" onClick={onAgregar}>
          {T.agregar}
        </Boton>
      )}
    </section>
  )
}

function Planilla({ alumnos, ahora }: { alumnos: FilaAlumno[]; ahora: Date }) {
  const P = T.planilla
  const celda = 'px-3 py-3 align-top'
  return (
    <div className="overflow-x-auto rounded-lg border border-borde bg-superficie-tarjeta">
      <table className="cuerpo-s w-full min-w-[720px] border-collapse text-left">
        <caption className="sr-only">{P.titulo}</caption>
        <thead>
          <tr className="border-b border-borde">
            {[P.alumno, P.prepara, P.ultima, P.practicas, P.tareas, P.aciertos, P.flojo].map((titulo) => (
              <th key={titulo} scope="col" className="etiqueta px-3 py-3 uppercase text-texto-suave">
                {titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alumnos.map((alumno) => (
            <tr key={alumno.clave} className="border-b border-borde last:border-b-0">
              <th scope="row" className={cn(celda, 'font-semibold text-texto')}>
                {alumno.userId ? (
                  <Link
                    href={`/teacher/alumnos/${encodeURIComponent(alumno.userId)}`}
                    className="rounded-sm underline-offset-2 hover:underline"
                  >
                    {alumno.nombre}
                  </Link>
                ) : (
                  alumno.nombre
                )}
              </th>
              <td className={cn(celda, 'text-texto-suave')}>{alumno.contexto}</td>
              <td className={cn(celda, 'text-texto-suave')}>
                {alumno.pendiente
                  ? T.todaviaNoEntro
                  : haceCuanto(alumno.ultimaVez ? new Date(alumno.ultimaVez) : null, ahora)}
              </td>
              <td className={cn(celda, 'tabular-nums text-texto')}>{alumno.intentos}</td>
              <td className={cn(celda, 'tabular-nums text-texto')}>{alumno.tareasEntregadas}</td>
              <td className={cn(celda, 'tabular-nums text-texto')}>
                {alumno.calificadas > 0
                  ? `${alumno.correctas} de ${alumno.calificadas} (${Math.round((alumno.correctas / alumno.calificadas) * 100)} %)`
                  : P.sinDato}
              </td>
              <td className={celda}>
                {alumno.temaMasFlojo ? <ChipTema tema={temaCorto(alumno.temaMasFlojo)} titulo={alumno.temaMasFlojo} estado="flojo" /> : <span className="text-texto-suave">{P.sinDato}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
