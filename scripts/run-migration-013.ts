import { resolveDbTarget } from './lib/db-target'
import { recordMigration } from './lib/migration-registry'

async function run() {
  const { sql } = await resolveDbTarget({ action: 'migración 013' })

  console.log('Ejecutando migración 013 (tipos de pregunta) en la base de datos Neon...')

  await sql`
    ALTER TABLE quiz_answers
      ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice'
        CHECK (question_type IN ('multiple_choice', 'short_answer', 'true_false', 'numeric')),
      ADD COLUMN IF NOT EXISTS answer_payload JSONB;
  `

  await sql`
    ALTER TABLE quiz_answers
      ALTER COLUMN options DROP NOT NULL,
      ALTER COLUMN selected_answer DROP NOT NULL,
      ALTER COLUMN correct_answer DROP NOT NULL;
  `

  await sql`
    CREATE INDEX IF NOT EXISTS idx_quiz_answers_type ON quiz_answers(question_type);
  `

  await recordMigration(sql, '013')

  console.log('✅ ¡Migración 013 ejecutada con éxito en PostgreSQL / Neon!')
}

run().catch((err) => {
  console.error('❌ Error en la migración:', err)
  process.exit(1)
})
