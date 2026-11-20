'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CONSULTA_DE_ESCRITORIO,
  accionDeTecla,
  moverEnOpciones,
  type AccionDeAtajo,
  type EstadoParaAtajos,
} from '@/lib/atajos-cuestionario'
import { ATAJOS as T } from '@/lib/textos'

/** El atributo que marca cada opción del cuestionario, para mover el foco con ↑/↓. */
export const ATRIBUTO_DE_OPCION = 'data-opcion-cuestionario'

/** ¿Escritorio? Puntero fino y 768 px o más. Del lado del servidor, no. */
export function useEsEscritorio(): boolean {
  const [es, setEs] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const consulta = window.matchMedia(CONSULTA_DE_ESCRITORIO)
    const actualizar = () => setEs(consulta.matches)
    actualizar()
    consulta.addEventListener?.('change', actualizar)
    return () => consulta.removeEventListener?.('change', actualizar)
  }, [])
  return es
}

function enCampoDeTexto(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

/** Cualquier diálogo abierto en la página (salir, explicación, cambios sin guardar…). */
function hayDialogoAbierto(): boolean {
  return Boolean(document.querySelector('[role="dialog"], [role="alertdialog"]'))
}

/** ↑/↓ con el foco fuera de las opciones: entra a la elegida, o a la primera (última). */
function moverFoco(delta: 1 | -1) {
  const opciones = [...document.querySelectorAll<HTMLElement>(`[${ATRIBUTO_DE_OPCION}]`)]
  if (opciones.length === 0) return
  const actual = opciones.indexOf(document.activeElement as HTMLElement)
  const elegida = opciones.findIndex((o) => o.getAttribute('aria-checked') === 'true')
  const desde = actual >= 0 ? actual : elegida >= 0 ? elegida - delta : null
  opciones[moverEnOpciones(desde, delta, opciones.length)]?.focus()
}

/**
 * L2: escucha el teclado en escritorio y ejecuta la acción que corresponde
 * (lib/atajos-cuestionario.ts decide cuál). `estado` y `acciones` se leen en
 * el momento de la tecla, así el listener se registra una sola vez.
 */
export function useAtajosDeCuestionario({
  activo,
  estado,
  acciones,
}: {
  activo: boolean
  estado: Omit<EstadoParaAtajos, 'enCampoDeTexto' | 'dialogoAbierto'> & { dialogoAbierto: boolean }
  acciones: Partial<Record<Exclude<AccionDeAtajo['tipo'], 'mover'>, (accion: AccionDeAtajo) => void>>
}) {
  const ultimo = useRef({ estado, acciones })
  // Lo último que se dibujó, para el listener (que se registra una sola vez).
  useLayoutEffect(() => {
    ultimo.current = { estado, acciones }
  })

  useEffect(() => {
    if (!activo) return
    function alPresionar(evento: KeyboardEvent) {
      if (evento.defaultPrevented || evento.isComposing) return
      // Enter o Espacio sobre otro botón o link (Explicar con IA, Salir…) es
      // de ese botón; sobre una opción, el atajo decide.
      const foco = document.activeElement as HTMLElement | null
      if ((evento.key === 'Enter' || evento.key === ' ') && foco?.closest('button, a') && !foco.closest(`[${ATRIBUTO_DE_OPCION}]`)) return
      const { estado: actual, acciones: hacer } = ultimo.current
      const accion = accionDeTecla(evento, {
        ...actual,
        enCampoDeTexto: enCampoDeTexto(),
        dialogoAbierto: actual.dialogoAbierto || hayDialogoAbierto(),
      })
      if (!accion) return
      if (accion.tipo === 'mover') {
        evento.preventDefault()
        moverFoco(accion.delta)
        return
      }
      const ejecutar = hacer[accion.tipo]
      if (!ejecutar) return
      evento.preventDefault()
      ejecutar(accion)
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [activo])
}

const CLAVE_PISTA = 'maestria:atajos-pista-oculta'

function leerPistaOculta(): boolean {
  try {
    return window.localStorage.getItem(CLAVE_PISTA) === '1'
  } catch {
    return false
  }
}

/** La línea discreta debajo de las opciones. Se puede ocultar, y queda oculta. */
export function PistaDeAtajos() {
  const [oculta, setOculta] = useState(true)
  useEffect(() => setOculta(leerPistaOculta()), [])
  if (oculta) return null
  return (
    <p className="nota flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-texto-suave">
      <span>{T.pista}</span>
      <button
        type="button"
        className="underline underline-offset-2 hover:text-texto"
        onClick={() => {
          setOculta(true)
          try {
            window.localStorage.setItem(CLAVE_PISTA, '1')
          } catch {
            // Sin almacenamiento, se oculta sólo por ahora.
          }
        }}
      >
        {T.ocultar}
      </button>
    </p>
  )
}

/** La ayuda que abre `?`: todos los atajos. No es un diálogo, para que `?` la vuelva a cerrar. */
export function AyudaDeAtajos({ alCerrar }: { alCerrar: () => void }) {
  return (
    <section aria-label={T.ayudaTitulo} className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="cuerpo-s font-bold text-texto">{T.ayudaTitulo}</h2>
        <button type="button" className="nota underline underline-offset-2 text-texto-suave hover:text-texto" onClick={alCerrar}>
          {T.cerrarAyuda}
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {T.lista.map(([teclas, que]) => (
          <div key={teclas} className="contents">
            <dt className="nota font-semibold text-texto">
              <kbd>{teclas}</kbd>
            </dt>
            <dd className="nota text-texto-suave">{que}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
