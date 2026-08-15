import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'

export const dynamic = 'force-dynamic'

// GET /api/curriculum/grades?nivel=Secundario&jurisdiccion=Salta
// Returns the ordered list of unique grados for a given nivel (+ jurisdiccion,
// defaults to DEFAULT_JURISDICTION since only one province is seeded today).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const nivel = searchParams.get('nivel')?.trim()
  const jurisdiccion = searchParams.get('jurisdiccion')?.trim() || DEFAULT_JURISDICTION
  // Ver el comentario equivalente en /api/curriculum/subjects: ausente = K-12,
  // donde `carrera` es NULL, y `IS NOT DISTINCT FROM` cubre los dos casos.
  const carrera = searchParams.get('carrera')?.trim() || null

  if (!nivel) {
    return NextResponse.json({ error: 'Parámetro nivel requerido' }, { status: 400 })
  }

  try {
    const rows = await sql`
      SELECT DISTINCT grado
      FROM curriculum
      WHERE nivel = ${nivel}
        AND jurisdiccion = ${jurisdiccion}
        AND carrera IS NOT DISTINCT FROM ${carrera}
      ORDER BY grado
    `
    const grades = rows.map((r: any) => r.grado)
    grades.sort((a: string, b: string) => {
      const numA = parseInt(a, 10) || 0
      const numB = parseInt(b, 10) || 0
      return numA - numB
    })
    return NextResponse.json({ grades })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener grados', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
