import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminViewer } from '@/lib/auth-session'
import { conteoPorPaso, PASOS, type DocenteEnElEmbudo } from '@/lib/embudo'
import { embudoDeDocentes } from '@/lib/embudo-server'
import { EMBUDO as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * O12: /admin/embudo (FASE 2, activación). En qué paso del camino de un
 * docente nuevo está cada uno y desde cuándo; los trabados más de 3 días van
 * arriba, con su email. Como /admin/planes: sólo ADMIN_EMAILS (al resto, 404).
 */
export const dynamic = 'force-dynamic'

function Fila({ d }: { d: DocenteEnElEmbudo }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-borde px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="cuerpo-s font-semibold text-texto">{d.nombre || T.sinNombre}</p>
        {d.email && <p className="nota break-all text-texto-suave">{d.email}</p>}
      </div>
      <p className={cn('nota shrink-0', d.trabado ? 'font-semibold text-flojo' : d.terminado ? 'text-logrado' : 'text-texto-suave')}>
        {d.terminado ? T.terminado : T.enPaso(T.pasos[d.paso], d.dias)}
      </p>
    </li>
  )
}

export default async function EmbudoAdminPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  const docentes = await embudoDeDocentes()
  const trabados = docentes.filter((d) => d.trabado)
  const resto = docentes.filter((d) => !d.trabado)
  const conteo = conteoPorPaso(docentes)
  const total = docentes.length || 1

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <Link href="/" className="nota inline-flex items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {T.volver}
      </Link>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      </header>

      {docentes.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <>
          <ol className="flex flex-col gap-2 rounded-lg border border-borde bg-superficie-tarjeta p-4">
            {PASOS.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="nota w-44 shrink-0 text-texto sm:w-56">{T.pasos[p]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-base">
                  <span className="block h-full rounded-full bg-accion" style={{ width: `${(conteo[p] / total) * 100}%` }} />
                </span>
                <span className="nota w-8 shrink-0 text-right tabular-nums text-texto">{conteo[p]}</span>
              </li>
            ))}
          </ol>

          <section className="rounded-lg border border-borde bg-superficie-tarjeta">
            <h2 className="cuerpo border-b border-borde px-4 py-3 font-bold text-texto">{T.trabados(trabados.length)}</h2>
            {trabados.length === 0 ? (
              <p className="cuerpo-s px-4 py-3 text-texto-suave">{T.sinTrabados}</p>
            ) : (
              <ul>{trabados.map((d) => <Fila key={d.id} d={d} />)}</ul>
            )}
          </section>

          {resto.length > 0 && (
            <section className="rounded-lg border border-borde bg-superficie-tarjeta">
              <h2 className="cuerpo border-b border-borde px-4 py-3 font-bold text-texto">{T.resto}</h2>
              <ul>{resto.map((d) => <Fila key={d.id} d={d} />)}</ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}
