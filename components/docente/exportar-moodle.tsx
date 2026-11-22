'use client'

import { Download } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { FormatoMoodle } from '@/lib/moodle-xml'
import { EXPORTAR_MOODLE as T } from '@/lib/textos'

const ITEM = 'min-h-11 cursor-pointer flex-col items-start gap-0.5 rounded-sm px-3 py-2 focus:bg-superficie-suave focus:text-texto'

/**
 * Ronda T · F1 — "Exportar a Moodle" con el formato: Moodle XML (recomendado:
 * lleva todos los tipos de pregunta) o GIFT (el de siempre). `como="enlace"`
 * es el botón chico del diálogo de mandar la tarea.
 */
export function ExportarMoodle({
  onExportar,
  exportando = false,
  como = 'boton',
}: {
  onExportar: (formato: FormatoMoodle) => void
  exportando?: boolean
  como?: 'boton' | 'enlace'
}) {
  const contenido = (
    <>
      {exportando ? <Cargando /> : <Download aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />}
      {exportando ? T.exportando : T.boton}
    </>
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={exportando}>
        {como === 'boton' ? (
          <Boton variante="secundario" disabled={exportando}>
            {contenido}
          </Boton>
        ) : (
          <button
            type="button"
            disabled={exportando}
            className="cuerpo-s inline-flex min-h-11 items-center gap-2 rounded-sm text-texto-suave hover:text-texto disabled:opacity-60"
          >
            {contenido}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem className={ITEM} onSelect={() => onExportar('xml')} data-formato-moodle="xml">
          <span className="cuerpo-s font-semibold text-texto">{T.xml}</span>
          <span className="nota text-texto-suave">{T.xmlDetalle}</span>
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} onSelect={() => onExportar('gift')} data-formato-moodle="gift">
          <span className="cuerpo-s font-semibold text-texto">{T.gift}</span>
          <span className="nota text-texto-suave">{T.giftDetalle}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
