'use client'

import { useCallback, useId, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import {
  ariaSort,
  estadoALaUrl,
  estadoDesdeLaUrl,
  tocarEncabezado,
  type Columna,
  type EstadoDePlanilla,
  type Filtro,
} from '@/lib/planilla-grupo'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * M4: el orden, el filtro y la búsqueda de una planilla viven en la URL
 * (`?orden=promedio&dir=desc&filtro=debajo`): volver atrás, recargar o pasar
 * el link deja la planilla como estaba. Con `prefijo`, dos planillas en la
 * misma página (la del grupo y la de una tarea) no se pisan.
 */
export function useEstadoDePlanilla(prefijo = '') {
  const router = useRouter()
  const ruta = usePathname()
  const consulta = useSearchParams()
  const texto = consulta?.toString() ?? ''
  const estado = useMemo(() => estadoDesdeLaUrl(new URLSearchParams(texto), prefijo), [texto, prefijo])

  const cambiar = useCallback(
    (nuevo: EstadoDePlanilla) => {
      const params = estadoALaUrl(nuevo, new URLSearchParams(texto), prefijo)
      const siguiente = params.toString()
      router.replace(`${ruta}${siguiente ? `?${siguiente}` : ''}`, { scroll: false })
    },
    [router, ruta, texto, prefijo],
  )

  return { estado, cambiar }
}

/** Un encabezado que ordena: el `th` lleva `aria-sort` y la flecha se ve. */
export function EncabezadoOrdenable({
  columna,
  etiqueta,
  estado,
  onCambiar,
  className,
}: {
  columna: Columna
  etiqueta: string
  estado: EstadoDePlanilla
  onCambiar: (estado: EstadoDePlanilla) => void
  className?: string
}) {
  const orden = ariaSort(estado, columna)
  const Flecha = orden === 'ascending' ? ArrowUp : orden === 'descending' ? ArrowDown : ArrowUpDown
  return (
    <th scope="col" aria-sort={orden} className={cn('p-0 text-left', className)}>
      <button
        type="button"
        onClick={() => onCambiar(tocarEncabezado(estado, columna))}
        aria-label={PAGINA_DEL_GRUPO.planilla.ordenarPor(etiqueta)}
        className={cn(
          'nota flex min-h-11 w-full items-center gap-1 px-3 py-2 text-left font-semibold uppercase tracking-wider hover:text-texto',
          orden === 'none' ? 'text-texto-suave' : 'text-texto',
        )}
      >
        {etiqueta}
        <Flecha
          aria-hidden="true"
          className={cn('size-3.5 shrink-0', orden === 'none' && 'opacity-40')}
          strokeWidth={TRAZO_ICONO}
        />
      </button>
    </th>
  )
}

/** Buscar por nombre y los filtros rápidos. */
export function BarraDePlanilla({
  estado,
  onCambiar,
  filtros,
}: {
  estado: EstadoDePlanilla
  onCambiar: (estado: EstadoDePlanilla) => void
  filtros: { id: Filtro; etiqueta: string }[]
}) {
  const id = useId()
  const T = PAGINA_DEL_GRUPO.planilla
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <label htmlFor={id} className="sr-only">
        {T.buscar}
      </label>
      <div className="relative sm:w-64">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-suave"
          strokeWidth={TRAZO_ICONO}
        />
        <input
          id={id}
          type="search"
          value={estado.busqueda}
          onChange={(evento) => onCambiar({ ...estado, busqueda: evento.target.value })}
          placeholder={T.buscar}
          className="h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta pl-9 pr-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70"
        />
      </div>
      <div role="group" aria-label={T.filtros.etiqueta} className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={estado.filtro === f.id}
            onClick={() => onCambiar({ ...estado, filtro: f.id })}
            className={cn(
              'nota min-h-9 rounded-full border px-3 font-semibold',
              estado.filtro === f.id
                ? 'border-accion bg-accion text-texto-sobre-accion'
                : 'border-borde-fuerte bg-superficie-tarjeta text-texto hover:border-accion',
            )}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Las clases de la tabla: el contenedor se desplaza (en los dos sentidos) para
 * que el encabezado quede fijo arriba y la columna Alumno fija a la izquierda.
 * Con `overflow-x` solo, un `sticky top-0` no tiene contra qué pegarse.
 */
export const CLASES_DE_TABLA = {
  contenedor: 'max-h-[70vh] overflow-auto rounded-md border border-borde',
  tabla: 'w-full min-w-[640px] border-separate border-spacing-0 text-sm',
  encabezado: 'sticky top-0 z-10 border-b border-borde bg-superficie-tarjeta',
  primeraCelda: 'sticky left-0 z-[1] bg-superficie-tarjeta',
  esquina: 'sticky left-0 top-0 z-20 border-b border-borde bg-superficie-tarjeta',
  celda: 'border-b border-borde px-3 py-2',
} as const
