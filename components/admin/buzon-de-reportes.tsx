'use client'

import { correctaEnTexto } from '@/lib/tipos-moodle'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { fechaCorta } from '@/lib/avisos-de-reporte'
import { pedirJson } from '@/lib/pedir-json'
import { ESTADOS_DE_REPORTE, numeroDePregunta, siguienteEstado, type EstadoDeReporte } from '@/lib/reportes'
import type { ReporteParaLeer } from '@/lib/reportes-server'
import { rutaDeRevision } from '@/lib/tarea-docente'
import { BUZON as T } from '@/lib/textos'
import type { Question } from '@/lib/types'
import { cn } from '@/lib/utils'

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/** La respuesta correcta de una pregunta guardada, en texto. */
function correcta(p: Question): string {
  switch (p.type) {
    case 'multiple_choice':
      return p.options[p.correctAnswer] ?? '—'
    case 'true_false':
      return p.correctAnswer ? 'Verdadero' : 'Falso'
    case 'numeric':
      return String(p.correctAnswer)
    case 'short_answer':
      return p.acceptedAnswers.join(' / ')
    default:
      return correctaEnTexto(p) ?? '—'
  }
}

/**
 * M6: el buzón del admin. Lista (fecha, quién, dónde, texto), filtro por
 * estado, y cada reporte se abre para ver la pregunta como está guardada, con
 * el link a *Revisar y editar* ese cuestionario. nuevo → visto → resuelto.
 */
export function BuzonDeReportes() {
  const [filtro, setFiltro] = useState<EstadoDeReporte | 'todos'>('nuevo')
  const [reportes, setReportes] = useState<ReporteParaLeer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [vuelta, setVuelta] = useState(0)
  // N1: al resolver, un campo opcional con el mensaje para quien reportó.
  const [resolviendo, setResolviendo] = useState<number | null>(null)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let vigente = true
    const consulta = filtro === 'todos' ? '' : `?estado=${filtro}`
    void pedirJson<{ reportes: ReporteParaLeer[] }>(`/api/admin/reportes${consulta}`).then((respuesta) => {
      if (!vigente) return
      if ('error' in respuesta) setError(respuesta.error)
      else {
        setError(null)
        setReportes(respuesta.data.reportes)
      }
    })
    return () => {
      vigente = false
    }
  }, [filtro, vuelta])

  const releer = useCallback(() => setVuelta((n) => n + 1), [])

  async function cambiar(id: number, estado: EstadoDeReporte, conMensaje?: string) {
    setOcupado(id)
    const respuesta = await pedirJson(`/api/admin/reportes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conMensaje !== undefined ? { estado, mensaje: conMensaje } : { estado }),
    })
    setOcupado(null)
    setResolviendo(null)
    setMensaje('')
    if ('error' in respuesta) setError(respuesta.error)
    releer()
    // La marca del menú se relee sola al volver a abrirlo.
    window.dispatchEvent(new Event('maestria:reportes-cambiaron'))
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={T.filtros.etiqueta} className="flex flex-wrap gap-2">
        {(['todos', ...ESTADOS_DE_REPORTE] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filtro === f}
            onClick={() => {
              setFiltro(f)
              setReportes(null)
            }}
            className={cn(
              'nota min-h-9 rounded-full border px-3 font-semibold',
              filtro === f
                ? 'border-accion bg-accion text-texto-sobre-accion'
                : 'border-borde-fuerte bg-superficie-tarjeta text-texto hover:border-accion',
            )}
          >
            {T.filtros[f]}
          </button>
        ))}
      </div>

      {error && !reportes ? (
        <div className="rounded-lg border border-borde bg-superficie-tarjeta">
          <CargaFallida que={T.queCargamos} detalle={error} onReintentar={releer} />
        </div>
      ) : !reportes ? (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando /> {T.cargando}
        </p>
      ) : reportes.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reportes.map((r) => {
            const d = r.dondeQuedo
            const numero = numeroDePregunta(d.preguntaIndice)
            const quien = [
              r.quien.nombre || T.sinNombre,
              r.quien.rol ? (T.rol[r.quien.rol] ?? r.quien.rol) : null,
              r.quien.invitado ? T.invitado : null,
            ]
              .filter(Boolean)
              .join(' · ')
            const siguiente = siguienteEstado(r.estado)
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="nota text-texto-suave">
                    {fecha(r.creadoEl)} · {quien}
                  </p>
                  <span
                    className={cn(
                      'nota rounded-full border px-2 font-semibold',
                      r.estado === 'nuevo' ? 'border-accion text-accion' : r.estado === 'visto' ? 'border-borde-fuerte text-texto' : 'border-logrado text-logrado',
                    )}
                  >
                    {T.estado[r.estado]}
                  </span>
                </div>
                <p className="cuerpo whitespace-pre-wrap break-words text-texto">{r.texto}</p>
                <ul className="nota flex flex-col gap-0.5 text-texto-suave">
                  {r.ruta && <li>{T.ruta(r.ruta)}</li>}
                  {d.grupo && <li>{T.grupo(d.grupo)}</li>}
                  {d.cuestionario && numero !== null && <li>{T.pregunta(numero, d.cuestionario)}</li>}
                  {!d.cuestionario && d.preguntaId && <li>{T.preguntaSinCuestionario(d.preguntaId)}</li>}
                </ul>

                <div className="flex flex-wrap gap-2">
                  {r.pregunta && (
                    <Boton variante="secundario" aria-expanded={abierto === r.id} onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                      <ChevronDown
                        aria-hidden="true"
                        className={cn('transition-transform', abierto === r.id && 'rotate-180')}
                        strokeWidth={TRAZO_ICONO}
                      />
                      {abierto === r.id ? T.cerrar : T.abrir}
                    </Boton>
                  )}
                  {d.cuestionarioId !== null && (
                    <Boton variante="secundario" asChild>
                      <Link href={rutaDeRevision(d.cuestionarioId, '/teacher')}>
                        <ExternalLink aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                        {T.revisar}
                      </Link>
                    </Boton>
                  )}
                  {r.estado !== 'resuelto' && resolviendo !== r.id && (
                    <Boton
                      disabled={ocupado === r.id}
                      onClick={() => {
                        if (siguiente === 'resuelto') {
                          setResolviendo(r.id)
                          setMensaje('')
                        } else void cambiar(r.id, siguiente)
                      }}
                    >
                      {T.marcarComo[siguiente]}
                    </Boton>
                  )}
                  {r.estado === 'resuelto' && (
                    <Boton variante="secundario" disabled={ocupado === r.id} onClick={() => void cambiar(r.id, 'nuevo')}>
                      {T.marcarComo.nuevo}
                    </Boton>
                  )}
                </div>

                {resolviendo === r.id && (
                  <form
                    className="flex flex-col gap-2 rounded-md border border-borde bg-superficie-base p-3"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void cambiar(r.id, 'resuelto', mensaje)
                    }}
                  >
                    <label htmlFor={`mensaje-${r.id}`} className="nota font-semibold text-texto">
                      {T.mensajeEtiqueta}
                    </label>
                    <textarea
                      id={`mensaje-${r.id}`}
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      maxLength={1000}
                      rows={3}
                      aria-describedby={`mensaje-ayuda-${r.id}`}
                      className="cuerpo-s rounded-md border border-borde-fuerte bg-superficie-tarjeta p-2 text-texto"
                    />
                    <p id={`mensaje-ayuda-${r.id}`} className="nota text-texto-suave">
                      {T.mensajeAyuda}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Boton type="submit" disabled={ocupado === r.id}>
                        {T.confirmarResuelto}
                      </Boton>
                      <Boton type="button" variante="secundario" onClick={() => setResolviendo(null)}>
                        {T.cancelar}
                      </Boton>
                    </div>
                  </form>
                )}

                {r.aviso && (
                  <div className="nota flex flex-col gap-0.5 text-texto-suave">
                    <p className={cn(r.aviso.estado === 'visto' && 'text-logrado')}>
                      {r.aviso.estado === 'visto' && r.aviso.vistoEl
                        ? T.avisoVisto(fechaCorta(r.aviso.vistoEl))
                        : r.aviso.estado === 'pendiente'
                          ? T.avisoPendiente
                          : r.aviso.estado === 'delAdmin'
                            ? T.avisoDelAdmin
                            : r.aviso.estado === 'sinQuien'
                              ? T.avisoSinQuien
                              : T.avisoSinLa030}
                    </p>
                    {r.aviso.respuesta && (
                      <p className="whitespace-pre-wrap break-words">
                        {T.tuMensaje}: {r.aviso.respuesta}
                      </p>
                    )}
                  </div>
                )}

                {abierto === r.id && r.pregunta && (
                  <div className="flex flex-col gap-2 rounded-md border border-borde bg-superficie-base p-3">
                    <p className="nota font-semibold text-texto-suave">{T.laPregunta}</p>
                    <LaTeXRenderer content={r.pregunta.question} className="cuerpo-s text-texto" />
                    {r.pregunta.type === 'multiple_choice' && (
                      <ol className="cuerpo-s list-[upper-alpha] pl-6 text-texto">
                        {r.pregunta.options.map((o, i) => (
                          <li key={i}>
                            <LaTeXRenderer content={o} />
                          </li>
                        ))}
                      </ol>
                    )}
                    <p className="cuerpo-s text-texto">
                      <span className="font-semibold">{T.respuestaCorrecta}: </span>
                      <LaTeXRenderer content={correcta(r.pregunta)} />
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
