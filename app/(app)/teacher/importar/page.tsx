import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ImportarDeMoodle } from '@/components/docente/importar-de-moodle'
import { IMPORTAR_MOODLE, PANEL_DOCENTE } from '@/lib/textos'

/** Ronda W · W3 — Importar preguntas de Moodle (GIFT o Moodle XML) a un cuestionario nuevo. */
export default function ImportarPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <Link href="/teacher?seccion=tareas" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {PANEL_DOCENTE.tareas.guardadas}
      </Link>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{IMPORTAR_MOODLE.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{IMPORTAR_MOODLE.detalle}</p>
      </header>
      <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
        <ImportarDeMoodle />
      </section>
    </div>
  )
}
