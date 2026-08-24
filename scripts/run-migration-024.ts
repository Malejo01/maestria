import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

/**
 * Migración 024 (tabla `schema_migrations`). Mismo runner que la 022 y la 023:
 * el SQL vive en su propio archivo y se parte en ";\n" porque el driver
 * serverless de neon manda una sentencia por llamada.
 *
 * Después de crear la tabla se registra a sí misma. Las 23 anteriores las cubre
 * scripts/backfill-schema-migrations.ts, que hay que correr a continuación.
 */
async function run() {
  const { sql } = await resolveDbTarget({
    action: 'migración 024 (schema_migrations)',
  })
  const file = readFileSync(join(process.cwd(), 'scripts', '024-schema-migrations.sql'), 'utf8')

  const statements = file
    .split(/;\s*\n/)
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 024 (schema_migrations) — ${statements.length} sentencias...`)

  for (const [index, statement] of statements.entries()) {
    const label = statement.replace(/\s+/g, ' ').slice(0, 70)
    try {
      await sql.query(statement)
      console.log(`  ✔ ${index + 1}/${statements.length} ${label}...`)
    } catch (error) {
      console.error(`  ✖ ${index + 1}/${statements.length} ${label}...`)
      throw error
    }
  }

  await recordMigration(sql, '024')

  console.log('✅ ¡Migración 024 ejecutada con éxito en PostgreSQL / Neon!')
  console.log('   Siguiente paso: npx tsx scripts/backfill-schema-migrations.ts')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
