import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { leerPedido } from '@/lib/pagos'
import { resumenDelPago } from '@/lib/pagos-server'
import { captureRouteFailure } from '@/lib/observability'
import { PAGAR as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C2 — POST /api/pagos/resumen { plan, forma, cantidad, codigo? }
 * Lo que se muestra antes de pagar: lista, código, total y cómo se paga. El
 * monto lo calcula el servidor; nada del cuerpo entra al monto.
 */
export async function POST(req: Request) {
  const docente = await getTeacherViewer()
  if (!docente) return NextResponse.json({ error: T.entrar }, { status: 401 })
  const cuerpo = await req.json().catch(() => null)
  const pedido = leerPedido(cuerpo)
  if (!pedido) return NextResponse.json({ error: T.pedidoInvalido }, { status: 400 })
  try {
    const codigo = typeof (cuerpo as { codigo?: unknown })?.codigo === 'string' ? (cuerpo as { codigo: string }).codigo : ''
    return NextResponse.json(await resumenDelPago(docente.id, pedido, codigo))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/pagos/resumen', operation: 'POST' })
    return NextResponse.json({ error: T.noSePudo }, { status: 500 })
  }
}
