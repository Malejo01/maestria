import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { upsertTeacherSubject } from '@/lib/subjects'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'
import { resolveGradoForNivel } from '@/lib/grado-server'
import { parseCreatedFrom, parseNivel, withDerivedPedagogyProfile } from '@/lib/teacher-programs'
import type { PedagogyProfile, ProgramUnit, SubjectColorName, SubjectIconName } from '@/lib/types'
import { bloqueoParaGenerar } from '@/lib/planes-server'

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

  if (rows.length === 0) {
    return false
  }

  return isTeacherRole(rows[0].role)
}

export async function GET(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ programs: [] })
    }

    // Widest query first (after migration 014), then degrade one migration at a
    // time so a dashboard on an un-migrated DB still lists its programs.
    let programs: Awaited<ReturnType<typeof sql>>
    try {
      programs = await sql`
        SELECT id, user_id, subject_name, icon_name, color_name, pedagogy_profile, units, source_file_name, created_at,
               nivel, grado, jurisdiccion, created_from
        FROM teacher_programs
        WHERE user_id = ${userId} AND status = 'active'
          -- E1: la materia personal (modo autodidacta) no es una materia del docente.
          AND COALESCE((to_jsonb(teacher_programs) ->> 'personal')::boolean, false) = false
        ORDER BY created_at DESC
      `
    } catch {
      try {
        programs = await sql`
          SELECT id, user_id, subject_name, icon_name, color_name, pedagogy_profile, units, source_file_name, created_at
          FROM teacher_programs
          WHERE user_id = ${userId} AND status = 'active'
            AND COALESCE((to_jsonb(teacher_programs) ->> 'personal')::boolean, false) = false
          ORDER BY created_at DESC
        `
      } catch {
        programs = await sql`
          SELECT id, user_id, subject_name, pedagogy_profile, units, source_file_name, created_at
          FROM teacher_programs
          WHERE user_id = ${userId} AND status = 'active'
            AND COALESCE((to_jsonb(teacher_programs) ->> 'personal')::boolean, false) = false
          ORDER BY created_at DESC
        `
      }
    }

    const { searchParams } = new URL(req.url)
    const nameFilter = searchParams.get('name')?.trim().toLowerCase() || ''
    const levelFilter = searchParams.get('level')?.trim().toLowerCase() || ''
    const degreeFilter = searchParams.get('degree')?.trim().toLowerCase() || ''
    const createdAfter = searchParams.get('createdAfter')?.trim() || ''

    const filteredPrograms = programs.filter((program: Record<string, any>) => {
      const pedagogyProfile = (program.pedagogy_profile || {}) as PedagogyProfile
      const matchesName = nameFilter.length === 0 || String(program.subject_name || '').toLowerCase().includes(nameFilter)
      // Post-014 programs carry nivel in its own column; older ones only have
      // the free-text profile level, so the filter has to look at both.
      const levelHaystack = `${program.nivel ?? ''} ${pedagogyProfile.level ?? ''}`.toLowerCase()
      const matchesLevel = levelFilter.length === 0 || levelHaystack.includes(levelFilter)
      const matchesDegree = degreeFilter.length === 0 || String(pedagogyProfile.degree || '').toLowerCase().includes(degreeFilter)

      const createdAtTime = new Date(program.created_at).getTime()
      const createdAfterTime = createdAfter.length > 0 ? new Date(createdAfter).getTime() : Number.NaN
      const matchesDate = Number.isNaN(createdAfterTime) || createdAtTime >= createdAfterTime

      return matchesName && matchesLevel && matchesDegree && matchesDate
    })

    // Ronda T · A2: en la lista, el área se completa en memoria (se guarda al
    // abrir o editar el programa: GET y PATCH de /api/teacher/programs/[id]).
    const conArea = filteredPrograms.map((program: Record<string, unknown>) => {
      const perfil = (program.pedagogy_profile || {}) as PedagogyProfile
      const completo = completarAreaDelPrograma({
        materia: String(program.subject_name || ''),
        carrera: perfil.degree,
        perfil,
        unidades: Array.isArray(program.units) ? (program.units as ProgramUnit[]) : [],
      })
      return completo.cambio ? { ...program, pedagogy_profile: completo.perfil, units: completo.unidades } : program
    })

    return NextResponse.json({ programs: conArea })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudieron obtener los programas', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const isTeacher = await requireTeacher(userId)
    if (!isTeacher) {
      return NextResponse.json({ error: 'Solo docentes pueden crear programas' }, { status: 403 })
    }

    // Plan vencido: modo solo lectura (lib/planes.ts).
    const bloqueo = await bloqueoParaGenerar(userId, session?.user?.email ?? null)
    if (bloqueo) return bloqueo

    const body = await req.json()
    const subjectName = String(body?.subjectName ?? '').trim()
    const units = body?.units as ProgramUnit[]
    const pedagogyProfile = body?.pedagogyProfile as PedagogyProfile
    const sourceFileName = body?.sourceFileName ? String(body.sourceFileName) : null
    const sourceMimeType = body?.sourceMimeType ? String(body.sourceMimeType) : null
    const sourceFileSizeBytes = body?.sourceFileSizeBytes ? Number(body.sourceFileSizeBytes) : null
    const iconName = (body?.iconName ? String(body.iconName) : 'book-open') as SubjectIconName
    const colorName = (body?.colorName ? String(body.colorName) : 'teal') as SubjectColorName
    const nivel = parseNivel(body?.nivel)
    const jurisdiccion = body?.jurisdiccion ? String(body.jurisdiccion).trim() : DEFAULT_JURISDICTION
    // Snap "6" / "sexto" to the curriculum's own "6to Año" — grado is a join
    // key, and a mismatched spelling silently empties the topic panel.
    const grado = await resolveGradoForNivel(nivel, body?.grado ?? null, jurisdiccion)
    const createdFrom = parseCreatedFrom(body?.createdFrom, sourceFileName ? 'upload' : 'manual')

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
    const conArea = completarAreaDelPrograma({
      materia: subjectName,
      carrera: pedagogyProfile?.degree,
      perfil: withDerivedPedagogyProfile(pedagogyProfile, nivel, grado),
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
      INSERT INTO teacher_programs (
        user_id,
        subject_name,
        icon_name,
        color_name,
        pedagogy_profile,
        units,
        source_file_name,
        source_mime_type,
        source_file_size_bytes,
        source_expires_at,
        nivel,
        grado,
        jurisdiccion,
        created_from,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${subjectName},
        ${iconName},
        ${colorName},
        ${JSON.stringify(resolvedProfile)},
        ${JSON.stringify(unitsConCaracter)},
        ${sourceFileName},
        ${sourceMimeType},
        ${sourceFileSizeBytes},
        NOW() + INTERVAL '24 hours',
        ${nivel},
        ${grado},
        ${jurisdiccion},
        ${createdFrom},
        'active',
        NOW(),
        NOW()
      )
      RETURNING id, user_id, subject_name, icon_name, color_name, pedagogy_profile, units, source_file_name, created_at,
                nivel, grado, jurisdiccion, created_from
    `

    const createdProgram = rows[0]

    try {
      await upsertTeacherSubject({
        programId: Number(createdProgram.id),
        subjectName,
        iconName,
        colorName,
        nivel,
      })
    } catch (registryError) {
      console.error('No se pudo registrar la materia en el indice de materias', registryError)
    }

    return NextResponse.json({ program: createdProgram })
  } catch (error) {
    return NextResponse.json(
      { error: 'No se pudo crear el programa', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
