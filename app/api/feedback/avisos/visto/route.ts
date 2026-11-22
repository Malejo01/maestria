import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { idsDesdeElCuerpo } from '@/lib/avisos-de-reporte'
import { captureRouteFailure } from '@/lib/observability'
import { marcarAvisosVistos } from '@/lib/reportes-server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/feedback/avisos/visto — { ids: number[] }. N1: el botón
 * "Entendido". Marca `aviso_visto_el` sólo en reportes del propio viewer
 * (la consulta filtra por su id): mandar el id de un reporte ajeno no hace nada.
 */
export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })

  const ids = idsDesdeElCuerpo(await req.json().catch(() => null))
  if (ids.length === 0) return NextResponse.json({ error: 'Faltan los ids' }, { status: 400 })

  try {
    return NextResponse.json({ marcados: await marcarAvisosVistos(viewer.id, ids) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/feedback/avisos/visto', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
