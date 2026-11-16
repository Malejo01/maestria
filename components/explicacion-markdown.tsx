'use client'

import { Fragment, useMemo } from 'react'
import { LaTeXRenderer } from './latex-renderer'
import {
  parsearMarkdown,
  type Bloque,
  type BloqueLista,
  type NodoEnLinea,
} from '@/lib/markdown-explicacion'

interface ExplicacionMarkdownProps {
  content: string
  /**
   * `compacto` es para las tarjetas chicas (resultados, Mi progreso), donde la
   * explicación es una nota al pie de la pregunta y no el centro de la pantalla.
   */
  tamano?: 'normal' | 'compacto'
  className?: string
}

/**
 * Las explicaciones que escribe la IA llegan en Markdown con fórmulas. Esto
 * las muestra formateadas; antes se imprimían con `whitespace-pre-wrap` y el
 * alumno leía los `##` y los `**` tal cual. El parseo está en
 * `lib/markdown-explicacion.ts`; las fórmulas las sigue dibujando
 * `LaTeXRenderer`, con sus mismas reglas.
 *
 * Tipografía: los encabezados van en la familia de Títulos (`--font-display`)
 * y el resto en la de Texto. El encabezado más alto que sale de acá es un
 * `<h3>`: estas explicaciones siempre viven debajo de un título de la pantalla.
 */
export function ExplicacionMarkdown({ content, tamano = 'normal', className = '' }: ExplicacionMarkdownProps) {
  const bloques = useMemo(() => parsearMarkdown(content), [content])
  const compacto = tamano === 'compacto'

  return (
    <div
      className={`min-w-0 break-words font-[family-name:var(--font-texto)] text-texto ${
        compacto ? 'space-y-2 text-[12.5px] leading-[18px]' : 'space-y-3 text-sm leading-[21px]'
      } ${className}`}
    >
      {bloques.map((bloque, i) => (
        <BloqueMarkdown key={i} bloque={bloque} compacto={compacto} primero={i === 0} />
      ))}
    </div>
  )
}

function EnLinea({ nodos }: { nodos: NodoEnLinea[] }) {
  return (
    <>
      {nodos.map((nodo, i) => {
        switch (nodo.tipo) {
          case 'texto':
            return <Fragment key={i}>{nodo.texto}</Fragment>
          case 'formula':
            return <LaTeXRenderer key={i} content={nodo.crudo} />
          case 'codigo':
            return (
              <code
                key={i}
                className="rounded-[var(--radio-sm)] border border-borde bg-superficie-base px-1 py-0.5 font-mono text-[0.92em]"
              >
                {nodo.texto}
              </code>
            )
          case 'negrita':
            return (
              <strong key={i} className="font-bold">
                <EnLinea nodos={nodo.hijos} />
              </strong>
            )
          case 'cursiva':
            return (
              <em key={i}>
                <EnLinea nodos={nodo.hijos} />
              </em>
            )
        }
      })}
    </>
  )
}

function Lista({ lista }: { lista: BloqueLista }) {
  const items = lista.items.map((item, i) => (
    <li key={i} className="pl-1">
      <span className="whitespace-pre-line">
        <EnLinea nodos={item.contenido} />
      </span>
      {item.sublistas.map((sublista, j) => (
        <div key={j} className="mt-1.5">
          <Lista lista={sublista} />
        </div>
      ))}
    </li>
  ))
  return lista.ordenada ? (
    <ol start={lista.inicio} className="list-decimal space-y-1.5 pl-5 marker:font-bold marker:text-texto-suave">
      {items}
    </ol>
  ) : (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-texto-suave">{items}</ul>
  )
}

function BloqueMarkdown({ bloque, compacto, primero }: { bloque: Bloque; compacto: boolean; primero: boolean }) {
  switch (bloque.tipo) {
    case 'encabezado': {
      const titulo = 'font-[family-name:var(--font-display)] font-extrabold tracking-[-0.02em] text-texto'
      // Aire arriba para separar secciones, salvo en lo primero del texto.
      const aire = primero ? '' : compacto ? 'pt-1' : 'pt-2'
      if (bloque.nivel <= 2) {
        return (
          <h3 className={`${titulo} ${aire} ${compacto ? 'text-sm leading-[19px]' : 'text-base leading-[21px]'}`}>
            <EnLinea nodos={bloque.contenido} />
          </h3>
        )
      }
      return (
        <h4 className={`${titulo} ${aire} ${compacto ? 'text-[12.5px] leading-[18px]' : 'text-sm leading-[19px]'}`}>
          <EnLinea nodos={bloque.contenido} />
        </h4>
      )
    }
    case 'parrafo':
      return (
        <p className="whitespace-pre-line">
          <EnLinea nodos={bloque.contenido} />
        </p>
      )
    case 'lista':
      return <Lista lista={bloque} />
    case 'codigo':
      return (
        <pre className="overflow-x-auto rounded-[var(--radio-md)] border border-borde bg-superficie-base p-3 font-mono text-[0.92em] leading-[1.5]">
          <code>{bloque.texto}</code>
        </pre>
      )
    case 'formula':
      return (
        <div className="overflow-x-auto text-center">
          <LaTeXRenderer content={bloque.crudo} />
        </div>
      )
    case 'cita':
      return (
        <blockquote className="whitespace-pre-line border-l-2 border-borde pl-3 text-texto-suave">
          <EnLinea nodos={bloque.contenido} />
        </blockquote>
      )
    case 'separador':
      return <hr className="border-borde" />
  }
}
