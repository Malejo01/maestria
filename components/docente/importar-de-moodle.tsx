'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Boton } from '@/components/sistema/boton'
import { pedirJson } from '@/lib/pedir-json'
import { importarDeMoodle, type ResultadoDeImportar } from '@/lib/importar-moodle'
import { ETIQUETA_DE_TIPO } from '@/lib/tipos-moodle'
import { IMPORTAR_MOODLE as T } from '@/lib/textos'

const CAMPO = 'h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 cuerpo-s text-texto'
const MAXIMO_BYTES = 5 * 1024 * 1024

/**
 * Ronda W · W3 — Importar desde Moodle: el archivo se lee en el navegador
 * (lib/importar-moodle.ts), se muestra qué entra y qué no (y por qué), y se
 * guarda como un cuestionario nuevo de la materia (que queda en el banco, W1).
 */
export function ImportarDeMoodle() {
  const [materias, setMaterias] = useState<{ id: number; nombre: string }[]>([])
  const [materiaId, setMateriaId] = useState('')
  const [resultado, setResultado] = useState<ResultadoDeImportar | null>(null)
  const [titulo, setTitulo] = useState('')
  const [estado, setEstado] = useState<'nada' | 'leyendo' | 'guardando' | 'listo'>('nada')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void pedirJson<{ programs: { id: number; subjectName?: string; subject_name?: string }[] }>('/api/teacher/programs').then((res) => {
      if ('error' in res) return
      const lista = (res.data.programs ?? []).map((p) => ({ id: Number(p.id), nombre: String(p.subjectName ?? p.subject_name ?? '') }))
      setMaterias(lista)
      if (lista.length === 1) setMateriaId(String(lista[0].id))
    })
  }, [])

  async function leer(archivo: File | undefined) {
    if (!archivo) return
    setError(null)
    if (archivo.size > MAXIMO_BYTES) {
      setError(T.vacio)
      return
    }
    setEstado('leyendo')
    const r = importarDeMoodle(await archivo.text())
    setResultado(r)
    setTitulo(T.tituloPorDefecto(r.categoria))
    setEstado('nada')
  }

  async function guardar() {
    if (!resultado || !materiaId) return
    const materia = materias.find((m) => String(m.id) === materiaId)
    setEstado('guardando')
    setError(null)
    const tema = resultado.categoria ?? 'Importadas'
    const res = await pedirJson('/api/teacher/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherProgramId: Number(materiaId),
        title: titulo.trim() || T.tituloPorDefecto(resultado.categoria),
        subjectName: materia?.nombre ?? '',
        mode: 'practico',
        status: 'saved',
        selectedTopics: [{ id: 'importada', name: tema }],
        questionCount: resultado.preguntas.length,
        questions: resultado.preguntas,
      }),
    })
    if ('error' in res) {
      setError(T.noSePudo)
      setEstado('nada')
      return
    }
    setEstado('listo')
  }

  if (estado === 'listo') {
    return (
      <div className="space-y-3" role="status" data-importado>
        <p className="cuerpo text-texto">{T.listo}</p>
        <div className="flex flex-wrap gap-2">
          <Boton asChild>
            <Link href="/teacher?seccion=tareas">{T.verTareas}</Link>
          </Boton>
          <Boton asChild variante="secundario">
            <Link href="/teacher/banco">{T.verBanco}</Link>
          </Boton>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="cuerpo-s font-semibold text-texto">{T.materia}</span>
          <select className={CAMPO} value={materiaId} onChange={(e) => setMateriaId(e.target.value)}>
            <option value="">{T.elegirMateria}</option>
            {materias.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="cuerpo-s font-semibold text-texto">{T.archivo}</span>
          <input
            type="file"
            accept=".gift,.txt,.xml,text/plain,text/xml,application/xml"
            className="cuerpo-s block w-full text-texto file:mr-3 file:min-h-11 file:rounded-md file:border file:border-borde-fuerte file:bg-superficie-tarjeta file:px-3 file:font-semibold file:text-texto"
            onChange={(e) => void leer(e.target.files?.[0])}
          />
        </label>
      </div>

      {estado === 'leyendo' && (
        <p className="cuerpo-s text-texto-suave" role="status">
          {T.leyendo}
        </p>
      )}

      {resultado && (
        <div className="space-y-4" data-vista-previa>
          <p className="cuerpo text-texto" role="status">
            {T.resumen(resultado.preguntas.length, resultado.salteadas.length, T.formato[resultado.formato])}
          </p>
          {resultado.preguntas.length > 0 && (
            <section className="space-y-2">
              <h2 className="cuerpo-s font-bold text-texto">{T.seImportan}</h2>
              <ol className="max-h-[50vh] space-y-1 overflow-y-auto rounded-md border border-borde p-3">
                {resultado.preguntas.map((p) => (
                  <li key={p.id} className="cuerpo-s text-texto" data-importable>
                    <span className="nota mr-2 rounded-sm border border-borde px-1.5 py-0.5 text-texto-suave">{ETIQUETA_DE_TIPO[p.type] ?? p.type}</span>
                    {p.question || ('text' in p ? String(p.text) : '')}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {resultado.salteadas.length > 0 && (
            <section className="space-y-2">
              <h2 className="cuerpo-s font-bold text-texto">{T.noSeImportan}</h2>
              <ul className="space-y-1 rounded-md border border-borde p-3">
                {resultado.salteadas.map((s, i) => (
                  <li key={`${s.donde}-${i}`} className="cuerpo-s text-texto-suave" data-salteada>
                    <span className="font-semibold text-texto">{s.donde}:</span> {s.motivo}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {resultado.preguntas.length === 0 ? (
            <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="cuerpo-s font-semibold text-texto">{T.tituloDelCuestionario}</span>
                <input className={CAMPO} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <Boton disabled={!materiaId || estado === 'guardando'} onClick={() => void guardar()}>
                {estado === 'guardando' ? T.guardando : T.guardar(resultado.preguntas.length)}
              </Boton>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="cuerpo-s text-flojo" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
