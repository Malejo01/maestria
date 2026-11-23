import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { getAdminViewer } from '@/lib/auth-session'
import { leerSalud } from '@/lib/salud-server'
import { fallanDemasiado, porcentaje, resumenDeGeneraciones } from '@/lib/salud'
import { ADMIN, SALUD as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

/**
 * Ronda Y · Y1 — /admin/salud: las generaciones de las últimas 24 h (cuántas
 * fallan y cuánto descartan los validadores), el gasto de IA del día y del
 * mes, los pagos para revisar y los errores recientes de Sentry. Sólo lee.
 */
export const dynamic = 'force-dynamic'

const usd = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 })
const pesos = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function Dato({ etiqueta, valor, atencion = false }: { etiqueta: string; valor: string; atencion?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-superficie-tarjeta p-4', atencion ? 'border-flojo' : 'border-borde')}>
      <p className="nota text-texto-suave">{etiqueta}</p>
      <p className={cn('titulo-l mt-1 tabular-nums', atencion ? 'text-flojo' : 'text-texto')}>{valor}</p>
    </div>
  )
}

export default async function SaludPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()
  const s = await leerSalud()
  const dia = resumenDeGeneraciones(s.dia)
  const alertaHora = fallanDemasiado(s.hora)

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-10" data-salud>
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      </header>

      <section aria-labelledby="salud-generaciones" className="space-y-3">
        <h2 id="salud-generaciones" className="titulo-m text-texto">
          {T.generaciones.titulo}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta={T.generaciones.total} valor={s.dia.total.toLocaleString('es-AR')} />
          <Dato etiqueta={T.generaciones.fallidas} valor={s.dia.fallidas.toLocaleString('es-AR')} />
          <Dato etiqueta={T.generaciones.tasaDeFallas} valor={porcentaje(dia.tasaDeFallas) ?? ADMIN.sinDato} />
          <Dato etiqueta={T.generaciones.tasaDeDescarte} valor={porcentaje(dia.tasaDeDescarte) ?? ADMIN.sinDato} />
        </div>
        {s.dia.crudas === null && <p className="nota text-texto-suave">{T.generaciones.sinDescarte}</p>}
        <p className={cn('cuerpo-s', alertaHora ? 'font-semibold text-flojo' : 'text-texto-suave')} data-alerta-hora={alertaHora}>
          {T.generaciones.ultimaHora(s.hora.fallidas, s.hora.total)}
        </p>
      </section>

      <section aria-labelledby="salud-ia" className="space-y-3">
        <h2 id="salud-ia" className="titulo-m text-texto">
          {T.ia.titulo}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Dato etiqueta={T.ia.hoy} valor={usd(s.ia.hoyUsd)} />
          <Dato etiqueta={T.ia.mes} valor={usd(s.ia.mesUsd)} />
        </div>
        {s.ia.porEndpoint.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-borde bg-superficie-tarjeta">
            <table className="w-full min-w-[28rem] text-left cuerpo-s">
              <caption className="sr-only">{T.ia.porEndpoint}</caption>
              <thead className="border-b border-borde text-texto-suave">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">{T.ia.columnas.endpoint}</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">{T.ia.columnas.llamadas}</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">{T.ia.columnas.fallidas}</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">{T.ia.columnas.usd}</th>
                </tr>
              </thead>
              <tbody>
                {s.ia.porEndpoint.map((e) => (
                  <tr key={e.endpoint} className="border-b border-borde last:border-b-0">
                    <td className="px-4 py-2 text-texto">{e.endpoint}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-texto">{e.llamadas}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', e.fallidas > 0 ? 'text-flojo' : 'text-texto')}>{e.fallidas}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-texto">{usd(e.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="salud-pagos" className="space-y-3">
        <h2 id="salud-pagos" className="titulo-m text-texto">
          {T.pagos.titulo}
        </h2>
        {s.pagos === null ? (
          <p className="cuerpo-s text-texto-suave">{T.pagos.sinTabla}</p>
        ) : s.pagos.length === 0 ? (
          <p className="cuerpo-s text-texto-suave">{T.pagos.ninguno}</p>
        ) : (
          <ul className="space-y-2" data-pagos-a-revisar={s.pagos.length}>
            {s.pagos.map((p) => (
              <li key={p.id} className="rounded-lg border border-flojo bg-superficie-tarjeta p-3">
                <p className="cuerpo-s font-semibold text-texto">{T.pagos.fila(p.id, p.docente)}</p>
                <p className="nota text-texto-suave">
                  {T.pagos.motivo[p.motivo]} · {pesos(p.monto)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {s.sinPagar !== null && s.sinPagar > 0 && <p className="nota text-texto-suave">{T.pagos.sinPagar(s.sinPagar)}</p>}
      </section>

      <section aria-labelledby="salud-respaldo" className="space-y-3" data-respaldo={s.respaldo.faltan.length > 0 ? 'sin-configurar' : 'configurado'}>
        <h2 id="salud-respaldo" className="titulo-m text-texto">
          {T.respaldo.titulo}
        </h2>
        <p className={cn('cuerpo-s', s.respaldo.faltan.length > 0 ? 'font-semibold text-flojo' : 'text-texto-suave')}>
          {s.respaldo.faltan.length > 0
            ? T.respaldo.noConfigurado(s.respaldo.faltan.join(' y '))
            : s.respaldo.ultimo
              ? T.respaldo.ultimo(
                  new Date(s.respaldo.ultimo.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }),
                  `${(s.respaldo.ultimo.bytes / 1024).toLocaleString('es-AR', { maximumFractionDigits: 0 })} KB`,
                  s.respaldo.cantidad,
                )
              : T.respaldo.ninguno}
        </p>
      </section>

      <section aria-labelledby="salud-errores" className="space-y-3">
        <h2 id="salud-errores" className="titulo-m text-texto">
          {T.errores.titulo}
        </h2>
        {s.sentry.errores === null ? (
          <p className="cuerpo-s text-texto-suave">{T.errores.sinToken}</p>
        ) : s.sentry.errores.length === 0 ? (
          <p className="cuerpo-s text-texto-suave">{T.errores.ninguno}</p>
        ) : (
          <ul className="space-y-2">
            {s.sentry.errores.map((e, i) => (
              <li key={i} className="rounded-lg border border-borde bg-superficie-tarjeta p-3">
                <a href={e.link} target="_blank" rel="noreferrer" className="cuerpo-s font-semibold text-texto underline-offset-2 hover:underline">
                  {e.titulo}
                </a>
                <p className="nota text-texto-suave">{T.errores.veces(e.veces)}</p>
              </li>
            ))}
          </ul>
        )}
        <a href={s.sentry.link} target="_blank" rel="noreferrer" className="cuerpo-s inline-flex min-h-11 items-center gap-1 font-semibold text-accion">
          {T.errores.abrirSentry} <ExternalLink className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        </a>
      </section>
    </main>
  )
}
