import { NextResponse } from 'next/server'
import { getAdminViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { esEstadoDeReporte } from '@/lib/reportes'
import { contarNuevos, listarReportes } from '@/lib/reportes-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/reportes?estado=nuevo|visto|resuelto — M6: el buzón.
 * `?resumen=1` devuelve sólo cuántos hay en 'nuevo' (la marca del menú).
 * Sólo ADMIN_EMAILS; al resto, 404 (no confirma que la ruta existe).
 */
export async function GET(req: Request) {
  const admin = await getAdminViewer()
  if (!admin) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  try {
    const url = new URL(req.url)
    if (url.searchParams.get('resumen') === '1') {
      return NextResponse.json({ nuevos: await contarNuevos() })
    }
    const estado = url.searchParams.get('estado')
    const reportes = await listarReportes(esEstadoDeReporte(estado) ? estado : null)
    return NextResponse.json({ reportes, nuevos: await contarNuevos() })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/admin/reportes', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron leer los reportes', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
