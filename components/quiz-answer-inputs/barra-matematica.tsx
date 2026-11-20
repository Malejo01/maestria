'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { SIMBOLOS, insertar, textoALatex } from '@/lib/notacion-matematica'
import { TECLADO_MATEMATICO as T } from '@/lib/textos'

/**
 * L3: la barra de símbolos debajo del campo, y la vista previa de lo escrito.
 *
 * El campo guarda texto plano: la barra sólo inserta caracteres en el cursor
 * (la potencia y la raíz dejan el cursor listo para el exponente o el
 * radicando) y la vista previa dibuja con el KaTeX que ya estaba cargado. Sin
 * MathLive ni editores pesados. Los botones miden 44 px y la barra se desplaza
 * en horizontal en el celular; va pegada al campo, que al enfocarse queda
 * justo encima del teclado.
 */
export function BarraMatematica({
  campo,
  valor,
  alCambiar,
  deshabilitada = false,
}: {
  campo: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  valor: string
  alCambiar: (texto: string) => void
  deshabilitada?: boolean
}) {
  const vista = textoALatex(valor)
  // Dónde dejar el cursor después de insertar. Se aplica apenas React pone el
  // texto nuevo en el campo (no en un requestAnimationFrame, que en una
  // pestaña en segundo plano corre tarde y lo devuelve a un lugar viejo).
  const cursorPendiente = useRef<number | null>(null)
  useLayoutEffect(() => {
    const posicion = cursorPendiente.current
    const el = campo.current
    if (posicion === null || !el) return
    cursorPendiente.current = null
    el.focus()
    el.setSelectionRange(posicion, posicion)
  }, [valor, campo])

  return (
    <div className="space-y-2">
      {!deshabilitada && (
        <div
          role="toolbar"
          aria-label={T.etiqueta}
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {SIMBOLOS.map(({ clave, simbolo }) => (
            <button
              key={clave}
              type="button"
              aria-label={T.nombres[clave as keyof typeof T.nombres]}
              title={T.nombres[clave as keyof typeof T.nombres]}
              // Sin robarle el foco al campo: el cursor sigue donde estaba.
              onMouseDown={(evento) => evento.preventDefault()}
              onClick={() => {
                const el = campo.current
                const desde = el?.selectionStart ?? valor.length
                const hasta = el?.selectionEnd ?? valor.length
                const siguiente = insertar(valor, desde, hasta, simbolo)
                cursorPendiente.current = siguiente.cursor
                alCambiar(siguiente.texto)
              }}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo font-semibold text-texto hover:border-texto"
            >
              {simbolo.etiqueta}
            </button>
          ))}
        </div>
      )}
      {vista && (
        <p className="nota flex flex-wrap items-baseline justify-center gap-2 text-texto-suave" aria-live="polite">
          <span>{T.vistaPrevia}</span>
          <span className="cuerpo text-texto">
            <LaTeXRenderer content={vista} />
          </span>
        </p>
      )}
    </div>
  )
}
