'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { useAppStore } from '@/lib/store'
import { PREGUNTAS_POR_DIA, SIMULACROS, diasHastaElExamen, preguntasDelDiagnostico, puedeGenerar } from '@/lib/autodidacta'
import { formatearPesos } from '@/lib/planes'
import type { MateriaConPlan } from '@/lib/autodidacta-server'
import type { Question, QuizConfig } from '@/lib/types'
import { AUTODIDACTA as T } from '@/lib/textos'
import { CambiarFechaDelExamen } from '@/components/alumno/cambiar-fecha-del-examen'
import { RepasarHoy } from '@/components/alumno/repasar-hoy'

/**
 * Ronda T · E1 — Una materia personal: el diagnóstico inicial, lo que ya sabe
 * y lo que tiene que reforzar, el plan hasta el examen con la práctica de hoy
 * (10 preguntas) y los simulacros cronometrados. Las preguntas salen de la
 * generación de siempre con el programa de la materia (su área, A4).
 */
export default function MateriaAutodidactaPage() {
  const { id } = useParams<{ id: string }>()
  const { startQuiz, setActiveView } = useAppStore()
  const [materia, setMateria] = useState<MateriaConPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let vigente = true
    void pedirJson<MateriaConPlan>(`/api/autodidacta/${id}`).then((res) => {
      if (!vigente) return
      if ('error' in res) setError(res.error)
      else setMateria(res.data)
    })
    return () => {
      vigente = false
    }
  }, [id, version])

  if (error) return <p className="cuerpo-s text-flojo">{error}</p>
  if (!materia) return <Cargando />

  const todos = materia.unidades.flatMap((u) => u.topics.map((t) => ({ id: t.id, name: t.name })))
  const hoy = materia.plan[0]
  const dias = materia.fechaExamen ? diasHastaElExamen(new Date(), materia.fechaExamen) : null

  async function empezar(tipo: 'diagnostico' | 'practica' | 'simulacro', temas: { id: string; name: string }[], cantidad: number, minutos?: number) {
    if (!materia) return
    setGenerando(true)
    setError(null)
    const conAlFinal = tipo !== 'practica'
    const config: QuizConfig = {
      subject: `autodidacta-${materia.id}`,
      subjectName: materia.nombre,
      topics: temas,
      mode: tipo === 'practica' ? 'practico' : 'mixto',
      questionCount: cantidad,
      nivel: 'Superior',
      ...(conAlFinal ? { devolucion: 'al_final' as const } : {}),
      autodidacta: { programId: materia.id, tipo },
      ...(minutos ? { limiteMinutos: minutos } : {}),
    }
    const res = await pedirJson<{ questions: Question[] }>('/api/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: materia.nombre,
        subjectUnits: materia.unidades,
        topics: temas,
        mode: config.mode,
        questionCount: cantidad,
        nivel: 'Superior',
        teacherProgramId: materia.id,
        // E2: lo gratis y el pase se cuentan por tipo, en el servidor.
        autodidactaTipo: tipo,
      }),
    })
    setGenerando(false)
    if ('error' in res || !res.data.questions?.length) {
      setError('error' in res ? res.error : T.noSePudo)
      return
    }
    startQuiz(config, res.data.questions)
    setActiveView('quiz')
  }

  const { acceso } = materia
  const linkDelPase = `/precios/pagar?plan=pase_alumno&forma=pase&cantidad=1&materia=${materia.id}`
  const textoDelPase = materia.precioPase ? T.sacarPase(formatearPesos(materia.precioPase)) : T.sacarPaseSinPrecio
  const sabidos = materia.estados.filter((e) => e.estado === 'sabido')
  const flojos = materia.estados.filter((e) => e.estado === 'reforzar')
  const temasDeHoy = hoy ? todos.filter((t) => hoy.temas.includes(t.name)) : []

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6" data-materia-autodidacta={materia.id}>
      <Link href="/autodidacta" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {T.volver}
      </Link>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{materia.nombre}</h1>
        {materia.fechaExamen && dias !== null && (
          <p className="cuerpo-s text-texto-suave">
            {T.examenEl(new Date(`${materia.fechaExamen}T12:00:00`).toLocaleDateString('es-AR'))} · {T.faltan(Math.max(0, dias))}
          </p>
        )}
        <CambiarFechaDelExamen
          materiaId={materia.id}
          fechaExamen={materia.fechaExamen}
          // U2: el plan hasta el examen cambia con la fecha: se vuelve a leer.
          onCambio={() => setVersion((v) => v + 1)}
        />
      </header>

      {/* E2: el pase por materia, o lo gratis que queda. */}
      <section className="space-y-2 rounded-lg border border-borde bg-superficie-suave p-4" data-pase={acceso.pase ? 'vigente' : 'gratis'}>
        {acceso.pase ? (
          <p className="cuerpo-s text-texto">{T.conPase(new Date(`${acceso.pase}T12:00:00`).toLocaleDateString('es-AR'))}</p>
        ) : (
          <>
            <p className="cuerpo-s text-texto">{T.gratis(acceso.quedan.practica ?? 0)}</p>
            <Boton asChild variante="secundario">
              <Link href={linkDelPase}>{textoDelPase}</Link>
            </Boton>
          </>
        )}
      </section>

      {generando && (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando /> {T.generando}
        </p>
      )}

      {/* X2: el repaso espaciado de esta materia. */}
      {materia.hizoDiagnostico && !generando && <RepasarHoy materia={materia.nombre} nivel="Superior" />}

      {!materia.hizoDiagnostico ? (
        <section className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4">
          <h2 className="titulo-m text-texto">{T.diagnostico}</h2>
          <p className="cuerpo-s text-texto-suave">{T.diagnosticoDetalle}</p>
          <Boton disabled={generando || !puedeGenerar(acceso, 'diagnostico')} onClick={() => empezar('diagnostico', todos.slice(0, 20), preguntasDelDiagnostico(todos.length))}>
            {T.hacerDiagnostico}
          </Boton>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 rounded-lg border border-borde bg-logrado-fondo p-4">
              <h2 className="etiqueta text-logrado">{T.loQueSabes}</h2>
              <ul className="cuerpo-s space-y-0.5 text-texto">{sabidos.length ? sabidos.map((e) => <li key={e.tema}>{e.tema}</li>) : <li className="text-texto-suave">{T.sinDatos}</li>}</ul>
            </div>
            <div className="space-y-1 rounded-lg border border-borde bg-flojo-fondo p-4">
              <h2 className="etiqueta text-flojo">{T.loQueReforzar}</h2>
              <ul className="cuerpo-s space-y-0.5 text-texto">{flojos.length ? flojos.map((e) => <li key={e.tema}>{e.tema}</li>) : <li className="text-texto-suave">{T.sinDatos}</li>}</ul>
            </div>
          </section>

          {materia.plan.length > 0 && (
            <section className="space-y-2" aria-labelledby="plan">
              <h2 id="plan" className="titulo-m text-texto">
                {T.plan}
              </h2>
              {hoy && (
                <div className="space-y-2 rounded-lg border-2 border-accion bg-accion-tenue p-4">
                  <p className="etiqueta text-accion">{T.hoy}</p>
                  <p className="cuerpo-s text-texto">{hoy.simulacro ? T.diaDeSimulacro : hoy.temas.join(' · ')}</p>
                  {!hoy.simulacro && (
                    <Boton disabled={generando || temasDeHoy.length === 0 || !puedeGenerar(acceso, 'practica')} onClick={() => empezar('practica', temasDeHoy, PREGUNTAS_POR_DIA)}>
                      {T.practicaDeHoy}
                    </Boton>
                  )}
                </div>
              )}
              <ol className="space-y-1">
                {materia.plan.slice(1).map((d) => (
                  <li key={d.fecha} className="nota flex gap-3 text-texto-suave">
                    <span className="tabular-nums">{new Date(`${d.fecha}T12:00:00`).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })}</span>
                    <span className="text-texto">{d.simulacro ? T.diaDeSimulacro : d.temas.join(' · ')}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <section className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4" aria-labelledby="simulacro">
        <h2 id="simulacro" className="titulo-m text-texto">
          {T.simulacro}
        </h2>
        <p className="cuerpo-s text-texto-suave">{T.simulacroDetalle}</p>
        <p className="cuerpo-s font-semibold text-texto">{T.nuncaReales}</p>
        {!puedeGenerar(acceso, 'simulacro') && <p className="cuerpo-s text-texto-suave">{T.conPaseSimulacros}</p>}
        <div className="flex flex-wrap gap-2">
          {SIMULACROS.map((s) => (
            <Boton key={s.preguntas} variante="secundario" disabled={generando || !puedeGenerar(acceso, 'simulacro')} onClick={() => empezar('simulacro', todos, s.preguntas, s.minutos)}>
              {T.empezarSimulacro(s.preguntas, s.minutos)}
            </Boton>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="cuerpo-s text-flojo">
          {error}
        </p>
      )}
    </div>
  )
}
