import { resolveDbTarget, type Sql } from './lib/db-target'
import { DEFAULT_JURISDICTION } from '../lib/curriculum-config'
import { CARRERA, GRADO, MATERIA, UNIDADES } from './data/curriculum-superior-sistemas'

/**
 * Carga en `curriculum` el programa de Matemática de la Tecnicatura Superior en
 * Análisis de Sistemas. El programa en sí vive en
 * scripts/data/curriculum-superior-sistemas.ts; acá está sólo el upsert.
 *
 * Se carga en `curriculum` (no en `teacher_programs`) para que cualquier alumno
 * de nivel Superior lo elija desde /practicar sin depender de un aula.
 *
 * Cada unidad del programa es una fila = un `eje`, con su aplicación profesional
 * en `contexto_profesional` (migración 022) y su mezcla sugerida de tipos de
 * pregunta en `tipos_pregunta_sugeridos` (migración 023). Ninguna de las dos es
 * metadata decorativa: la primera hace que salga "modelá el crecimiento de
 * usuarios de una app" en vez de "hallá el dominio de f(x)", y la segunda que la
 * respuesta haya que producirla en vez de reconocerla entre opciones.
 *
 * Idempotente vía la constraint `curriculum_fila_unica`: volver a correrlo
 * actualiza temas, contexto y mezcla en vez de duplicar.
 *
 * Uso:
 *   npx tsx scripts/seed-curriculum-superior-sistemas.ts --env=staging
 *   npx tsx scripts/seed-curriculum-superior-sistemas.ts            # producción
 */

// Asignado al inicio de seed(), una vez que el guardrail confirmó el destino.
let sql!: Sql

async function seed() {
  ;({ sql } = await resolveDbTarget({
    action: `seed del currículum Superior (${CARRERA})`,
  }))

  const jurisdiccion = DEFAULT_JURISDICTION
  console.log(`\nCargando ${UNIDADES.length} unidades de ${MATERIA} · ${CARRERA} · ${GRADO}\n`)

  let insertadas = 0
  let actualizadas = 0

  for (const unidad of UNIDADES) {
    // ON CONFLICT nombrando la constraint en vez de inferirla por columnas:
    // `curriculum_fila_unica` es UNIQUE NULLS NOT DISTINCT y la inferencia por
    // lista de columnas es más frágil de leer que el nombre explícito.
    const rows = (await sql`
      INSERT INTO curriculum (jurisdiccion, nivel, carrera, materia, grado, eje, temas, contexto_profesional, tipos_pregunta_sugeridos)
      VALUES (
        ${jurisdiccion},
        'Superior',
        ${CARRERA},
        ${MATERIA},
        ${GRADO},
        ${unidad.eje},
        ${JSON.stringify(unidad.temas)}::jsonb,
        ${JSON.stringify(unidad.contextoProfesional)}::jsonb,
        ${JSON.stringify(unidad.tiposPregunta)}::jsonb
      )
      ON CONFLICT ON CONSTRAINT curriculum_fila_unica DO UPDATE
        SET temas                    = EXCLUDED.temas,
            contexto_profesional     = EXCLUDED.contexto_profesional,
            tipos_pregunta_sugeridos = EXCLUDED.tipos_pregunta_sugeridos,
            updated_at               = NOW()
      RETURNING (xmax = 0) AS insertada
    `) as { insertada: boolean }[]

    if (rows[0]?.insertada) {
      insertadas += 1
      console.log(`  + ${unidad.eje}  (${unidad.temas.length} temas)`)
    } else {
      actualizadas += 1
      console.log(`  ~ ${unidad.eje}  (${unidad.temas.length} temas, actualizada)`)
    }
  }

  console.log(`\n✅ Listo.`)
  console.log(`   Insertadas  : ${insertadas}`)
  console.log(`   Actualizadas: ${actualizadas}`)
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Seeder falló:', err)
    process.exit(1)
  })
