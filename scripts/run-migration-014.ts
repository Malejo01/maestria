import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 014' })

  console.log('Ejecutando migración 014 (nivel/grado en materias docentes) en la base de datos Neon...')

  await sql`
    ALTER TABLE teacher_programs
      ADD COLUMN IF NOT EXISTS nivel TEXT
        CHECK (nivel IN ('Primario', 'Secundario', 'Superior')),
      ADD COLUMN IF NOT EXISTS grado TEXT,
      ADD COLUMN IF NOT EXISTS jurisdiccion TEXT,
      ADD COLUMN IF NOT EXISTS created_from TEXT NOT NULL DEFAULT 'upload'
        CHECK (created_from IN ('upload', 'curriculum', 'manual'));
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_teacher_programs_user_nivel_grado
      ON teacher_programs(user_id, nivel, grado);
  `

  await recordMigration(sql, '014')

  console.log('✅ ¡Migración 014 ejecutada con éxito en PostgreSQL / Neon!')
  console.log('   Siguiente paso opcional: npx tsx scripts/backfill-program-nivel-grado.ts')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
