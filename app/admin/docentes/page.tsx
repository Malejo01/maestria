import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminViewer } from '@/lib/auth-session'
import { listarDocentes } from '@/lib/admin/docentes-server'
import { ADMIN } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { CLASE_DEL_PLAN } from '@/lib/admin/portada'

/**
 * P1 · /admin/docentes: todos los docentes, con plan, cuánto armaron y su
 * última actividad. De los alumnos, sólo cantidades. Sólo lectura.
 */
export const dynamic = 'force-dynamic'

const T = ADMIN.docentes
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : T.nunca)

export default async function DocentesAdminPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  const docentes = await listarDocentes()

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:py-10">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      </header>

      {docentes.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-borde bg-superficie-tarjeta">
          {docentes.map((d) => (
            <li key={d.id} className="border-b border-borde last:border-b-0">
              <Link href={`/admin/docentes/${encodeURIComponent(d.id)}`} className="block px-4 py-3 hover:bg-superficie-suave">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="cuerpo-s font-semibold text-texto">{d.nombre || T.sinNombre}</p>
                    {d.email && <p className="nota break-all text-texto-suave">{d.email}</p>}
                  </div>
                  <p className={cn('nota shrink-0 font-semibold', CLASE_DEL_PLAN[d.plan])}>{T.estado[d.plan]}</p>
                </div>
                <dl className="nota mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-texto-suave sm:grid-cols-5">
                  <div>
                    <dt className="inline">{T.columnas.alta}: </dt>
                    <dd className="inline text-texto">{fecha(d.altaEl)}</dd>
                  </div>
                  <div>
                    <dt className="inline">{T.columnas.materias}: </dt>
                    <dd className="inline tabular-nums text-texto">{d.materias}</dd>
                  </div>
                  <div>
                    <dt className="inline">{T.columnas.grupos}: </dt>
                    <dd className="inline tabular-nums text-texto">{d.grupos}</dd>
                  </div>
                  <div>
                    <dt className="inline">{T.columnas.alumnos}: </dt>
                    <dd className="inline tabular-nums text-texto">{d.alumnos}</dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="inline">{T.columnas.ultima}: </dt>
                    <dd className="inline text-texto">{fecha(d.ultimaActividad)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
