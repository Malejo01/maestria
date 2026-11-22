import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { avisosDelAlumno, marcarAvisosDelAlumnoLeidos } from '@/lib/avisos-alumno-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * P3 · La campanita del alumno (con cuenta o invitado). El id es SIEMPRE el
 * del viewer: no se acepta ningún id del cliente, así que nadie puede pedir
 * los avisos de otro.
 *   GET  → RespuestaDeAvisos (de lo que ya hay en la base)
 *   POST → "Marcar todo como leído"
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar' }, { status: 401 })
  try {
    return NextResponse.json(await avisosDelAlumno(viewer.id, { esInvitado: viewer.isGuest }))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/avisos', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudieron leer los avisos' }, { status: 500 })
  }
}

export async function POST() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar' }, { status: 401 })
  try {
    await marcarAvisosDelAlumnoLeidos(viewer.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/avisos', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
