import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'
import { leerEstadoDePracticaExtra, reservarPracticaExtra } from '@/lib/practica-extra-server'
import { PRACTICA_EXTRA } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * P4 · "Practicar otra vez con preguntas nuevas" (alumno con cuenta o invitado).
 *   GET  ?asignacion=N → EstadoDePracticaExtra (si el botón aparece, y cuántas quedan hoy)
 *   POST { asignacion } → reserva una práctica: { id, classroomId, config, restantes }
 *                          o 429 con el texto del tope.
 * Siempre con el id del viewer.
 */
const idDe = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export async function GET(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar' }, { status: 401 })
  const asignacion = idDe(new URL(req.url).searchParams.get('asignacion'))
  if (!asignacion) return NextResponse.json({ error: 'Falta la tarea' }, { status: 400 })
  try {
    return NextResponse.json(await leerEstadoDePracticaExtra(viewer.id, asignacion))
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/practica-extra', operation: 'GET' })
    return NextResponse.json({ error: 'No se pudo leer' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const viewer = await getViewer()
  if (!viewer) return NextResponse.json({ error: 'Necesitás entrar' }, { status: 401 })
  const asignacion = idDe(((await req.json().catch(() => null)) as { asignacion?: unknown } | null)?.asignacion)
  if (!asignacion) return NextResponse.json({ error: 'Falta la tarea' }, { status: 400 })
  try {
    const reserva = await reservarPracticaExtra(viewer.id, asignacion)
    if (reserva.ok) return NextResponse.json(reserva)
    if (reserva.estado.motivo === 'tope') {
      return NextResponse.json({ error: PRACTICA_EXTRA.tope, estado: reserva.estado }, { status: 429 })
    }
    return NextResponse.json({ error: PRACTICA_EXTRA.noDisponible, estado: reserva.estado }, { status: 403 })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/student/practica-extra', operation: 'POST' })
    return NextResponse.json({ error: 'No se pudo armar la práctica' }, { status: 500 })
  }
}
