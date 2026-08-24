import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 011' })

  console.log('Ejecutando migración 011 (nivel/grado de usuario) en la base de datos Neon...')

  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS nivel TEXT CHECK (nivel IN ('Primario', 'Secundario', 'Superior')),
      ADD COLUMN IF NOT EXISTS grado TEXT;
  `

  await recordMigration(sql, '011')

  console.log('✅ ¡Migración 011 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
