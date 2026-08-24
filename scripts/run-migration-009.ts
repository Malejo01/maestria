import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 009' })

  console.log('Ejecutando migración 009 en la base de datos Neon...')

  await sql`
    CREATE TABLE IF NOT EXISTS student_misconceptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL,
      topic_id TEXT NOT NULL,
      topic_name TEXT NOT NULL,
      misconception_type TEXT NOT NULL,
      tip TEXT NOT NULL,
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_misconceptions_user ON student_misconceptions(user_id);
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_student_misconceptions_topic ON student_misconceptions(user_id, topic_id);
  `

  await recordMigration(sql, '009')

  console.log('✅ ¡Migración 009 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
