import { resolveDbTarget } from './lib/db-target'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recordMigration } from './lib/migration-registry'

/**
 * Migración 019 (buzón de reportes de problemas). Mismo runner que la 016: el
 * SQL vive en su propio archivo y se parte en ";\n" porque el driver serverless
 * de neon manda una sentencia por llamada.
 */
async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 019 (feedback_reports)' })
  const file = readFileSync(join(process.cwd(), 'scripts', '019-feedback-reports.sql'), 'utf8')

  const statements = file
    .split(/;\s*\n/)
    // Drop comment-only chunks so we don't send empty statements.
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 019 (feedback_reports) — ${statements.length} sentencias...`)

  for (const [index, statement] of statements.entries()) {
    const label = statement.replace(/\s+/g, ' ').slice(0, 70)
    try {
      // The neon driver only accepts a tagged template for `sql`; raw DDL goes
      // through sql.query, which takes a plain string.
      await sql.query(statement)
      console.log(`  ✔ ${index + 1}/${statements.length} ${label}...`)
    } catch (error) {
      console.error(`  ✖ ${index + 1}/${statements.length} ${label}...`)
      throw error
    }
  }

  await recordMigration(sql, '019')

  console.log('✅ ¡Migración 019 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
