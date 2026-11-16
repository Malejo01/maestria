'use client'

import { Esqueleto, ZonaDeCarga } from '@/components/sistema/esqueleto'
import type { SeccionDocente } from '@/lib/navegacion'
import { MIS_ALUMNOS, MIS_TAREAS, PANEL_DOCENTE } from '@/lib/textos'

/**
 * Lo que se ve en el panel del docente mientras se leen los datos: la misma
 * forma que la pestaña real, en gris. Los títulos son los de verdad —se saben
 * sin esperar a nadie—, así que cuando llegan los datos el título no se mueve.
 *
 * Las medidas copian las de cada componente real (mis-alumnos.tsx,
 * mis-materias.tsx, mis-tareas.tsx). Si una de esas pantallas cambia de forma,
 * su esqueleto se cambia con ella.
 */

const TARJETA = 'rounded-lg border border-borde bg-superficie-tarjeta p-4'

/** Mis alumnos: filas de persona, y debajo los dos números de la semana. */
export function EsqueletoMisAlumnos() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="titulo-l text-texto">{MIS_ALUMNOS.titulo}</h1>
      <ZonaDeCarga etiqueta={PANEL_DOCENTE.cargando.alumnos} className="flex flex-col gap-3">
        {[0, 1, 2].map((fila) => (
          <div key={fila} className={`${TARJETA} flex flex-wrap items-center gap-x-4 gap-y-2`}>
            <Esqueleto className="size-[42px] shrink-0 rounded-md" />
            <span className="min-w-0 flex-1 basis-40 space-y-2">
              <Esqueleto className="h-4 w-36 max-w-full" />
              <Esqueleto className="h-3 w-24 max-w-full" />
            </span>
            <span className="order-3 flex w-full gap-2 pl-[58px] sm:order-none sm:w-auto sm:pl-0">
              <Esqueleto className="h-6 w-28 rounded-full" />
              <Esqueleto className="h-6 w-20 rounded-full" />
            </span>
            <Esqueleto className="h-3 w-[72px] shrink-0" />
          </div>
        ))}
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {[0, 1].map((numero) => (
            <div key={numero} className={TARJETA}>
              <Esqueleto className="h-3 w-24" />
              <Esqueleto className="mt-2 h-8 w-16" />
              <Esqueleto className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
      </ZonaDeCarga>
    </div>
  )
}

/** Las tarjetas de materia, en la misma grilla que las reales. */
export function EsqueletoTarjetasDeMateria() {
  return (
    <ZonaDeCarga
      etiqueta={PANEL_DOCENTE.cargando.materias}
      className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
    >
      {[0, 1, 2].map((tarjeta) => (
        <div key={tarjeta} className="rounded-lg border border-borde p-4">
          <div className="flex items-center gap-3">
            <Esqueleto className="size-10 shrink-0 rounded-md" />
            <Esqueleto className="h-4 flex-1" />
          </div>
          <Esqueleto className="mt-4 h-3 w-24" />
          <Esqueleto className="mt-2 h-3 w-32" />
          <Esqueleto className="mt-4 h-9 w-full rounded-md" />
        </div>
      ))}
    </ZonaDeCarga>
  )
}

/** Mis materias entera, para cuando todavía no se sabe ni quién es el docente. */
export function EsqueletoMisMaterias() {
  return (
    <div className={`${TARJETA} space-y-4`}>
      <ZonaDeCarga etiqueta={PANEL_DOCENTE.cargando.materias} className="flex flex-wrap gap-2">
        <Esqueleto className="h-9 w-36 rounded-xl" />
        <Esqueleto className="h-9 w-24 rounded-md" />
      </ZonaDeCarga>
      <EsqueletoTarjetasDeMateria />
    </div>
  )
}

/** Las tareas guardadas: una tarjeta por tarea, con su acción principal abajo. */
export function EsqueletoListaDeTareas() {
  return (
    <ZonaDeCarga etiqueta={PANEL_DOCENTE.cargando.tareas} className="grid gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3].map((tarea) => (
        <div key={tarea} className="flex flex-col gap-3 rounded-lg border border-borde p-4">
          <span className="space-y-2">
            <Esqueleto className="h-4 w-56 max-w-full" />
            <Esqueleto className="h-3 w-44 max-w-full" />
          </span>
          <Esqueleto className="h-10 w-44 max-w-full rounded-md" />
        </div>
      ))}
    </ZonaDeCarga>
  )
}

/** Mis tareas entera: los dos botones de arriba y la lista. */
export function EsqueletoMisTareas() {
  return (
    <div className="space-y-4">
      <ZonaDeCarga etiqueta={PANEL_DOCENTE.cargando.tareas} className="flex flex-wrap gap-2">
        <Esqueleto className="h-10 w-32 rounded-md" />
        <Esqueleto className="h-10 w-36 rounded-md" />
      </ZonaDeCarga>
      <section className={`${TARJETA} space-y-4`}>
        <h1 className="titulo-l text-texto">{MIS_TAREAS.titulo}</h1>
        <EsqueletoListaDeTareas />
      </section>
    </div>
  )
}

/** El panel antes de saber nada: la pestaña la dice la URL, que sí se sabe. */
export function EsqueletoPanel({ seccion }: { seccion: SeccionDocente }) {
  if (seccion === 'materias') return <EsqueletoMisMaterias />
  if (seccion === 'tareas') return <EsqueletoMisTareas />
  return <EsqueletoMisAlumnos />
}
