import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { upsertTeacherSubject } from '@/lib/subjects'
import { resolveGradoForNivel } from '@/lib/grado-server'
import { parseCreatedFrom, parseNivel, withDerivedPedagogyProfile } from '@/lib/teacher-programs'
import type { PedagogyProfile, ProgramUnit, SubjectColorName, SubjectIconName } from '@/lib/types'

function isTeacherRole(role: unknown): boolean {
  return role === 'DOCENTE'
}

async function requireTeacher(userId: string) {
  const rows = await sql`
    SELECT COALESCE(role, 'ALUMNO') AS role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 && isTeacherRole(rows[0].role)
}

async function getTeacherProgram(programId: number, userId: string) {
  const rows = await sql`
    SELECT id, user_id, subject_name, icon_name, color_name, pedagogy_profile, units, source_file_name, created_at,
           nivel, grado, jurisdiccion, created_from
    FROM teacher_programs
    WHERE id = ${programId} AND user_id = ${userId} AND status = 'active'
    LIMIT 1
  `

  return rows[0] || null
}

/**
 * Ronda T · A2: un programa guardado antes de la ronda T no tiene área. Se
 * infiere al abrirlo y se guarda esa primera vez (sólo si sigue sin área: no
 * pisa lo que otra pestaña haya guardado). Si no se puede guardar, se
 * devuelve igual con el área inferida.
 */
async function conAreaGuardada(program: Record<string, unknown>, userId: string) {
  const perfil = (program.pedagogy_profile ?? {}) as PedagogyProfile
  const conArea = completarAreaDelPrograma({
    materia: String(program.subject_name ?? ''),
    carrera: perfil?.degree,
    perfil,
    unidades: Array.isArray(program.units) ? (program.units as ProgramUnit[]) : [],
  })
  if (!conArea.cambio) return program
  try {
    await sql`
      UPDATE teacher_programs
      SET pedagogy_profile = ${JSON.stringify(conArea.perfil)}, units = ${JSON.stringify(conArea.unidades)}
      WHERE id = ${Number(program.id)} AND user_id = ${userId}
        AND (pedagogy_profile ->> 'area') IS NULL
    `
  } catch (error) {
    console.error('No se pudo guardar el área inferida del programa', error)
  }
  return { ...program, pedagogy_profile: conArea.perfil, units: conArea.unidades }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden consultar programas' }, { status: 403 })
    }

    const { id } = await params
    const programId = Number(id)
    if (!Number.isFinite(programId) || programId <= 0) {
      return NextResponse.json({ error: 'Id de programa invalido' }, { status: 400 })
    }

    const program = await getTeacherProgram(programId, userId)
    if (!program) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ program: await conAreaGuardada(program, userId) })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo obtener el programa', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden editar programas' }, { status: 403 })
    }

    const { id } = await params
    const programId = Number(id)
    if (!Number.isFinite(programId) || programId <= 0) {
      return NextResponse.json({ error: 'Id de programa invalido' }, { status: 400 })
    }

    const existingProgram = await getTeacherProgram(programId, userId)
    if (!existingProgram) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })
    }

    const body = await req.json()

    const subjectName = body?.subjectName ? String(body.subjectName).trim() : String(existingProgram.subject_name)
    const iconName = (body?.iconName ? String(body.iconName) : String(existingProgram.icon_name)) as SubjectIconName
    const colorName = (body?.colorName ? String(body.colorName) : String(existingProgram.color_name)) as SubjectColorName
    const units = (Array.isArray(body?.units) ? body.units : existingProgram.units) as ProgramUnit[]
    const pedagogyProfile = (body?.pedagogyProfile || existingProgram.pedagogy_profile) as PedagogyProfile

    // nivel/grado/jurisdiccion are only overwritten when the caller sends them,
    // so a partial PATCH from an older client can't wipe them.
    const nivel = body?.nivel === undefined ? parseNivel(existingProgram.nivel) : parseNivel(body.nivel)
    const jurisdiccion =
      body?.jurisdiccion === undefined
        ? (existingProgram.jurisdiccion as string | null)
        : String(body.jurisdiccion).trim() || null
    // Re-resolved even when the client didn't send grado: editing a program
    // created before this normalization existed is what repairs its "6".
    const grado = await resolveGradoForNivel(
      nivel,
      body?.grado === undefined ? (existingProgram.grado as string | null) : (body.grado ?? null),
      jurisdiccion ?? undefined
    )
    const createdFrom = parseCreatedFrom(
      body?.createdFrom,
      parseCreatedFrom(existingProgram.created_from)
    )

    if (!subjectName) {
      return NextResponse.json({ error: 'La materia es obligatoria' }, { status: 400 })
    }

    if (body?.nivel && !nivel) {
      return NextResponse.json({ error: 'El nivel debe ser Primario, Secundario o Superior' }, { status: 400 })
    }

    if (!Array.isArray(units) || units.length === 0) {
      return NextResponse.json({ error: 'Falta al menos una unidad' }, { status: 400 })
    }

    // Ronda T · A2: el área y el carácter de cada unidad, siempre completos.
    // Lo inferido se vuelve a inferir (el nombre pudo cambiar); lo de la IA
    // y lo elegido a mano, no.
    const perfilBase = withDerivedPedagogyProfile(pedagogyProfile, nivel, grado)
    const conArea = completarAreaDelPrograma({
      materia: subjectName,
      carrera: pedagogyProfile?.degree,
      perfil:
        perfilBase.areaOrigen === 'inferida'
          ? { ...perfilBase, area: undefined, areaConfianza: undefined, areaOrigen: undefined }
          : perfilBase,
      unidades: units,
    })
    const resolvedProfile = conArea.perfil
    const unitsConCaracter = conArea.unidades

    const requiredPedagogy = [
      resolvedProfile?.level,
      resolvedProfile?.degree,
      resolvedProfile?.academicYear,
      resolvedProfile?.complexity,
      resolvedProfile?.assessmentStyle,
      resolvedProfile?.methodology,
    ]

    if (requiredPedagogy.some((value) => !value || String(value).trim().length === 0)) {
      return NextResponse.json({ error: 'Completá todos los campos obligatorios de cómo das la materia' }, { status: 400 })
    }

    const rows = await sql`
      UPDATE teacher_programs
      SET
        subject_name = ${subjectName},
        icon_name = ${iconName},
        color_name = ${colorName},
        pedagogy_profile = ${JSON.stringify(resolvedProfile)},
        units = ${JSON.stringify(unitsConCaracter)},
        nivel = ${nivel},
        grado = ${grado},
        jurisdiccion = ${jurisdiccion},
        created_from = ${createdFrom},
        updated_at = NOW()
      WHERE id = ${programId} AND user_id = ${userId}
      RETURNING id, user_id, subject_name, icon_name, color_name, pedagogy_profile, units, source_file_name, created_at,
                nivel, grado, jurisdiccion, created_from
    `

    try {
      await upsertTeacherSubject({
        programId,
        subjectName,
        iconName,
        colorName,
        nivel,
      })
    } catch (registryError) {
      console.error('No se pudo actualizar la materia en el indice de materias', registryError)
    }

    return NextResponse.json({ program: rows[0] })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo actualizar el programa', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden eliminar programas' }, { status: 403 })
    }

    const { id } = await params
    const programId = Number(id)
    if (!Number.isFinite(programId) || programId <= 0) {
      return NextResponse.json({ error: 'Id de programa invalido' }, { status: 400 })
    }

    const deletedRows = await sql`
      DELETE FROM teacher_programs
      WHERE id = ${programId} AND user_id = ${userId}
      RETURNING id
    `

    if (deletedRows.length === 0) {
      return NextResponse.json({ error: 'Programa no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo eliminar el programa', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
