import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'

export const dynamic = 'force-dynamic'

/** Forma de `SELECT DISTINCT carrera`. Ver scripts/022-curriculum-carrera.sql. */
interface CareerRow {
  carrera: string
}

// GET /api/curriculum/careers?nivel=Superior&jurisdiccion=Salta
//
// Primer paso del selector de nivel Superior, que no se organiza por grado sino
// por carrera. Devuelve sólo carreras cargadas: si está vacío, el selector cae
// al flujo de subir el programa propio, que es el que existía antes de que
// hubiera currículos Superior precargados.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const nivel = searchParams.get('nivel')?.trim() || 'Superior'
  const jurisdiccion = searchParams.get('jurisdiccion')?.trim() || DEFAULT_JURISDICTION

  try {
    const rows = (await sql`
      SELECT DISTINCT carrera
      FROM curriculum
      WHERE nivel = ${nivel}
        AND jurisdiccion = ${jurisdiccion}
        AND carrera IS NOT NULL
      ORDER BY carrera
    `) as CareerRow[]

    return NextResponse.json({ careers: rows.map((r) => r.carrera) })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener carreras', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
