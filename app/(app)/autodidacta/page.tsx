'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { pedirJson } from '@/lib/pedir-json'
import { diasHastaElExamen } from '@/lib/autodidacta'
import type { EstadoAutodidacta } from '@/lib/autodidacta-server'
import { AUTODIDACTA as T } from '@/lib/textos'

const CAMPO = 'h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s text-texto'

/**
 * Ronda T · E1 — "Me preparo solo para un examen". Primero, la declaración de
 * que es mayor de 18 (obligatoria); después sus materias personales y una
 * nueva: sube el programa (se lee con la misma lectura del alumno, y el área
 * se detecta igual, A2), pone la fecha del examen, y se crea la materia.
 */
export default function AutodidactaPage() {
  const [estado, setEstado] = useState<EstadoAutodidacta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vigente = true
    void pedirJson<EstadoAutodidacta>('/api/autodidacta').then((res) => {
      if (!vigente) return
      if ('error' in res) setError(res.error)
      else setEstado(res.data)
    })
    return () => {
      vigente = false
    }
  }, [vuelta])

  if (error) return <p className="cuerpo-s text-flojo">{error}</p>
  if (!estado) return <Cargando />

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.entradaDetalle}</p>
      </header>
      {!estado.disponible ? (
        <p className="cuerpo-s text-texto-suave">{T.noSePudo}</p>
      ) : !estado.mayorDeEdad ? (
        <DeclaracionDeMayor onListo={() => setVuelta((n) => n + 1)} />
      ) : (
        <>
          <section className="space-y-3" aria-labelledby="mis-materias">
            <h2 id="mis-materias" className="titulo-m text-texto">
              {T.misMaterias}
            </h2>
            {estado.materias.length === 0 ? (
              <p className="cuerpo-s text-texto-suave">{T.ninguna}</p>
            ) : (
              <ul className="space-y-2">
                {estado.materias.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/autodidacta/${m.id}`}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 hover:border-accion"
                    >
                      <span className="min-w-0">
                        <span className="cuerpo block font-semibold text-texto">{m.nombre}</span>
                        <span className="nota text-texto-suave">
                          {T.temas(m.temas)}
                          {m.fechaExamen ? ` · ${T.faltan(Math.max(0, diasHastaElExamen(new Date(), m.fechaExamen)))}` : ''}
                        </span>
                      </span>
                      <span className="cuerpo-s font-semibold text-accion">{T.abrir}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <NuevaMateria />
        </>
      )}
    </div>
  )
}

function DeclaracionDeMayor({ onListo }: { onListo: () => void }) {
  const [marcada, setMarcada] = useState(false)
  const [enviando, setEnviando] = useState(false)
  async function seguir(e: FormEvent) {
    e.preventDefault()
    if (!marcada) return
    setEnviando(true)
    await pedirJson('/api/autodidacta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mayorDeEdad: true }) })
    setEnviando(false)
    onListo()
  }
  return (
    <form onSubmit={seguir} className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <h2 className="titulo-m text-texto">{T.mayor.titulo}</h2>
      <p className="cuerpo-s text-texto-suave">{T.mayor.detalle}</p>
      <label className="cuerpo-s flex min-h-11 items-center gap-3 text-texto">
        <input type="checkbox" className="size-5 accent-[var(--accion)]" checked={marcada} onChange={(e) => setMarcada(e.target.checked)} required />
        {T.mayor.declaracion}
      </label>
      <Boton type="submit" disabled={!marcada || enviando}>
        {T.mayor.seguir}
      </Boton>
    </form>
  )
}

interface Leido {
  units: { name: string; topics: { name: string }[] }[]
  area?: string
  areaConfianza?: number
}

function NuevaMateria() {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [leido, setLeido] = useState<Leido | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function leer(archivo: File) {
    setLeyendo(true)
    setError(null)
    const datos = new FormData()
    datos.append('file', archivo)
    try {
      const res = await fetch('/api/curriculum/parse-program', { method: 'POST', body: datos })
      const cuerpo = (await res.json().catch(() => null)) as (Leido & { error?: string }) | null
      if (!res.ok || !cuerpo?.units?.length) throw new Error(cuerpo?.error || T.noSePudoLeer)
      setLeido(cuerpo)
      if (!nombre) setNombre(archivo.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : T.noSePudoLeer)
    } finally {
      setLeyendo(false)
    }
  }

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!leido || !fecha || !nombre.trim()) return
    setCreando(true)
    setError(null)
    const res = await pedirJson<{ id: number }>('/api/autodidacta/materias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nombre.trim(), fechaExamen: fecha, unidades: leido.units, area: leido.area, areaConfianza: leido.areaConfianza }),
    })
    if ('error' in res) {
      setError(res.error)
      setCreando(false)
      return
    }
    window.location.assign(`/autodidacta/${res.data.id}`)
  }

  const temas = leido?.units.reduce((s, u) => s + u.topics.length, 0) ?? 0
  return (
    <form onSubmit={crear} className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4" aria-labelledby="nueva-materia">
      <h2 id="nueva-materia" className="titulo-m text-texto">
        {T.nueva}
      </h2>
      <label className="block space-y-1">
        <span className="cuerpo-s font-semibold text-texto">{T.programa}</span>
        <input
          type="file"
          accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          className="cuerpo-s block w-full text-texto"
          onChange={(e) => e.target.files?.[0] && leer(e.target.files[0])}
        />
      </label>
      {leyendo && (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave">
          <Cargando /> {T.leyendo}
        </p>
      )}
      {leido && <p className="nota text-logrado">{T.temasLeidos(leido.units.length, temas)}</p>}
      <label className="block space-y-1">
        <span className="cuerpo-s font-semibold text-texto">{T.nombre}</span>
        <input className={CAMPO} value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} required />
      </label>
      <label className="block space-y-1">
        <span className="cuerpo-s font-semibold text-texto">{T.fechaExamen}</span>
        <input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <Boton type="submit" disabled={!leido || !fecha || creando}>
        {creando ? T.creando : T.crear}
      </Boton>
      {error && (
        <p role="alert" className="cuerpo-s text-flojo">
          {error}
        </p>
      )}
    </form>
  )
}
