import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { ListaDelBanco } from '@/components/docente/banco-de-preguntas'
import { BANCO, PANEL_DOCENTE } from '@/lib/textos'

/** Ronda W · W1 — El banco de preguntas del docente (buscar y leer; se suman al armar una tarea). */
export default function BancoPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 py-6">
      <Link href="/teacher?seccion=tareas" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {PANEL_DOCENTE.tareas.guardadas}
      </Link>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{BANCO.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{BANCO.detalle}</p>
      </header>
      <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
        <ListaDelBanco />
      </section>
    </div>
  )
}
