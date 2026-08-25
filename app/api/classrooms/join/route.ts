import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getViewer } from '@/lib/auth-session'
import { isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { captureRouteFailure } from '@/lib/observability'
import {
  GUEST_COOKIE_NAME,
  guestCookieOptions,
  newGuestId,
  signGuestToken,
} from '@/lib/guest-session'

export const dynamic = 'force-dynamic'

/**
 * GET /api/classrooms/join?code=ABC234
 *
 * Read-only preview so the join page can say "Matemática · 3er Año, de Prof.
 * X" before asking the student for anything. Deliberately anonymous: knowing
 * the code is what grants the preview.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = normalizeJoinCode(searchParams.get('code') ?? '')

  if (!isValidJoinCode(code)) {
    return NextResponse.json({ error: 'El código tiene 6 caracteres.' }, { status: 400 })
  }

  try {
    const rows = await sql`
      SELECT c.id, c.name, c.status, p.subject_name, p.nivel, p.grado, p.icon_name, p.color_name,
             COALESCE(t.name, 'Docente') AS teacher_name
      FROM classrooms c
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      JOIN users t ON t.id = c.teacher_id
      WHERE c.join_code = ${code}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontramos ningún aula con ese código.' }, { status: 404 })
    }

    if (rows[0].status === 'closed') {
      return NextResponse.json({ error: 'Esa aula está cerrada por el docente.' }, { status: 403 })
    }

    const viewer = await getViewer()

    return NextResponse.json({
      classroom: rows[0],
      viewer: viewer ? { displayName: viewer.displayName, isGuest: viewer.isGuest } : null,
    })
  } catch (error) {
    // Camino de invitado sin cuenta: si esto falla, el alumno no reporta nada
    // — se va. Que por lo menos quede el evento.
    captureRouteFailure(error, { endpoint: '/api/classrooms/join', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo buscar el aula', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/classrooms/join — { code, displayName? }
 *
 * Three entry paths converge here:
 *  - a signed-in student: name comes from their Google account, is_verified
 *  - an existing guest (cookie present): reuses their guest row
 *  - a brand-new guest: needs displayName, gets a guest row + signed cookie
 *
 * Re-joining is idempotent, and re-joining an aula you were removed from
 * reinstates the same membership row instead of creating a second one.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const code = normalizeJoinCode(body?.code ?? '')
    const requestedName = String(body?.displayName ?? '').trim().slice(0, 80)

    if (!isValidJoinCode(code)) {
      return NextResponse.json({ error: 'El código tiene 6 caracteres.' }, { status: 400 })
    }

    const classroomRows = await sql`
      SELECT c.id, c.name, c.status, c.teacher_program_id, p.subject_name
      FROM classrooms c
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      WHERE c.join_code = ${code}
      LIMIT 1
    `

    if (classroomRows.length === 0) {
      return NextResponse.json({ error: 'No encontramos ningún aula con ese código.' }, { status: 404 })
    }

    const classroom = classroomRows[0]
    if (classroom.status === 'closed') {
      return NextResponse.json({ error: 'Esa aula está cerrada por el docente.' }, { status: 403 })
    }

    const viewer = await getViewer()

    // Already identified (Google account or an existing guest cookie).
    if (viewer) {
      const displayName = requestedName || viewer.displayName || 'Alumno/a'

      await sql`
        INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
        VALUES (${classroom.id}, ${viewer.id}, ${displayName}, ${!viewer.isGuest}, 'active', NOW(), NOW())
        ON CONFLICT (classroom_id, user_id) DO UPDATE
          SET status = 'active',
              display_name = EXCLUDED.display_name,
              is_verified = EXCLUDED.is_verified,
              updated_at = NOW()
      `

      // A guest who re-joins under a new name should be renamed everywhere,
      // otherwise the teacher sees two different labels for the same person.
      if (viewer.isGuest && requestedName) {
        await sql`UPDATE users SET name = ${requestedName}, updated_at = NOW() WHERE id = ${viewer.id}`
      }

      return NextResponse.json({
        classroomId: classroom.id,
        classroomName: classroom.name,
        subjectName: classroom.subject_name,
        isGuest: viewer.isGuest,
      })
    }

    // Brand-new guest: the name is the only identity we'll have.
    if (!requestedName) {
      return NextResponse.json(
        { error: 'Escribí tu nombre y apellido para entrar al aula.', needsName: true },
        { status: 400 }
      )
    }

    const guestId = newGuestId()

    await sql`
      INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
      VALUES (${guestId}, NULL, ${requestedName}, 'ALUMNO', true, true, NOW(), NOW())
    `

    await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      VALUES (${classroom.id}, ${guestId}, ${requestedName}, false, 'active', NOW(), NOW())
    `

    const response = NextResponse.json({
      classroomId: classroom.id,
      classroomName: classroom.name,
      subjectName: classroom.subject_name,
      isGuest: true,
      createdGuest: true,
    })

    response.cookies.set(GUEST_COOKIE_NAME, await signGuestToken(guestId), guestCookieOptions())
    return response
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/classrooms/join', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo entrar al aula', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
