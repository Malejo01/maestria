import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'
import { captureRouteFailure } from '@/lib/observability'

export const dynamic = 'force-dynamic'

/**
 * Forma de `SELECT eje, temas` — ver scripts/007-curriculum.sql.
 *
 * `temas` queda `unknown` a propósito. Es una columna JSONB: Postgres garantiza
 * que el contenido es JSON válido, no que sea un arreglo de strings. Declararla
 * `string[]` sería trasladar la mentira del `as` al tipo, que es justo lo que
 * hacía fallar esto en silencio.
 */
interface AxisRow {
  eje: string
  temas: unknown
  contexto_profesional: unknown
}

/**
 * Aplicación profesional de una unidad, tal como la declara el programa de
 * cátedra. Ver scripts/022-curriculum-carrera.sql.
 */
export interface ContextoProfesional {
  aplicacion: string
  herramientas: string[]
}

/**
 * Mismo criterio que `toTopicList`: la columna es JSONB, así que Postgres
 * garantiza JSON válido y nada más. Una unidad sin contexto declarado devuelve
 * null y el prompt simplemente no incluye la sección.
 */
function toContextoProfesional(value: unknown): ContextoProfesional | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  const aplicacion = typeof record.aplicacion === 'string' ? record.aplicacion.trim() : ''
  if (!aplicacion) return null

  const herramientas = Array.isArray(record.herramientas)
    ? record.herramientas.filter((item): item is string => typeof item === 'string')
    : []

  return { aplicacion, herramientas }
}

/**
 * Estrecha el JSONB al contrato que espera el front. Lo que no es un arreglo de
 * strings se descarta acá, donde se puede ver, en vez de llegar al browser y
 * romper el `.map`/`.join` que lo consume.
 */
function toTopicList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (value != null) {
      captureRouteFailure(new Error('Formato de temas inválido (no es array)'), {
        endpoint: '/api/curriculum/topics',
        operation: 'toTopicList'
      })
    }
    return []
  }
  
  const validTopics = value.filter((item): item is string => typeof item === 'string')
  
  if (validTopics.length !== value.length) {
    captureRouteFailure(new Error('Formato de temas contiene elementos que no son string'), {
      endpoint: '/api/curriculum/topics',
      operation: 'toTopicList'
    })
  }
  
  return validTopics
}

// GET /api/curriculum/topics?nivel=Secundario&grado=1er+Año&materia=Matemática&jurisdiccion=Salta
// Returns all ejes with their temas for the given nivel+grado+materia(+jurisdiccion).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const nivel   = searchParams.get('nivel')?.trim()
  const grado   = searchParams.get('grado')?.trim()
  const materia = searchParams.get('materia')?.trim()
  const jurisdiccion = searchParams.get('jurisdiccion')?.trim() || DEFAULT_JURISDICTION
  // Ver el comentario equivalente en /api/curriculum/subjects: ausente = K-12.
  const carrera = searchParams.get('carrera')?.trim() || null

  if (!nivel || !grado || !materia) {
    return NextResponse.json({ error: 'Parámetros nivel, grado y materia requeridos' }, { status: 400 })
  }

  try {
    const rows = (await sql`
      SELECT eje, temas, contexto_profesional
      FROM curriculum
      WHERE nivel   = ${nivel}
        AND grado   = ${grado}
        AND materia = ${materia}
        AND jurisdiccion = ${jurisdiccion}
        AND carrera IS NOT DISTINCT FROM ${carrera}
      ORDER BY id
    `) as AxisRow[]
    const axes = rows.map((r) => ({
      eje:   r.eje,
      temas: toTopicList(r.temas),
      contextoProfesional: toContextoProfesional(r.contexto_profesional),
    }))
    return NextResponse.json({ axes })
  } catch (error) {
    return NextResponse.json(
      { error: 'Error al obtener temas', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
