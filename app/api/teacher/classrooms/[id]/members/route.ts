import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { getClassroomMembers, getOwnedClassroom } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver la lista de alumnos' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = Number(id)
  if (!Number.isFinite(classroomId) || classroomId <= 0) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ members: await getClassroomMembers(classroomId) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/members', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo obtener la lista de alumnos', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST — copy the roster from another of the teacher's aulas.
 *
 * This is the "reusar alumnos" flow: a teacher who gives three subjects to the
 * same course shouldn't have to re-distribute a code each time. Students that
 * are already members are left untouched (ON CONFLICT DO NOTHING), and a
 * previously removed student is reinstated rather than duplicated.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden agregar alumnos' }, { status: 403 })
  }

  const { id } = await params
  const classroomId = Number(id)
  if (!Number.isFinite(classroomId) || classroomId <= 0) {
    return NextResponse.json({ error: 'Id de aula inválido' }, { status: 400 })
  }

  try {
    const classroom = await getOwnedClassroom(classroomId, teacher.id)
    if (!classroom) {
      return NextResponse.json({ error: 'Aula no encontrada' }, { status: 404 })
    }

    const body = await req.json()
    const sourceClassroomId = Number(body?.sourceClassroomId)

    if (!Number.isFinite(sourceClassroomId) || sourceClassroomId <= 0) {
      return NextResponse.json({ error: 'Elegí el aula de origen' }, { status: 400 })
    }

    if (sourceClassroomId === classroomId) {
      return NextResponse.json({ error: 'El aula de origen y la de destino son la misma' }, { status: 400 })
    }

    const source = await getOwnedClassroom(sourceClassroomId, teacher.id)
    if (!source) {
      return NextResponse.json({ error: 'El aula de origen no pertenece a este docente' }, { status: 403 })
    }

    const inserted = await sql`
      INSERT INTO classroom_members (classroom_id, user_id, display_name, is_verified, status, joined_at, updated_at)
      SELECT ${classroomId}, m.user_id, m.display_name, m.is_verified, 'active', NOW(), NOW()
      FROM classroom_members m
      WHERE m.classroom_id = ${sourceClassroomId} AND m.status = 'active'
      ON CONFLICT (classroom_id, user_id) DO UPDATE
        SET status = 'active', updated_at = NOW()
      RETURNING id
    `

    return NextResponse.json({ copied: inserted.length, members: await getClassroomMembers(classroomId) })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms/[id]/members', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudieron copiar los alumnos', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
