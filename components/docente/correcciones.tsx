'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { NIVELES, notaDeLosCriterios, type Correccion, type Nivel } from '@/lib/ensayo'
import type { EnsayoParaCorregir } from '@/lib/correcciones-server'
import { ENSAYO } from '@/lib/textos'

const T = ENSAYO.correcciones
const CAMPO = 'w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 py-2 cuerpo-s text-texto'

/** El borrador en pantalla: un nivel y una devolución por criterio, la nota y la devolución general. */
interface Borrador {
  niveles: (Nivel | '')[]
  devoluciones: string[]
  nota: string
  devolucion: string
}

function borradorDe(ensayo: EnsayoParaCorregir, s: Correccion | null): Borrador {
  return {
    niveles: ensayo.rubrica.map((_, i) => s?.criterios[i]?.nivel ?? ''),
    devoluciones: ensayo.rubrica.map((_, i) => s?.criterios[i]?.devolucion ?? ''),
    nota: s ? String(s.nota) : '',
    devolucion: s?.devolucion ?? '',
  }
}

function TarjetaDeEnsayo({ ensayo, onConfirmada }: { ensayo: EnsayoParaCorregir; onConfirmada: () => void }) {
  const [b, setB] = useState<Borrador>(() => borradorDe(ensayo, ensayo.sugerencia))
  const [sugerida, setSugerida] = useState(Boolean(ensayo.sugerencia))
  const [estado, setEstado] = useState<'quieto' | 'sugiriendo' | 'confirmando'>('quieto')
  const [error, setError] = useState<string | null>(null)

  const nivelCompleto = b.niveles.every((n) => n !== '')
  const notaNumero = Number(b.nota.replace(',', '.'))
  const notaValida = b.nota.trim() !== '' && Number.isFinite(notaNumero) && notaNumero >= 0 && notaNumero <= 10

  const cambiarNivel = (i: number, n: Nivel) =>
    setB((prev) => {
      const niveles = prev.niveles.map((x, j) => (j === i ? n : x))
      // La nota sigue a los niveles mientras el docente no la haya tocado a mano.
      const completos = niveles.every((x) => x !== '')
      return { ...prev, niveles, nota: completos && (prev.nota === '' || sugerida) ? String(notaDeLosCriterios(niveles.map((nivel) => ({ nivel: nivel as Nivel })))) : prev.nota }
    })

  async function sugerir() {
    setEstado('sugiriendo')
    setError(null)
    const r = await pedirJson<{ sugerencia: Correccion }>(`/api/teacher/correcciones/${ensayo.respuestaId}/sugerir`, { method: 'POST' })
    setEstado('quieto')
    if ('error' in r) return setError(T.noSePudoSugerir)
    setB(borradorDe(ensayo, r.data.sugerencia))
    setSugerida(true)
  }

  async function confirmar() {
    setEstado('confirmando')
    setError(null)
    const r = await pedirJson(`/api/teacher/correcciones/${ensayo.respuestaId}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criterios: b.niveles.map((nivel, i) => ({ nivel, devolucion: b.devoluciones[i] })),
        nota: notaNumero,
        devolucion: b.devolucion,
      }),
    })
    setEstado('quieto')
    if ('error' in r) return setError(T.noSePudoConfirmar)
    onConfirmada()
  }

  return (
    <article className="space-y-4 rounded-lg border border-borde bg-superficie-tarjeta p-4" data-ensayo={ensayo.respuestaId}>
      <header className="space-y-0.5">
        <h2 className="titulo-s text-texto">{ensayo.alumno}</h2>
        <p className="nota text-texto-suave">
          {ensayo.grupo} · {T.tarea(ensayo.tarea)}
        </p>
      </header>

      <section className="space-y-1">
        <h3 className="nota font-semibold text-texto">{T.consigna}</h3>
        <p className="cuerpo-s whitespace-pre-line text-texto">{ensayo.consigna}</p>
      </section>
      {ensayo.guia && (
        <section className="space-y-1">
          <h3 className="nota font-semibold text-texto">{T.guia}</h3>
          <p className="cuerpo-s whitespace-pre-line text-texto-suave">{ensayo.guia}</p>
        </section>
      )}
      <section className="space-y-1">
        <h3 className="nota font-semibold text-texto">{T.respuesta}</h3>
        <p className="cuerpo-s whitespace-pre-line rounded-md border border-borde bg-superficie-suave p-3 text-texto">{ensayo.respuesta}</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={sugerir} disabled={estado !== 'quieto'}>
          <Sparkles className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {estado === 'sugiriendo' ? T.sugiriendo : T.sugerir}
        </Boton>
        {sugerida && <p className="nota text-texto-suave">{T.sugerida}</p>}
      </div>

      <ol className="space-y-3">
        {ensayo.rubrica.map((c, i) => (
          <li key={i} className="space-y-2 rounded-md border border-borde p-3">
            <fieldset className="space-y-2">
              <legend className="cuerpo-s font-semibold text-texto">{c.criterio}</legend>
              <div className="flex flex-wrap gap-2">
                {NIVELES.map((n) => (
                  <label key={n} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-borde-fuerte px-3 cuerpo-s text-texto has-[:checked]:border-accion has-[:checked]:bg-superficie-suave">
                    <input type="radio" name={`nivel-${ensayo.respuestaId}-${i}`} value={n} checked={b.niveles[i] === n} onChange={() => cambiarNivel(i, n)} />
                    {T.niveles[n]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-1">
              <span className="nota text-texto-suave">{T.devolucionDelCriterio}</span>
              <textarea
                className={CAMPO}
                rows={2}
                value={b.devoluciones[i]}
                onChange={(e) => setB((prev) => ({ ...prev, devoluciones: prev.devoluciones.map((x, j) => (j === i ? e.target.value : x)) }))}
              />
            </label>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="block space-y-1">
          <span className="nota font-semibold text-texto">{T.nota}</span>
          <input
            className={`${CAMPO} h-11`}
            inputMode="decimal"
            value={b.nota}
            onChange={(e) => {
              setSugerida(false)
              setB((prev) => ({ ...prev, nota: e.target.value }))
            }}
          />
        </label>
        <label className="block space-y-1">
          <span className="nota font-semibold text-texto">{T.devolucionGeneral}</span>
          <textarea className={CAMPO} rows={3} value={b.devolucion} onChange={(e) => setB((prev) => ({ ...prev, devolucion: e.target.value }))} />
        </label>
      </div>

      {error && (
        <p role="alert" className="nota text-texto">
          {error}
        </p>
      )}
      <Boton onClick={confirmar} disabled={estado !== 'quieto' || !nivelCompleto || !notaValida}>
        {estado === 'confirmando' ? T.confirmando : T.confirmar}
      </Boton>
    </article>
  )
}

/** Ronda W · W5 — La cola de ensayos para corregir. */
export function Correcciones({ inicial }: { inicial: EnsayoParaCorregir[] }) {
  const [ensayos, setEnsayos] = useState(inicial)
  const [aviso, setAviso] = useState<string | null>(null)
  if (ensayos.length === 0) {
    return (
      <div className="space-y-2">
        {aviso && (
          <p role="status" className="cuerpo-s text-texto">
            {aviso}
          </p>
        )}
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {aviso && (
        <p role="status" className="cuerpo-s text-texto">
          {aviso}
        </p>
      )}
      {ensayos.map((e) => (
        <TarjetaDeEnsayo
          key={e.respuestaId}
          ensayo={e}
          onConfirmada={() => {
            setEnsayos((prev) => prev.filter((x) => x.respuestaId !== e.respuestaId))
            setAviso(T.confirmada)
          }}
        />
      ))}
    </div>
  )
}

/** El acceso desde Mis tareas: aparece sólo si hay ensayos esperando. */
export function AbrirCorrecciones() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let vivo = true
    pedirJson<{ ensayos: unknown[] }>('/api/teacher/correcciones').then((r) => {
      if (vivo && 'data' in r) setN(r.data.ensayos.length)
    })
    return () => {
      vivo = false
    }
  }, [])
  if (n === 0) return null
  return (
    <Boton variante="secundario" asChild>
      <Link href="/teacher/correcciones" data-para-corregir={n}>
        {T.abrir(n)}
      </Link>
    </Boton>
  )
}
