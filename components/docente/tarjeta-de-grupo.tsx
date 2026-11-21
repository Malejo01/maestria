'use client'

import { useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { MIS_GRUPOS as T } from '@/lib/textos'

export const rutaDelGrupo = (id: number) => `/teacher/grupos/${id}`

export interface DatosDeLaTarjeta {
  id: number
  name: string
  join_code: string
  member_count: number
  assignment_count: number
}

/** ¿El clic fue sobre algo que hace otra cosa (un botón, un link, un campo)? */
function esUnControl(evento: MouseEvent): boolean {
  const objetivo = evento.target as HTMLElement | null
  return Boolean(objetivo?.closest('button, a, input, select, textarea, [role="menuitem"]'))
}

/**
 * M3: en *Mis grupos*, la tarjeta entera abre la página del grupo.
 *
 * Con UN clic, no doble: en la web el doble clic no se descubre, en el celular
 * no existe y rompe la navegación con teclado. El nombre es un link de verdad
 * (Tab llega, Enter abre, se puede abrir en otra pestaña); el resto de la
 * tarjeta navega con el clic. Copiar link y Cerrar grupo hacen lo suyo sin
 * abrir la página: detienen la propagación. El foco visible se dibuja sobre
 * la tarjeta entera, no sólo sobre el nombre.
 */
export function TarjetaDeGrupo({
  grupo,
  materia,
  ocupado,
  alCerrar,
}: {
  grupo: DatosDeLaTarjeta
  materia: string
  ocupado: boolean
  alCerrar: () => void
}) {
  const router = useRouter()
  const [copiado, setCopiado] = useState(false)
  const ruta = rutaDelGrupo(grupo.id)
  const link = typeof window === 'undefined' ? `/aula/${grupo.join_code}` : `${window.location.origin}/aula/${grupo.join_code}`

  return (
    <li
      data-testid={`tarjeta-grupo-${grupo.id}`}
      onClick={(evento) => {
        // Seleccionar el link con el mouse para copiarlo a mano no es abrir.
        const seleccion = typeof window === 'undefined' ? '' : (window.getSelection?.()?.toString() ?? '')
        if (!esUnControl(evento) && !seleccion) router.push(ruta)
      }}
      className="cursor-pointer rounded-lg border border-borde bg-superficie-tarjeta p-4 transition-colors hover:border-borde-fuerte has-[.enlace-del-grupo:focus-visible]:outline has-[.enlace-del-grupo:focus-visible]:outline-2 has-[.enlace-del-grupo:focus-visible]:outline-offset-2 has-[.enlace-del-grupo:focus-visible]:outline-accion sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="nota text-texto-suave">{materia}</p>
          <h2 className="titulo-m text-texto">
            <a
              href={ruta}
              aria-label={T.abrir(grupo.name)}
              className="enlace-del-grupo inline-flex items-center gap-1 outline-none hover:underline"
              onClick={(evento) => {
                // Un clic común navega por el router (sin recargar); con Ctrl,
                // Cmd o el botón del medio, el navegador abre otra pestaña.
                if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return
                evento.preventDefault()
                evento.stopPropagation()
                router.push(ruta)
              }}
            >
              {grupo.name}
              <ChevronRight aria-hidden="true" className="size-5 text-texto-suave" strokeWidth={TRAZO_ICONO} />
            </a>
          </h2>
          <p className="nota mt-1 text-texto-suave">{T.resumen(grupo.join_code, grupo.member_count, grupo.assignment_count)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Boton
            variante="secundario"
            disabled={ocupado}
            onClick={(evento) => {
              evento.stopPropagation()
              alCerrar()
            }}
          >
            {T.cerrar}
          </Boton>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="nota min-w-0 break-all rounded-sm bg-superficie-base px-2 py-1 text-texto">{link}</code>
        <Boton
          variante="secundario"
          aria-label={T.copiarLink(grupo.name)}
          onClick={async (evento) => {
            evento.stopPropagation()
            try {
              await navigator.clipboard.writeText(link)
              setCopiado(true)
            } catch {
              setCopiado(false)
            }
          }}
        >
          {copiado ? <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
          <span aria-live="polite">{copiado ? T.copiado : T.copiar}</span>
        </Boton>
      </div>
    </li>
  )
}
