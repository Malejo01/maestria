import { NextResponse } from 'next/server'
import { firmaValida } from '@/lib/pagos'
import { procesarNotificacion } from '@/lib/pagos-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — El webhook de Mercado Pago (POST /api/pagos/mercadopago).
 *
 *   1. Valida la firma (`x-signature`, con MERCADOPAGO_WEBHOOK_SECRET). Si no
 *      coincide: 401 y no se hace nada.
 *   2. Sólo le importan los pagos (`type: payment`); lo demás, 200 y nada.
 *   3. Consulta el pago a la API de Mercado Pago (nunca confía en el cuerpo) y,
 *      si está aprobado, acredita el plan una sola vez (lib/pagos-server.ts).
 *
 * Responde 200 aunque falle el proceso: Mercado Pago reintenta lo que no da
 * 2xx, y el proceso es idempotente; la falla queda en Sentry.
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const cuerpo = (await req.json().catch(() => null)) as { type?: unknown; action?: unknown; data?: { id?: unknown } } | null
  const dataId = String(url.searchParams.get('data.id') ?? cuerpo?.data?.id ?? '') || null
  const tipo = String(url.searchParams.get('type') ?? cuerpo?.type ?? '')

  const valida = firmaValida({
    firma: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    dataId,
    secreto: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  })
  if (!valida) return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  if (tipo !== 'payment' || !dataId) return NextResponse.json({ ok: true })

  try {
    const resultado = await procesarNotificacion(dataId)
    return NextResponse.json({ ok: true, resultado })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/pagos/mercadopago', operation: 'POST' })
    return NextResponse.json({ ok: false })
  }
}
