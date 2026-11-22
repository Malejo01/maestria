import { NextResponse } from 'next/server'
import { leerPedido } from '@/lib/pagos'
import { iniciarCheckout } from '@/lib/pagos-server'
import { pagadorDelPedido } from '@/lib/pagador-del-pedido'
import { captureRouteFailure } from '@/lib/observability'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — POST /api/pagos/checkout { plan, forma, cantidad, codigo? }
 * Crea la fila en `pagos` y la preferencia de Checkout Pro con el monto que
 * calculó el servidor, y devuelve el link al que se redirige.
 */
export async function POST(req: Request) {
  const cuerpo = await req.json().catch(() => null)
  const pedido = leerPedido(cuerpo)
  if (!pedido) return NextResponse.json({ error: T.pedidoInvalido }, { status: 400 })
  try {
    // E2: el pase de alumno lo paga el alumno dueño de la materia; el resto, el docente.
    const pagador = await pagadorDelPedido(pedido)
    if (!pagador.ok) return NextResponse.json({ error: pagador.status === 401 ? T.entrar : T.pedidoInvalido }, { status: pagador.status })
    const codigo = typeof (cuerpo as { codigo?: unknown })?.codigo === 'string' ? (cuerpo as { codigo: string }).codigo : ''
    const resultado = await iniciarCheckout({
      userId: pagador.id,
      email: pagador.email,
      pedido,
      textoDelCodigo: codigo,
      urlBase: new URL(req.url).origin,
      materia: pagador.materia,
    })
    if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: 409 })
    return NextResponse.json({ url: resultado.url, pago: resultado.pagoId })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/pagos/checkout', operation: 'POST' })
    return NextResponse.json({ error: T.noSePudo }, { status: 502 })
  }
}
