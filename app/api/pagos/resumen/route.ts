import { NextResponse } from 'next/server'
import { leerPedido } from '@/lib/pagos'
import { resumenDelPago } from '@/lib/pagos-server'
import { pagadorDelPedido } from '@/lib/pagador-del-pedido'
import { captureRouteFailure } from '@/lib/observability'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — POST /api/pagos/resumen { plan, forma, cantidad, codigo? }
 * Lo que se muestra antes de pagar: lista, código, total y cómo se paga. El
 * monto lo calcula el servidor; nada del cuerpo entra al monto.
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
    return NextResponse.json(await resumenDelPago(pagador.id, pedido, codigo, pagador.materia))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/pagos/resumen', operation: 'POST' })
    return NextResponse.json({ error: T.noSePudo }, { status: 500 })
  }
}
