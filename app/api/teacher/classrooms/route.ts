import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTeacherViewer } from '@/lib/auth-session'
import { createUniqueJoinCode } from '@/lib/classrooms-server'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

// GET /api/teacher/classrooms — every aula of the signed-in teacher, with the
// two counts the dashboard cards show.
export async function GET() {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden ver aulas' }, { status: 403 })
  }

  try {
    const rows = await sql`
      SELECT c.id,
             c.teacher_program_id,
             c.name,
             c.join_code,
             c.status,
             c.created_at,
             p.subject_name,
             p.nivel,
             p.grado,
             p.icon_name,
             p.color_name,
             (SELECT COUNT(*)::int FROM classroom_members m
               WHERE m.classroom_id = c.id AND m.status = 'active') AS member_count,
             (SELECT COUNT(*)::int FROM classroom_assignments a
               WHERE a.classroom_id = c.id) AS assignment_count
      FROM classrooms c
      JOIN teacher_programs p ON p.id = c.teacher_program_id
      WHERE c.teacher_id = ${teacher.id}
      ORDER BY c.created_at DESC
    `

    return NextResponse.json({ classrooms: rows })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudieron obtener las aulas', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// POST /api/teacher/classrooms — create an aula for one of the teacher's own
// programs. The join code is generated here; the teacher never picks it.
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) {
    return NextResponse.json({ error: 'Solo docentes pueden crear aulas' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const teacherProgramId = Number(body?.teacherProgramId)
    const name = String(body?.name ?? '').trim()

    if (!Number.isFinite(teacherProgramId) || teacherProgramId <= 0) {
      return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Poné un nombre al aula (por ejemplo "3° A turno mañana")' }, { status: 400 })
    }

    const programRows = await sql`
      SELECT id, subject_name, nivel, grado
      FROM teacher_programs
      WHERE id = ${teacherProgramId} AND user_id = ${teacher.id} AND status = 'active'
      LIMIT 1
    `

    if (programRows.length === 0) {
      return NextResponse.json({ error: 'La materia no pertenece a este docente' }, { status: 403 })
    }

    const joinCode = await createUniqueJoinCode()

    const rows = await sql`
      INSERT INTO classrooms (teacher_id, teacher_program_id, name, join_code, status, created_at, updated_at)
      VALUES (${teacher.id}, ${teacherProgramId}, ${name}, ${joinCode}, 'open', NOW(), NOW())
      RETURNING id, teacher_program_id, name, join_code, status, created_at
    `

    return NextResponse.json({
      classroom: {
        ...rows[0],
        subject_name: programRows[0].subject_name,
        nivel: programRows[0].nivel,
        grado: programRows[0].grado,
        member_count: 0,
        assignment_count: 0,
      },
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/classrooms', operation: 'POST' })
    return NextResponse.json(
      { error: 'No se pudo crear el aula', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
