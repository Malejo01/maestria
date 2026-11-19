import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getViewer } from '@/lib/auth-session'
import { isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { captureGuestJoinCapReached, captureRouteFailure } from '@/lib/observability'
import {
  GUEST_CAP_REACHED_MESSAGE,
  classroomDailyNewGuestLimit,
  countNewGuestsInClassroom,
} from '@/lib/classroom-guest-cap'
import {
  GUEST_COOKIE_NAME,
  guestCookieOptions,
  newGuestId,
  signGuestToken,
} from '@/lib/guest-session'
import { grupoTieneLugarPara } from '@/lib/planes-server'
import { MENSAJE_GRUPO_SIN_LUGAR } from '@/lib/planes'
import {
  invitacionPorNombre,
  pendientesDelGrupo,
  usarInvitacion,
  type InvitacionPendiente,
} from '@/lib/invitacion-al-entrar-server'

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
      return NextResponse.json({ error: 'No encontramos ningún grupo con ese código.' }, { status: 404 })
    }

    if (rows[0].status === 'closed') {
      return NextResponse.json({ error: 'Ese grupo está cerrado por el docente.' }, { status: 403 })
    }

    const viewer = await getViewer()

    // K5: los alumnos que el docente ya sumó por nombre y todavía no entraron,
    // para que quien llega pueda decir "soy yo". No a quien ya está en el grupo.
    let pendientes: InvitacionPendiente[] = []
    const yaEsMiembro = viewer
      ? ((await sql`
          SELECT 1 FROM classroom_members
          WHERE classroom_id = ${rows[0].id} AND user_id = ${viewer.id} AND status = 'active'
          LIMIT 1
        `) as unknown[]).length > 0
      : false
    if (!yaEsMiembro) pendientes = await pendientesSinRomper(Number(rows[0].id))

    return NextResponse.json({
      classroom: rows[0],
      viewer: viewer ? { displayName: viewer.displayName, isGuest: viewer.isGuest } : null,
      pendientes,
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
    const invitacionPedida = Number.isInteger(body?.invitacionId) && body.invitacionId > 0 ? Number(body.invitacionId) : null

    if (!isValidJoinCode(code)) {
      return NextResponse.json({ error: 'El código tiene 6 caracteres.' }, { status: 400 })
    }

    const classroomRows = await sql`
      SELECT c.id, c.name, c.status, c.teacher_program_id, c.teacher_id, p.subject_name
      FROM classrooms c
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      WHERE c.join_code = ${code}
      LIMIT 1
    `

    if (classroomRows.length === 0) {
      return NextResponse.json({ error: 'No encontramos ningún grupo con ese código.' }, { status: 404 })
    }

    const classroom = classroomRows[0]
    if (classroom.status === 'closed') {
      return NextResponse.json({ error: 'Ese grupo está cerrado por el docente.' }, { status: 403 })
    }

    const viewer = await getViewer()

    // K5: ¿entra como un alumno que el docente ya había sumado por nombre? Lo
    // eligió en "¿Sos alguno de estos?", o escribió exactamente ese nombre.
    const pendientes = await pendientesSinRomper(Number(classroom.id))
    let invitacion: InvitacionPendiente | null = null
    if (invitacionPedida !== null) {
      invitacion = pendientes.find((i) => i.id === invitacionPedida) ?? null
      if (!invitacion) {
        return NextResponse.json(
          { error: 'Ese nombre ya no está esperando en el grupo. Entrá con el tuyo.', invitacionUsada: true },
          { status: 409 },
        )
      }
    } else {
      invitacion = invitacionPorNombre(pendientes, requestedName || (viewer?.displayName ?? ''))
    }
    const nombreDeInvitacion = invitacion?.nombre ?? ''

    // Already identified (Google account or an existing guest cookie).
    if (viewer) {
      const displayName = nombreDeInvitacion || requestedName || viewer.displayName || 'Alumno/a'

      // Cupo del plan del docente (lib/planes.ts): sólo frena a quien ocuparía
      // un lugar nuevo.
      const hayLugar = await grupoTieneLugarPara({
        teacherId: String(classroom.teacher_id),
        classroomId: Number(classroom.id),
        userId: viewer.id,
        nombre: displayName,
      })
      if (!hayLugar) {
        return NextResponse.json({ error: MENSAJE_GRUPO_SIN_LUGAR, grupoSinLugar: true }, { status: 402 })
      }

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
      if (viewer.isGuest && (nombreDeInvitacion || requestedName)) {
        await sql`UPDATE users SET name = ${nombreDeInvitacion || requestedName}, updated_at = NOW() WHERE id = ${viewer.id}`
      }

      if (invitacion) await usarInvitacionSinRomper(Number(classroom.id), invitacion.id, viewer.id)

      return NextResponse.json({
        classroomId: classroom.id,
        classroomName: classroom.name,
        subjectName: classroom.subject_name,
        isGuest: viewer.isGuest,
      })
    }

    // Brand-new guest: the name is the only identity we'll have.
    const nombreDelInvitado = nombreDeInvitacion || requestedName
    if (!nombreDelInvitado) {
      return NextResponse.json(
        { error: 'Escribí tu nombre y apellido para entrar al aula.', needsName: true },
        { status: 400 }
      )
    }

    // Recién acá, en el único camino que crea un invitado: el que vuelve con
    // su cookie o entra con Google ya salió arriba y nunca choca con el tope.
    // El rechazo no se disfraza: el alumno ve por qué y cómo entrar igual
    // (con Google, que en esta pantalla está al lado), el docente lo ve en su
    // panel y a nosotros nos llega a Sentry.
    const hayLugar = await grupoTieneLugarPara({
      teacherId: String(classroom.teacher_id),
      classroomId: Number(classroom.id),
      userId: null,
      nombre: nombreDelInvitado,
    })
    if (!hayLugar) {
      return NextResponse.json({ error: MENSAJE_GRUPO_SIN_LUGAR, grupoSinLugar: true }, { status: 402 })
    }

    const limit = classroomDailyNewGuestLimit()
    const newGuests = await countNewGuestsInClassroom(classroom.id)
    if (newGuests >= limit) {
      captureGuestJoinCapReached({ classroomId: classroom.id, newGuests, limit })
      return NextResponse.json({ error: GUEST_CAP_REACHED_MESSAGE, guestCapReached: true }, { status: 429 })
    }

    const guestId = newGuestId()

    await sql`
      INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
      VALUES (${guestId}, NULL, ${nombreDelInvitado}, 'ALUMNO', true, true, NOW(), NOW())
    `

    await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      VALUES (${classroom.id}, ${guestId}, ${nombreDelInvitado}, false, 'active', NOW(), NOW())
    `

    if (invitacion) await usarInvitacionSinRomper(Number(classroom.id), invitacion.id, guestId)

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

/**
 * K5: lo de las invitaciones es una ayuda para entrar, no una condición. Si
 * falla (o falta la migración que lo sostiene), se entra como siempre.
 */
async function pendientesSinRomper(classroomId: number): Promise<InvitacionPendiente[]> {
  try {
    return await pendientesDelGrupo(classroomId)
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/classrooms/join', operation: 'pendientes' })
    return []
  }
}

async function usarInvitacionSinRomper(classroomId: number, invitacionId: number, userId: string): Promise<void> {
  try {
    await usarInvitacion({ classroomId, invitacionId, userId })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/classrooms/join', operation: 'usar-invitacion' })
  }
}
