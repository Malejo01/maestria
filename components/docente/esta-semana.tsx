'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Aparecer } from '@/components/sistema/aparecer'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { aQuienSaludar, armarMensaje, linkDeWhatsApp } from '@/lib/compartir-tarea'
import { temaCorto } from '@/lib/alumnos-docente'
import { textoParaCopiar, type FilaDeLaSemana } from '@/lib/esta-semana'
import type { EstaSemana as Datos } from '@/lib/esta-semana-server'
import { pedirJson } from '@/lib/pedir-json'
import { ESTA_SEMANA as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * AB5 · «Esta semana» en el panel: una frase («3 de tus 4 alumnos practicaron
 * esta semana. A Juan le falta logaritmos.»), una fila por alumno y «Copiar
 * resumen» para el WhatsApp del profe. Si nadie practicó, el link de la
 * última tarea para reenviarlo. Sin alumnos no se dibuja (el arranque guía).
 */
export function EstaSemana({ refrescarCon }: { refrescarCon?: unknown }) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [copiado, setCopiado] = useState<'nada' | 'resumen' | 'link' | 'fallo'>('nada')

  const leer = useCallback(async () => {
    const res = await pedirJson<Datos>('/api/teacher/esta-semana')
    if (!('error' in res)) setDatos(res.data)
  }, [])

  useEffect(() => {
    void leer()
  }, [leer, refrescarCon])

  const mensaje = useMemo(() => {
    const tarea = datos?.ultimaTarea
    if (!tarea || typeof window === 'undefined') return null
    return armarMensaje({
      nombre: aQuienSaludar(tarea.alumnos),
      temas: tarea.temas,
      materia: tarea.materia,
      link: `${window.location.origin}/aula/${tarea.codigo}`,
      hasta: tarea.hasta ? new Date(tarea.hasta) : null,
    })
  }, [datos])

  // Una falla de esta tarjeta no tapa el panel: simplemente no aparece.
  if (!datos || datos.resumen.total === 0) return null
  const { resumen } = datos

  async function copiar(texto: string, que: 'resumen' | 'link') {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(que)
    } catch {
      setCopiado('fallo')
    }
  }

  return (
    <Aparecer>
      <section aria-labelledby="esta-semana-titulo" className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-5" data-esta-semana>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="esta-semana-titulo" className="cuerpo font-bold text-texto">
            {T.titulo}
          </h2>
          <p className="nota text-texto-suave">{T.detalle}</p>
        </div>
        <p className="cuerpo text-texto" data-frase>
          {resumen.frase}
        </p>

        <ul className="divide-y divide-borde rounded-md border border-borde">
          {resumen.filas.map((fila, i) => (
            <FilaAlumno key={`${fila.nombre}-${i}`} fila={fila} />
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          {resumen.nadie && mensaje ? (
            <>
              <Boton onClick={() => void copiar(mensaje, 'link')}>
                <span aria-live="polite">{copiado === 'link' ? T.copiado : T.reenviar}</span>
              </Boton>
              <Boton asChild variante="secundario" className="gap-1.5">
                <a href={linkDeWhatsApp(mensaje)} target="_blank" rel="noopener noreferrer">
                  {T.abrirWhatsApp}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                </a>
              </Boton>
            </>
          ) : resumen.nadie ? (
            <Boton asChild variante="secundario">
              <Link href="/teacher?seccion=tareas">{T.irATareas}</Link>
            </Boton>
          ) : null}
          <Boton variante={resumen.nadie ? 'secundario' : 'principal'} onClick={() => void copiar(textoParaCopiar(resumen, new Date()), 'resumen')}>
            <span aria-live="polite">{copiado === 'resumen' ? T.copiado : T.copiar}</span>
          </Boton>
        </div>
        {copiado === 'fallo' && <p className="nota text-flojo">{T.noSeCopio}</p>}
      </section>
    </Aparecer>
  )
}

function FilaAlumno({ fila }: { fila: FilaDeLaSemana }) {
  return (
    <li className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3" data-fila-semana>
      <div className="min-w-0">
        <p className="cuerpo-s font-semibold text-texto">{fila.nombre}</p>
        <p className={cn('nota', fila.practico ? 'text-texto-suave' : 'text-flojo')}>
          {fila.practico
            ? [T.practico, T.ejercicios(fila.ejercicios), fila.porcentaje === null ? null : T.bien(fila.porcentaje)].filter(Boolean).join(' · ')
            : T.noPractico}
        </p>
      </div>
      {fila.temaMasFlojo && (
        <p className="nota shrink-0 text-texto-suave">
          {T.leFalta}: <span className="font-semibold text-flojo">{temaCorto(fila.temaMasFlojo)}</span>
        </p>
      )}
    </li>
  )
}
