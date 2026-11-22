import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { leerPedido } from '@/lib/pagos'
import { iniciarCheckout } from '@/lib/pagos-server'
import { captureRouteFailure } from '@/lib/observability'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — POST /api/pagos/checkout { plan, forma, cantidad, codigo? }
 * Crea la fila en `pagos` y la preferencia de Checkout Pro con el monto que
 * calculó el servidor, y devuelve el link al que se redirige.
 */
export async function POST(req: Request) {
  const docente = await getTeacherViewer()
  if (!docente) return NextResponse.json({ error: T.entrar }, { status: 401 })
  const cuerpo = await req.json().catch(() => null)
  const pedido = leerPedido(cuerpo)
  if (!pedido) return NextResponse.json({ error: T.pedidoInvalido }, { status: 400 })
  try {
    const codigo = typeof (cuerpo as { codigo?: unknown })?.codigo === 'string' ? (cuerpo as { codigo: string }).codigo : ''
    const resultado = await iniciarCheckout({
      userId: docente.id,
      email: docente.email ?? null,
      pedido,
      textoDelCodigo: codigo,
      urlBase: new URL(req.url).origin,
    })
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 409 })
    return NextResponse.json({ url: resultado.url, pago: resultado.pagoId })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/pagos/checkout', operation: 'POST' })
    return NextResponse.json({ error: T.noSePudo }, { status: 502 })
  }
}
