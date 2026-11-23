'use client'

import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { PreguntaDelExamen, Tema } from '@/lib/examen-ab'
import { ENSAYO, EXAMEN_IMPRESO as T } from '@/lib/textos'

const LETRAS = 'ABCDEFGHIJ'

function Pregunta({ p }: { p: PreguntaDelExamen }) {
  const papel = p.papel
  return (
    <li className="break-inside-avoid border-b border-borde py-4 last:border-b-0">
      <div className="cuerpo flex gap-2">
        <span className="font-bold">{p.numero}.</span>
        <LaTeXRenderer content={p.enunciado} className="min-w-0 flex-1 whitespace-pre-line" />
      </div>
      <div className="cuerpo-s mt-3 pl-6">
        {papel.forma === 'opciones' && (
          <>
            {papel.varias && <p className="nota mb-2 text-texto-suave">{T.variasCorrectas}</p>}
            <ul className="flex flex-col gap-2">
              {papel.opciones.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden="true" className={`mt-0.5 inline-block size-4 shrink-0 border border-texto ${papel.varias ? 'rounded-none' : 'rounded-full'}`} />
                  <span className="font-semibold">{LETRAS[i]}.</span>
                  <LaTeXRenderer content={o} className="min-w-0" />
                </li>
              ))}
            </ul>
          </>
        )}
        {papel.forma === 'verdadero_falso' && <p className="whitespace-pre">{T.verdaderoFalso}</p>}
        {papel.forma === 'unir' && (
          <>
            <p className="nota mb-2 text-texto-suave">{T.unir}</p>
            <div className="grid grid-cols-2 gap-6">
              <ol className="flex flex-col gap-2">
                {papel.izquierda.map((l, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <span className="font-semibold">{i + 1}.</span>
                    <LaTeXRenderer content={l} className="min-w-0 flex-1" />
                    <span aria-hidden="true" className="inline-block h-6 w-10 shrink-0 border-b border-texto" />
                  </li>
                ))}
              </ol>
              <ul className="flex flex-col gap-2">
                {papel.derecha.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-semibold">{LETRAS[i]}.</span>
                    <LaTeXRenderer content={d} className="min-w-0" />
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {papel.forma === 'ordenar' && (
          <>
            <p className="nota mb-2 text-texto-suave">{T.ordenar}</p>
            <ul className="flex flex-col gap-2">
              {papel.pasos.map((paso, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block size-6 shrink-0 border border-texto" />
                  <span className="font-semibold">{LETRAS[i]}.</span>
                  <LaTeXRenderer content={paso} className="min-w-0" />
                </li>
              ))}
            </ul>
          </>
        )}
        {papel.forma === 'huecos' && (
          <>
            <LaTeXRenderer content={papel.texto} className="leading-loose" />
            <p className="mt-2">
              <span className="font-semibold">{T.banco}</span> {papel.banco.join(' · ')}
            </p>
          </>
        )}
        {papel.forma === 'ensayo' && (
          <>
            {papel.criterios.length > 0 && (
              <div className="nota text-texto-suave">
                <p>{ENSAYO.loQueSeEspera}</p>
                <ul className="list-disc pl-5">
                  {papel.criterios.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="nota mt-1 text-texto-suave">{T.respuesta}</p>
            <div aria-hidden="true" className="mt-1 h-64 rounded-sm border border-borde-fuerte" />
          </>
        )}
        {papel.forma === 'desarrollo' && (
          <>
            <p className="nota text-texto-suave">{T.respuesta}</p>
            <div aria-hidden="true" className="mt-1 h-24 rounded-sm border border-borde-fuerte" />
          </>
        )}
      </div>
    </li>
  )
}

/**
 * Ronda W · W4 — El examen en papel: el tema A, el tema B (cada uno en su
 * hoja) y la hoja de respuestas de los dos, aparte. `@media print` saca todo
 * lo que no es papel; el navegador lo guarda en PDF.
 */
export function ExamenImpreso({ titulo, materia, temas }: { titulo: string; materia: string; temas: { tema: Tema; preguntas: PreguntaDelExamen[] }[] }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 print:max-w-none print:p-0" data-examen-impreso>
      <div className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link href="/teacher?seccion=tareas" className="cuerpo-s inline-flex min-h-11 items-center gap-2 rounded-sm font-semibold text-texto-suave hover:text-texto">
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
          {T.volver}
        </Link>
        <Boton onClick={() => window.print()}>
          <Printer aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {T.imprimir}
        </Boton>
      </div>
      <p className="nota mb-6 text-texto-suave print:hidden">{T.ayuda}</p>

      {temas.map(({ tema, preguntas }, i) => (
        <article key={tema} className={`hoja-impresa text-texto ${i > 0 ? 'mt-10 break-before-page print:mt-0' : ''}`} data-tema={tema}>
          <header className="border-b border-texto pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="nota uppercase tracking-wider text-texto-suave">{materia}</p>
              <p className="titulo-m">{T.tema(tema)}</p>
            </div>
            <h1 className="titulo-m mt-1">{titulo}</h1>
            <div className="cuerpo-s mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <span className="font-semibold">{T.alumno}</span>
              <span className="border-b border-borde-fuerte">&nbsp;</span>
              <span className="font-semibold">{T.curso}</span>
              <span className="border-b border-borde-fuerte">&nbsp;</span>
              <span className="font-semibold">{T.fecha}</span>
              <span className="border-b border-borde-fuerte">&nbsp;</span>
            </div>
          </header>
          <ol className="mt-4 flex flex-col">
            {preguntas.map((p) => (
              <Pregunta key={p.numero} p={p} />
            ))}
          </ol>
        </article>
      ))}

      <article className="hoja-impresa mt-10 break-before-page border-t-4 border-texto pt-6 text-texto print:mt-0 print:border-t-0 print:pt-0" data-hoja-de-respuestas>
        <h2 className="titulo-m">{T.hojaDocente}</h2>
        <p className="nota mt-1 text-texto-suave">
          {titulo} · {T.noEntregar}
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          {temas.map(({ tema, preguntas }) => (
            <section key={tema}>
              <h3 className="cuerpo font-bold">{T.tema(tema)}</h3>
              <ol className="mt-2 flex flex-col">
                {preguntas.map((p) => (
                  <li key={p.numero} className="cuerpo-s flex break-inside-avoid gap-2 border-b border-borde py-1.5 last:border-b-0">
                    <span className="font-bold">{p.numero}.</span>
                    <LaTeXRenderer content={p.correcta} className="min-w-0 flex-1" />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </article>
    </div>
  )
}
