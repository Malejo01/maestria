import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { sql } from '@/lib/db'
import { esAreaId, esCaracter } from '@/lib/areas'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { captureRouteFailure } from '@/lib/observability'
import type { PedagogyProfile, ProgramUnit } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · A3 — El docente cambia el área de su materia o el carácter de una
 * unidad. Sólo eso: no pasa por las validaciones de la edición completa (un
 * programa viejo con campos vacíos igual puede cambiar su área).
 *
 *   { area }                        → el área, como elegida a mano
 *   { unidadId, caracter }          → el carácter de esa unidad, a mano
 *   { unidadId, caracter: null }    → vuelve al detectado
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const docente = await getTeacherViewer()
  if (!docente) return NextResponse.json({ error: 'Sólo docentes' }, { status: 403 })

  const { id } = await params
  const programId = Number(id)
  if (!Number.isInteger(programId) || programId <= 0) return NextResponse.json({ error: 'Materia inválida' }, { status: 400 })

  const body = (await req.json().catch(() => null)) as { area?: unknown; unidadId?: unknown; caracter?: unknown } | null
  const cambiaArea = body?.area !== undefined
  const cambiaUnidad = typeof body?.unidadId === 'string'
  if (cambiaArea && !esAreaId(body?.area)) return NextResponse.json({ error: 'Área inválida' }, { status: 400 })
  if (cambiaUnidad && body?.caracter !== null && !esCaracter(body?.caracter)) {
    return NextResponse.json({ error: 'Carácter inválido' }, { status: 400 })
  }
  if (!cambiaArea && !cambiaUnidad) return NextResponse.json({ error: 'Nada para cambiar' }, { status: 400 })

  try {
    const filas = (await sql`
      SELECT subject_name, pedagogy_profile, units FROM teacher_programs
      WHERE id = ${programId} AND user_id = ${docente.id} AND status = 'active'
    `) as { subject_name: string; pedagogy_profile: PedagogyProfile | null; units: ProgramUnit[] | null }[]
    const programa = filas[0]
    if (!programa) return NextResponse.json({ error: 'Materia no encontrada' }, { status: 404 })

    let perfil = { ...(programa.pedagogy_profile ?? {}) } as PedagogyProfile
    let unidades = Array.isArray(programa.units) ? programa.units : []

    if (cambiaArea && esAreaId(body?.area)) {
      perfil = { ...perfil, area: body.area, areaConfianza: 1, areaOrigen: 'manual' }
    }
    if (cambiaUnidad) {
      if (!unidades.some((u) => u.id === body?.unidadId)) {
        return NextResponse.json({ error: 'Unidad no encontrada' }, { status: 404 })
      }
      unidades = unidades.map((u) => {
        if (u.id !== body?.unidadId) return u
        const resto = { ...u }
        delete resto.caracterManual
        return esCaracter(body?.caracter) ? { ...resto, caracterManual: body.caracter } : resto
      })
    }

    const completo = completarAreaDelPrograma({
      materia: programa.subject_name,
      carrera: perfil.degree,
      perfil,
      unidades,
    })

    await sql`
      UPDATE teacher_programs
      SET pedagogy_profile = ${JSON.stringify(completo.perfil)}, units = ${JSON.stringify(completo.unidades)}, updated_at = NOW()
      WHERE id = ${programId} AND user_id = ${docente.id}
    `
    return NextResponse.json({ pedagogyProfile: completo.perfil, units: completo.unidades })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/programs/[id]/area', operation: 'PATCH' })
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
}
