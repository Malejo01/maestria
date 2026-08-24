import { resolveDbTarget } from './lib/db-target'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recordMigration } from './lib/migration-registry'

/**
 * Migration 015 is long enough that keeping the SQL in one place beats
 * duplicating it here. Statements are split on ";\n" boundaries because the
 * neon serverless driver runs one statement per call.
 */
async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 015' })
  const file = readFileSync(join(process.cwd(), 'scripts', '015-classrooms.sql'), 'utf8')

  const statements = file
    .split(/;\s*\n/)
    // Drop comment-only chunks so we don't send empty statements.
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 015 (aulas) — ${statements.length} sentencias...`)

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

  await recordMigration(sql, '015')

  console.log('✅ ¡Migración 015 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
