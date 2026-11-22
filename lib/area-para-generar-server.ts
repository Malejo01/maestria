import { sql } from '@/lib/db'
import { esAreaId, type AreaId } from '@/lib/areas'
import { completarAreaDelPrograma } from '@/lib/area-del-programa'
import { contextoDeArea, type ContextoDeArea, type UnidadParaGenerar } from '@/lib/area-para-generar'
import { scopeUnitsToTopics } from '@/lib/quiz-scope'

/**
 * El área de una materia del docente (la guardada o la inferida); sin
 * programa, la inferida del nombre. Nunca lanza.
 */
export async function areaDeLaMateria(teacherProgramId: number | null, materia: string): Promise<AreaId> {
  const ctx = await areaParaGenerar({ teacherProgramId: teacherProgramId ?? undefined, subject: materia, unidades: [], temas: [] })
  return ctx.area
}

/**
 * Ronda T · A4 — El área con la que se genera, en el servidor.
 *
 *   1. Si quien llama ya la sabe (`area`), ésa.
 *   2. Si hay materia del docente (`teacherProgramId`), la de su programa: el
 *      área guardada (o inferida, como al abrirlo) y el carácter de cada
 *      unidad, de la base, nunca del cuerpo de la request.
 *   3. Si no (la práctica de un alumno con su propia materia), se infiere del
 *      nombre y de las unidades que llegan.
 *
 * Una falla de base no corta la generación: cae al paso 3.
 */
export async function areaParaGenerar({
  area,
  teacherProgramId,
  subject,
  carrera,
  unidades,
  temas,
}: {
  area?: AreaId
  teacherProgramId?: number
  subject: string
  carrera?: string | null
  unidades: readonly UnidadParaGenerar[]
  temas: readonly { id?: unknown; name?: unknown }[]
}): Promise<ContextoDeArea> {
  let unidadesDelPrograma: UnidadParaGenerar[] | null = null
  let areaDelPrograma: AreaId | null = null

  if (teacherProgramId) {
    try {
      const filas = (await sql`
        SELECT subject_name, pedagogy_profile, units FROM teacher_programs WHERE id = ${teacherProgramId}
      `) as { subject_name: string; pedagogy_profile: Record<string, unknown> | null; units: unknown }[]
      const programa = filas[0]
      if (programa) {
        const completo = completarAreaDelPrograma({
          materia: programa.subject_name,
          carrera: typeof programa.pedagogy_profile?.degree === 'string' ? programa.pedagogy_profile.degree : carrera,
          perfil: programa.pedagogy_profile ?? {},
          unidades: Array.isArray(programa.units) ? (programa.units as UnidadParaGenerar[]) : [],
        })
        areaDelPrograma = completo.perfil.area
        unidadesDelPrograma = completo.unidades
      }
    } catch (error) {
      console.error('[area] No se pudo leer el área del programa; se infiere', error)
    }
  }

  if (unidadesDelPrograma && areaDelPrograma) {
    const elegidas = scopeUnitsToTopics(unidadesDelPrograma, [...temas] as { id: string; name: string }[]) as UnidadParaGenerar[]
    return contextoDeArea({ area: esAreaId(area) ? area : areaDelPrograma, unidades: elegidas, temas })
  }

  const inferido = completarAreaDelPrograma({ materia: subject, carrera, perfil: {}, unidades })
  return contextoDeArea({ area: esAreaId(area) ? area : inferido.perfil.area, unidades: inferido.unidades, temas })
}
