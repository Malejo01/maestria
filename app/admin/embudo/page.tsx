import { notFound } from 'next/navigation'
import { getAdminViewer } from '@/lib/auth-session'
import { conteoPorPaso, PASOS, type DocenteEnElEmbudo } from '@/lib/embudo'
import { embudoDeDocentes } from '@/lib/embudo-server'
import { personasConOrigen } from '@/lib/origen-server'
import { NOMBRE_DEL_CANAL, porcentaje, resumenPorCanal } from '@/lib/origen'
import { ORIGEN } from '@/lib/textos'
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

  const [docentes, personas] = await Promise.all([embudoDeDocentes(), personasConOrigen().catch(() => [])])
  // V1: por canal, con el paso del embudo de cada docente (la conversión).
  const indice = new Map(docentes.map((d) => [d.id, d.indice]))
  const porCanal = resumenPorCanal(personas.map((p) => ({ ...p, pasoDelEmbudo: indice.get((p as { id?: string }).id ?? '') })))
  const trabados = docentes.filter((d) => d.trabado)
  const resto = docentes.filter((d) => !d.trabado)
  const conteo = conteoPorPaso(docentes)
  const total = docentes.length || 1

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
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

          <section aria-labelledby="embudo-por-canal" className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4" data-por-canal>
            <h2 id="embudo-por-canal" className="cuerpo font-bold text-texto">{ORIGEN.porCanal}</h2>
            <p className="nota text-texto-suave">{ORIGEN.porCanalDetalle}</p>
            {porCanal.length === 0 ? (
              <p className="cuerpo-s text-texto-suave">{ORIGEN.vacio}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left">
                  <thead>
                    <tr className="nota text-texto-suave">
                      <th scope="col" className="py-2 pr-3 font-semibold">{ORIGEN.columnas.canal}</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">{ORIGEN.columnas.docentes}</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">{ORIGEN.columnas.conTarea}</th>
                      <th scope="col" className="py-2 pr-3 text-right font-semibold">{ORIGEN.columnas.conAlumnos}</th>
                      <th scope="col" className="py-2 text-right font-semibold">{ORIGEN.columnas.alumnos}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCanal.map((f) => (
                      <tr key={f.canal} className="cuerpo-s border-t border-borde text-texto">
                        <th scope="row" className="py-2 pr-3 font-semibold">{f.canal === 'sin-dato' ? ORIGEN.sinDato : NOMBRE_DEL_CANAL[f.canal]}</th>
                        <td className="py-2 pr-3 text-right tabular-nums">{f.docentes}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {f.conTarea} <span className="nota text-texto-suave">({porcentaje(f.conTarea, f.docentes)})</span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {f.conAlumnos} <span className="nota text-texto-suave">({porcentaje(f.conAlumnos, f.docentes)})</span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{f.alumnos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
