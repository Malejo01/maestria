import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

/**
 * Migración 049 (salud-generaciones). Mismo runner que la 029.
 * El SQL vive en su propio archivo y se parte por sentencia
 * porque el driver serverless de neon manda una sentencia por llamada.
 *
 *   npx tsx scripts/run-migration-049.ts --env=staging
 *
 * Sin `--env` apunta a producción y pide confirmación (scripts/lib/db-target.ts).
 */
async function run() {
  const { sql } = await resolveDbTarget({
    action: 'migración 049 (salud-generaciones)',
  })
  const file = readFileSync(join(process.cwd(), 'scripts', '049-salud-generaciones.sql'), 'utf8')

  const statements = file
    .split(/;\s*\n/)
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 049 (salud-generaciones) — ${statements.length} sentencias...`)

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

  await recordMigration(sql, '049')

  console.log('✅ ¡Migración 049 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
