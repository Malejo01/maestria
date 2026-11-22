import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { getViewer } from '@/lib/auth-session'
import { reportePropio } from '@/lib/reportes-server'
import { REPORTE_PROPIO as T } from '@/lib/textos'

/**
 * P3 · Un reporte propio: lo que la persona reportó y, si ya se resolvió, el
 * mensaje que le dejaron. Es a donde lleva "Tu reporte se resolvió" de la
 * campanita (el aviso grande de N1 se muestra sólo la primera vez). Con
 * cuenta o como invitado; un reporte ajeno es 404.
 */
export const dynamic = 'force-dynamic'

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

export default async function ReportePropioPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer()
  if (!viewer) notFound()
  const { id } = await params
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero <= 0) notFound()
  const reporte = await reportePropio(viewer.id, numero)
  if (!reporte) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <Link href="/aulas" className="nota inline-flex min-h-11 items-center gap-1 text-texto-suave hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} /> {T.volver}
      </Link>
      <h1 className="titulo-l text-texto">{T.titulo}</h1>

      <section className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4">
        <h2 className="etiqueta text-texto-suave">{T.loQueReportaste}</h2>
        <p className="cuerpo whitespace-pre-wrap break-words text-texto">{reporte.descripcion}</p>
        <p className="nota text-texto-suave">
          {reporte.cuestionario && <>{T.cuestionario(reporte.cuestionario)} · </>}
          {T.reportadoEl(fecha(reporte.reportadoEl))}
        </p>
      </section>

      {reporte.resueltoEl ? (
        <section className="space-y-2 rounded-lg border border-borde bg-logrado-fondo p-4">
          <h2 className="etiqueta text-logrado">{reporte.respuesta ? T.mensajeDe(reporte.respondidoPor) : T.resueltoEl(fecha(reporte.resueltoEl))}</h2>
          <p className="cuerpo whitespace-pre-wrap break-words text-texto">{reporte.respuesta ?? T.sinMensaje}</p>
          {reporte.respuesta && <p className="nota text-texto-suave">{T.resueltoEl(fecha(reporte.resueltoEl))}</p>}
        </section>
      ) : (
        <p className="cuerpo-s text-texto-suave">{T.pendiente}</p>
      )}
    </div>
  )
}
