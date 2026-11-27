import { NextResponse } from 'next/server'
import { correrAvisoSemanal } from '@/lib/aviso-semanal-server'
import { pedidoAutorizado } from '@/lib/respaldo'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/cron/aviso-semanal
 *
 * AC5: el cron de Vercel de los lunes a las 9 de Argentina (12:00 UTC,
 * vercel.json) deja en la campanita de cada docente con alumnos el resumen de
 * «Esta semana». Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 *
 * Sin `CRON_SECRET` cargada, o con otro valor: 401 y no hace nada.
 * Idempotente: correrlo dos veces el mismo lunes deja un solo aviso.
 */
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET?.trim()
  if (!pedidoAutorizado(req.headers.get('authorization'), secreto)) {
    return NextResponse.json({ ok: false, error: 'No autorizado', configurado: Boolean(secreto) }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await correrAvisoSemanal()) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/cron/aviso-semanal', operation: 'GET' })
    return NextResponse.json({ ok: false, error: 'No se pudo armar el aviso' }, { status: 500 })
  }
}
