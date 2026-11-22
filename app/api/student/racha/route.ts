import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerRacha, migrarRachaDelNavegador } from '@/lib/racha-server'

export const dynamic = 'force-dynamic'

/**
 * O4 · La racha del viewer (cuenta o invitado), de `rachas_alumno` (032).
 *
 * GET  → `{ racha: number | null }`: null si todavía no tiene fila (o falta la 032).
 * POST `{ delNavegador }` → la primera vez, la racha que tenía el navegador
 *       pasa a la base; si ya había fila, manda la base. Devuelve la que quedó.
 */
export async function GET() {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  try {
    return NextResponse.json({ racha: (await leerRacha(viewer.id))?.racha ?? null })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/racha', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer la racha' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const cuerpo = (await req.json().catch(() => null)) as { delNavegador?: unknown } | null
  try {
    return NextResponse.json({ racha: await migrarRachaDelNavegador(viewer.id, cuerpo?.delNavegador) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/racha', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar la racha' }, { status: 500 })
  }
}
