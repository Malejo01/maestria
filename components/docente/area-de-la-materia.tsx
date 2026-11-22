'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { AREA_IDS, CARACTERES, PERFILES, esAreaId, esCaracter, type AreaId, type Caracter } from '@/lib/areas'
import { etiquetaDeCaracter, renglonDeArea } from '@/lib/area-interfaz'
import { AREA_DE_LA_MATERIA as T } from '@/lib/textos'

/**
 * Ronda T · A3 — El área de la materia: un renglón con "Cambiar". Nunca es un
 * paso obligatorio ni bloquea nada; con confianza baja dice "Nos parece que
 * es…".
 */
export function AreaDeLaMateria({
  area,
  confianza,
  origen,
  onCambiar,
  deshabilitado = false,
}: {
  area: AreaId
  confianza?: number | null
  origen?: string | null
  onCambiar: (area: AreaId) => void
  deshabilitado?: boolean
}) {
  return (
    <div className="flex min-w-0 items-start gap-2" data-area={area}>
      <p className="cuerpo-s min-w-0 flex-1 break-words pt-3 text-texto-suave">{renglonDeArea(area, confianza, origen)}</p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={deshabilitado}>
          <Button type="button" variant="ghost" size="sm" className="min-h-11 shrink-0 px-2 text-accion" aria-label={T.cambiarArea}>
            {T.cambiar}
            <ChevronDown className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[60vh] overflow-y-auto">
          <DropdownMenuLabel>{T.elegirArea}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={area} onValueChange={(valor) => esAreaId(valor) && valor !== area && onCambiar(valor)}>
            {AREA_IDS.map((id) => (
              <DropdownMenuRadioItem key={id} value={id} className="min-h-11">
                {PERFILES[id].nombre}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** El chip de una unidad: "Con cálculos" / "Conceptual" / "Mixta", que se puede cambiar. */
export function ChipDeCaracter({
  unidad,
  caracter,
  onCambiar,
  deshabilitado = false,
}: {
  unidad: string
  caracter: Caracter
  onCambiar: (caracter: Caracter) => void
  deshabilitado?: boolean
}) {
  const etiqueta = etiquetaDeCaracter(caracter)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={deshabilitado}>
        <button
          type="button"
          className="nota inline-flex min-h-11 items-center gap-1 rounded-full border border-borde bg-superficie-suave px-3 text-texto hover:border-accion focus-visible:outline-2 focus-visible:outline-accion"
          aria-label={T.cambiarCaracter(unidad, etiqueta)}
          data-caracter={caracter}
        >
          {etiqueta}
          <ChevronDown className="size-3.5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{T.elegirCaracter}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={caracter} onValueChange={(valor) => esCaracter(valor) && valor !== caracter && onCambiar(valor)}>
          {CARACTERES.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="min-h-11 flex-col items-start gap-0">
              <span>{etiquetaDeCaracter(c)}</span>
              <span className="nota text-texto-suave">{T.caracterAyuda[c]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
