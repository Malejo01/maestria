import { NextResponse } from 'next/server'
import { faltaParaRespaldar, pedidoAutorizado } from '@/lib/respaldo'
import { hacerRespaldo } from '@/lib/respaldo-server'
import { captureRouteFailure } from '@/lib/observability'

/**
 * Ronda Y · Y2 — GET /api/cron/respaldo: el respaldo diario. Lo llama el cron
 * de Vercel (vercel.json) con `Authorization: Bearer <CRON_SECRET>`, que tiene
 * que ser el mismo valor que `RESPALDO_SECRETO`.
 *
 * Válvula: sin `BLOB_READ_WRITE_TOKEN` o sin `RESPALDO_SECRETO` no hace nada
 * (503, y /admin/salud dice qué falta). Sin el secreto correcto, 401.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const faltan = faltaParaRespaldar(process.env)
  if (faltan.length > 0) return NextResponse.json({ ok: false, configurado: false, faltan }, { status: 503 })
  if (!pedidoAutorizado(req.headers.get('authorization'), process.env.RESPALDO_SECRETO?.trim())) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }
  try {
    return NextResponse.json({ ok: true, ...(await hacerRespaldo()) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/cron/respaldo', operation: 'GET' })
    return NextResponse.json({ ok: false, error: 'No se pudo hacer el respaldo' }, { status: 500 })
  }
}
