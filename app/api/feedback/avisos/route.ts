import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import { getViewer } from '@/lib/auth-session'
import { veAvisos } from '@/lib/avisos-de-reporte'
import { captureRouteFailure } from '@/lib/observability'
import { avisosPendientes } from '@/lib/reportes-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feedback/avisos — N1: los reportes del viewer que se resolvieron y
 * cuyo aviso todavía no vio. La identidad sale de `getViewer()` (cuenta o
 * invitado), nunca del cliente: cada uno ve sólo los suyos. El admin no ve
 * avisos de sus propios reportes. Sin la 030, `{ avisos: [] }`.
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  if (!veAvisos({ isGuest: viewer.isGuest, esAdmin: !viewer.isGuest && isAdminEmail(viewer.email) })) {
    return NextResponse.json({ avisos: [] })
  }

  try {
    return NextResponse.json({ avisos: await avisosPendientes(viewer.id) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/feedback/avisos', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer los avisos' }, { status: 500 })
  }
}
