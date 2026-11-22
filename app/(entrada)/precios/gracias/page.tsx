import Link from 'next/link'
import { Logo } from '@/components/sistema/logo'
import { Boton } from '@/components/sistema/boton'
import { getViewer } from '@/lib/auth-session'
import { leerPago } from '@/lib/pagos-server'
import { formatearPesos } from '@/lib/planes'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — /precios/gracias?pago=N: la vuelta de Mercado Pago. El estado
 * sale de la tabla `pagos` (lo escribe el webhook), NUNCA de la URL: el
 * `estado` que trae la vuelta no se usa. Sólo el pago propio.
 */
export default async function GraciasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const id = Number(params.pago)
  const viewer = await getViewer()
  const pago = viewer && Number.isInteger(id) && id > 0 ? await leerPago(viewer.id, id).catch(() => null) : null

  const titulo = !pago ? T.gracias.noEncontrado : pago.estado === 'aprobado' ? T.gracias.aprobado : pago.estado === 'pendiente' ? T.gracias.pendiente : T.gracias.rechazado
  const detalle = !pago ? null : pago.estado === 'aprobado' ? T.gracias.aprobadoDetalle : pago.estado === 'pendiente' ? T.gracias.pendienteDetalle : T.gracias.rechazadoDetalle
  const tono = pago?.estado === 'aprobado' ? 'text-logrado' : pago?.estado === 'pendiente' ? 'text-texto' : 'text-flojo'

  return (
    <div className="w-full max-w-md space-y-6 text-center">
      <Logo className="mx-auto" />
      <div className="space-y-2" data-estado-del-pago={pago?.estado ?? 'no_encontrado'}>
        <h1 className={`titulo-l ${tono}`}>{titulo}</h1>
        {pago && (
          <p className="cuerpo text-texto">
            {pago.descripcion} · {formatearPesos(pago.monto)}
          </p>
        )}
        {detalle && <p className="cuerpo-s text-texto-suave">{detalle}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Boton asChild>
          <Link href="/teacher">{T.gracias.volverAlPanel}</Link>
        </Boton>
        {pago?.estado !== 'aprobado' && (
          <Boton asChild variante="secundario">
            <Link href="/precios">{T.gracias.volverAPrecios}</Link>
          </Boton>
        )}
      </div>
    </div>
  )
}
