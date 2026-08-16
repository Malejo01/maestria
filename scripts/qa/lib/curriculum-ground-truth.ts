/**
 * Trae del currículum real los temas contra los que se juzga `adecuacion_programa`.
 *
 * Esto es lo que separa a la rúbrica de una opinión. Un modelo con conocimiento
 * general mira una pregunta de cónicas y dice "matemática estándar, parece
 * bien" — y así es como se le sirvieron 872 respuestas fuera de programa a 30
 * alumnos de Análisis de Sistemas el 2026-08-10. Con los `temas` textuales de
 * la fila de `curriculum` delante, la misma pregunta es un critical evidente.
 *
 * Si no hay filas, esta función NO devuelve un bloque vacío: lanza. Evaluar
 * "adecuación al programa" sin programa es exactamente el verde que no
 * significa nada.
 */
import type { Sql } from '../../lib/db-target'
import type { Persona } from '../../../lib/qa/personas'

interface CurriculumRow {
  eje: string
  temas: unknown
  contexto_profesional: unknown
}

export interface GroundTruth {
  /** Bloque listo para inyectar en el system prompt. */
  text: string
  /** Cuántas unidades del programa se encontraron. Cero es un error, no un caso. */
  unitCount: number
  /** True cuando el programa declara aplicación profesional (sólo Superior). */
  hasProfessionalContext: boolean
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function formatProfessionalContext(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null

  const record = value as Record<string, unknown>
  const aplicacion = typeof record.aplicacion === 'string' ? record.aplicacion.trim() : ''
  if (!aplicacion) return null

  const herramientas = asStringArray(record.herramientas)
  const tools = herramientas.length > 0 ? ` Herramientas de la cátedra: ${herramientas.join(', ')}.` : ''
  return `Aplicación profesional: ${aplicacion}.${tools}`
}

export async function loadGroundTruth(
  sql: Sql,
  persona: Persona,
  materia: string
): Promise<GroundTruth> {
  const rows = (await sql`
    SELECT eje, temas, contexto_profesional
    FROM curriculum
    WHERE nivel   = ${persona.nivel}
      AND grado   = ${persona.grado}
      AND materia = ${materia}
      AND carrera IS NOT DISTINCT FROM ${persona.carrera}
    ORDER BY eje
  `) as CurriculumRow[]

  if (rows.length === 0) {
    throw new Error(
      `Sin currículum para (${persona.nivel}, ${persona.grado}, ${materia}, carrera=${persona.carrera ?? 'NULL'}).\n` +
        '  La dimensión adecuacion_programa se evaluaría sin ground truth y daría un verde vacío.\n' +
        '  Revisá la etiqueta de grado: `curriculum` usa "1er Año", nunca "1er Grado".'
    )
  }

  let hasProfessionalContext = false
  const units = rows.map((row) => {
    const temas = asStringArray(row.temas)
    const professional = formatProfessionalContext(row.contexto_profesional)
    if (professional) hasProfessionalContext = true

    const lines = [`### ${row.eje}`]
    if (professional) lines.push(professional)
    for (const tema of temas) lines.push(`  - ${tema}`)
    return lines.join('\n')
  })

  const header =
    `PROGRAMA OFICIAL — ${persona.nivel}, ${persona.grado}, ${materia}` +
    (persona.carrera ? `, ${persona.carrera}` : '') +
    `\n(${rows.length} unidad/es. Ésta es la fuente para adecuacion_programa: si un tema no aparece acá ` +
    `ni como caso particular de alguna unidad, está fuera de programa por más estándar que sea.)`

  return {
    text: `${header}\n\n${units.join('\n\n')}`,
    unitCount: rows.length,
    hasProfessionalContext,
  }
}
