import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { getAdminViewer } from '@/lib/auth-session'
import { fichaDeDocente } from '@/lib/admin/docentes-server'
import { CLASE_DEL_PLAN } from '@/lib/admin/portada'
import { ADMIN } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * P1 · Un docente: sus materias y sus grupos, sólo lectura. De los alumnos,
 * sólo cuántos hay por grupo: ni nombres ni notas.
 */
export const dynamic = 'force-dynamic'

const T = ADMIN.docentes
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : T.nunca)

export default async function DocenteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  const { id } = await params
  const ficha = await fichaDeDocente(decodeURIComponent(id))
  if (!ficha) notFound()
  const { docente, materias, grupos } = ficha

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:py-10">
      <Link href="/admin/docentes" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {T.volver}
      </Link>

      <header className="space-y-1">
        <h1 className="titulo-l break-words text-texto">{docente.nombre || T.sinNombre}</h1>
        {docente.email && <p className="cuerpo-s break-all text-texto-suave">{docente.email}</p>}
        <p className="nota text-texto-suave">
          <span className={cn('font-semibold', CLASE_DEL_PLAN[docente.plan])}>{T.estado[docente.plan]}</span>
          {' · '}
          {T.columnas.alta}: {fecha(docente.altaEl)}
          {' · '}
          {T.columnas.ultima}: {fecha(docente.ultimaActividad)}
        </p>
      </header>

      <section aria-labelledby="admin-materias" className="space-y-3">
        <h2 id="admin-materias" className="titulo-m text-texto">
          {T.materias} <span className="text-texto-suave">({materias.length})</span>
        </h2>
        {materias.length === 0 ? (
          <p className="cuerpo-s text-texto-suave">{T.sinMaterias}</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta">
            {materias.map((m) => (
              <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-borde px-4 py-3 last:border-b-0">
                <p className="cuerpo-s font-semibold text-texto">
                  {m.nombre}
                  {m.archivada && <span className="nota ml-2 font-normal text-texto-suave">{T.archivada}</span>}
                </p>
                <p className="nota text-texto-suave">
                  {T.unidades(m.unidades)} · {T.creadoEl(fecha(m.creadaEl))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-grupos" className="space-y-3">
        <h2 id="admin-grupos" className="titulo-m text-texto">
          {T.grupos} <span className="text-texto-suave">({grupos.length})</span>
        </h2>
        {grupos.length === 0 ? (
          <p className="cuerpo-s text-texto-suave">{T.sinGrupos}</p>
        ) : (
          <ul className="overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta">
            {grupos.map((g) => (
              <li key={g.id} className="border-b border-borde px-4 py-3 last:border-b-0">
                <p className="cuerpo-s font-semibold text-texto">
                  {g.nombre}
                  {g.cerrado && <span className="nota ml-2 font-normal text-texto-suave">{T.cerrado}</span>}
                </p>
                <p className="nota text-texto-suave">
                  {g.materia} · {T.alumnosDelGrupo(g.alumnos)} · {T.tareas(g.tareas)} · {T.creadoEl(fecha(g.creadoEl))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
