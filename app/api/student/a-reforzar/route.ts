import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { migrarDebilesDelNavegador } from '@/lib/a-reforzar-alumno-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * P7 · Los temas "A reforzar" que el navegador guardaba pasan a la base (como
 * la racha en O4). POST `{ debiles }` → `{ migrados }`. Siempre con el id del
 * viewer; sólo cuentas (Mi progreso es de quien tiene cuenta). El cliente,
 * con el 200, los borra del navegador.
 */
export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer || viewer.isGuest) return NextResponse.json({ error: 'Sin sesión' }, { status: 401 })
  const cuerpo = (await req.json().catch(() => null)) as { debiles?: unknown } | null
  try {
    return NextResponse.json({ migrados: await migrarDebilesDelNavegador(viewer.id, cuerpo?.debiles) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/a-reforzar', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
