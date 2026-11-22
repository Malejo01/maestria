import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { declararMayorDeEdad, leerAutodidacta } from '@/lib/autodidacta-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · E1 — GET: el estado del modo autodidacta (disponible, si declaró
 * ser mayor de 18, sus materias). POST { mayorDeEdad: true }: la declaración.
 * Hace falta una cuenta (no invitado).
 */
async function alumnoConCuenta() {
  const viewer = await getViewer()
  return viewer && !viewer.isGuest ? viewer : null
}

export async function GET() {
  const viewer = await alumnoConCuenta()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  try {
    return NextResponse.json(await leerAutodidacta(viewer.id))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const viewer = await alumnoConCuenta()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar con tu cuenta' }, { status: 401 })
  const cuerpo = (await req.json().catch(() => null)) as { mayorDeEdad?: unknown } | null
  if (cuerpo?.mayorDeEdad !== true) return NextResponse.json({ error: 'Tenés que declarar que sos mayor de 18' }, { status: 400 })
  try {
    await declararMayorDeEdad(viewer.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/autodidacta', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
