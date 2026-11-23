import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Correcciones } from '@/components/docente/correcciones'
import { getTeacherViewer } from '@/lib/auth-session'
import { ensayosParaCorregir } from '@/lib/correcciones-server'
import { ENSAYO, PANEL_DOCENTE } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/** Ronda W · W5 — Las respuestas largas que esperan la corrección del docente. */
export default async function CorreccionesPage() {
  const teacher = await getTeacherViewer()
  if (!teacher) redirect('/teacher')
  const { disponible, ensayos } = await ensayosParaCorregir(teacher.id)
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <Link href="/teacher?seccion=tareas" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {PANEL_DOCENTE.tareas.guardadas}
      </Link>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{ENSAYO.correcciones.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{ENSAYO.correcciones.detalle}</p>
      </header>
      {disponible ? <Correcciones inicial={ensayos} /> : <p className="cuerpo-s text-texto-suave">{ENSAYO.correcciones.noDisponible}</p>}
    </div>
  )
}
