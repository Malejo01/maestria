import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { captureRouteFailure } from '@/lib/observability'

/**
 * Marca de "este docente ya vio el tour de bienvenida" (migración 020).
 *
 * Es una ruta propia y no un campo más del PATCH de `/api/user/profile` porque
 * ese endpoint es el que completa el onboarding de rol: acepta `role` y con eso
 * pone `is_onboarded = true`. Colgarle el tour lo convertiría en un cajón de
 * sastre donde un bug de tipeo en el cliente puede cambiarle el rol a alguien.
 * Acá el único efecto posible es estampar una fecha.
 *
 * Pasa por `getTeacherViewer()`, que releela el rol desde la base y descarta
 * invitados — un alumno no tiene tour que marcar.
 */

export async function GET() {
  const viewer = await getTeacherViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const rows = (await sql`
      SELECT teacher_tour_seen_at FROM users WHERE id = ${viewer.id} LIMIT 1
    `) as { teacher_tour_seen_at: string | null }[]

    return NextResponse.json({ seenAt: rows[0]?.teacher_tour_seen_at ?? null })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/tour', operation: 'GET' })
    // Un fallo acá no puede trabar el panel: el cliente trata el error como
    // "ya lo vio" y no muestra el tour, que es el lado seguro de equivocarse.
    // Mostrárselo de nuevo a alguien que ya lo completó es más molesto que no
    // mostrárselo a alguien nuevo, que igual tiene los tres caminos a la vista
    // en el wizard.
    return NextResponse.json(
      { error: 'No se pudo leer el estado del tour', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST() {
  const viewer = await getTeacherViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // COALESCE y no un UPDATE pelado: si el docente vuelve a abrir el tour a
    // mano y lo cierra, la fecha original es la que importa. Sobrescribirla
    // haría que "lo vio antes de tal fecha" deje de ser una pregunta contestable.
    const rows = (await sql`
      UPDATE users
      SET teacher_tour_seen_at = COALESCE(teacher_tour_seen_at, NOW()),
          updated_at = NOW()
      WHERE id = ${viewer.id}
      RETURNING teacher_tour_seen_at
    `) as { teacher_tour_seen_at: string | null }[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ seenAt: rows[0].teacher_tour_seen_at })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/tour', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo guardar el estado del tour', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
