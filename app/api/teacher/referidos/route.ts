import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { misReferidos } from '@/lib/referidos-server'
import { urlDelSitio } from '@/lib/sitio'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda V · V3 — GET: el código y el link de referido del docente, y cuántos
 * se registraron, pagaron y cuántos días ganó. `activo: false` sin
 * MAESTRIA_REFERIDOS_ACTIVO=1 o sin la 046 (la interfaz no muestra nada).
 */
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const datos = await misReferidos(teacher.id)
    // El link es `/?ref=CODIGO`: el canal (V1) no se sabe, lo elige quien lo comparte.
    return NextResponse.json({ ...datos, link: datos.codigo ? `${urlDelSitio()}/?ref=${encodeURIComponent(datos.codigo)}` : null })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/referidos', operation: 'GET' })
    return NextResponse.json({ activo: false })
  }
}
