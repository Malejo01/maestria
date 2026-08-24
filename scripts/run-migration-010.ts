import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 010' })

  console.log('Ejecutando migración 010 (registro de materias) en la base de datos Neon...')

  await sql`
    CREATE TABLE IF NOT EXISTS subjects (
      id                 SERIAL PRIMARY KEY,
      slug               TEXT NOT NULL UNIQUE,
      display_name       TEXT NOT NULL,
      source             TEXT NOT NULL CHECK (source IN ('curriculum', 'teacher')),
      icon_name          TEXT NOT NULL DEFAULT 'book-open',
      color_name         TEXT NOT NULL DEFAULT 'teal',
      nivel              TEXT,
      teacher_program_id INTEGER REFERENCES teacher_programs(id) ON DELETE CASCADE,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    );
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_subjects_source ON subjects(source);
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_subjects_nivel ON subjects(nivel);
  `

  await sql`
    DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
  `

  await sql`
    CREATE TRIGGER update_subjects_updated_at
      BEFORE UPDATE ON subjects
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `

  await recordMigration(sql, '010')

  console.log('✅ ¡Migración 010 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
