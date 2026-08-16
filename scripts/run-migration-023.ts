import { resolveDbTarget } from './lib/db-target'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Migración 023 (mezcla sugerida de tipos de pregunta). Mismo runner que la 022:
 * el SQL vive en su propio archivo y se parte en ";\n" porque el driver
 * serverless de neon manda una sentencia por llamada.
 */
async function run() {
  const { sql } = await resolveDbTarget({
    action: 'migración 023 (curriculum.tipos_pregunta_sugeridos)',
  })
  const file = readFileSync(join(process.cwd(), 'scripts', '023-curriculum-tipos-pregunta.sql'), 'utf8')

  const statements = file
    .split(/;\s*\n/)
    // Drop comment-only chunks so we don't send empty statements.
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 023 (curriculum.tipos_pregunta_sugeridos) — ${statements.length} sentencias...`)

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

  console.log('✅ ¡Migración 023 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
