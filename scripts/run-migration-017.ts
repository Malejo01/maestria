import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDbTarget, normalizeNeonHost } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

/**
 * Bootstraps the guardrail itself, so it is the one runner that cannot use it
 * at full strength: `allowMissingMarker` is set because this migration is what
 * creates the marker table. Everything after 017 gets the full check.
 */
async function run() {
  const target = await resolveDbTarget({ action: 'migración 017 (marcador de entorno)', allowMissingMarker: true })

  const file = readFileSync(join(process.cwd(), 'scripts', '017-deployment-env.sql'), 'utf8')
  const statements = file
    .split(/;\s*\n/)
    .map((chunk) => chunk.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').trim())
    .filter((chunk) => chunk.length > 0)

  console.log(`Ejecutando migración 017 (marcador de entorno) — ${statements.length} sentencias...`)

  for (const [index, statement] of statements.entries()) {
    const label = statement.replace(/\s+/g, ' ').slice(0, 70)
    try {
      await target.sql.query(statement)
      console.log(`  ✔ ${index + 1}/${statements.length} ${label}...`)
    } catch (error) {
      console.error(`  ✖ ${index + 1}/${statements.length} ${label}...`)
      throw error
    }
  }

  // The SQL can't know its own hostname, so the stamp happens here. Only fills
  // a NULL: on a database where 017 already ran, re-running must not re-stamp
  // the row with the current host — that would make a staging clone look like
  // the original and defeat the whole clone-vs-production distinction.
  //
  // `updated_at` va acá también: la columna tiene DEFAULT NOW(), pero un DEFAULT
  // sólo corre en el INSERT. Sin esto la fila queda diciendo que se escribió por
  // última vez cuando se creó la tabla, aunque el origin_host se haya sellado
  // después. El WHERE de arriba hace que no pise nada en una re-corrida: si
  // origin_host ya está, no matchea ninguna fila y no hay bump.
  await target.sql`
    UPDATE deployment_env
       SET origin_host = ${normalizeNeonHost(target.host)}, updated_at = NOW()
     WHERE id = true AND origin_host IS NULL
  `

  const rows = (await target.sql`SELECT environment, origin_host FROM deployment_env WHERE id = true`) as {
    environment: string
    origin_host: string | null
  }[]

  await recordMigration(target.sql, '017')

  console.log('✅ ¡Migración 017 ejecutada con éxito en PostgreSQL / Neon!')
  console.log(`   Marcador: environment="${rows[0]?.environment}" origin_host="${rows[0]?.origin_host}"`)
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err.message ?? err)
  process.exit(1)
})
