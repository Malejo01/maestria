/**
 * Replaces every piece of personal data in a freshly-cloned Neon branch with
 * synthetic equivalents, then marks the branch as `staging`.
 *
 * This is a mandatory step of the refresh procedure, not an optional cleanup:
 * `markEnvironment` refuses to write the 'staging' marker while any real
 * address survives, so a branch that skipped this script keeps identifying as
 * production and keeps demanding the production confirmation prompt.
 *
 * ─── Why it can never touch production ──────────────────────────────────────
 * A clone and the original both carry `environment='production'`; they differ
 * in `origin_host` (see scripts/017-deployment-env.sql). This script hard-stops
 * on `isRealProduction` with no override flag, because there is no legitimate
 * reason to scramble the real users table and an escape hatch would eventually
 * get used.
 *
 * ─── If it dies halfway ─────────────────────────────────────────────────────
 * The neon HTTP driver runs each statement in its own transaction, so a crash
 * between "drop FK" and "restore FK" leaves the branch with ON UPDATE CASCADE
 * still in place — a schema that no longer matches production, which defeats
 * the point of staging. Do not repair it by hand: delete the branch and clone
 * it again. On Neon that is seconds, and it is the only way to be sure.
 */
import { markEnvironment, resolveDbTarget, ANONYMIZED_EMAIL_DOMAIN } from './lib/db-target'

interface ForeignKey {
  table_name: string
  conname: string
  def: string
}

async function run() {
  const target = await resolveDbTarget({ action: 'anonimización de staging' })
  const { sql } = target

  if (target.isRealProduction) {
    console.error('')
    console.error('⛔ ABORTADO — este database es PRODUCCIÓN REAL.')
    console.error(`   host actual = origin_host = ${target.host}`)
    console.error('')
    console.error('   Este script reescribe users.id, users.email y users.name de todas las filas.')
    console.error('   No tiene flag para forzarlo contra producción, y no se le va a agregar.')
    console.error('   Corrélo apuntando a la branch clonada: --env=staging')
    process.exit(1)
  }

  const before = (await sql`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE email IS NOT NULL)::int AS con_email,
           count(*) FILTER (WHERE is_guest)::int AS invitados
    FROM users
  `) as { total: number; con_email: number; invitados: number }[]

  console.log(
    `\nAnonimizando ${before[0].total} usuarios (${before[0].con_email} con email, ${before[0].invitados} invitados)...\n`,
  )

  // ─── 1. Let the primary key move ──────────────────────────────────────────
  // users.id IS the Google `sub` in this app (auth.ts stores it verbatim), so
  // anonymizing means changing a primary key that a dozen tables point at.
  // The FKs are declared ON DELETE CASCADE but not ON UPDATE, so the update
  // would fail; rather than hardcode the child list — which silently goes stale
  // every time a migration adds a table — discover it and grant the cascade
  // temporarily. pg_get_constraintdef gives back the exact original text, so
  // restoring in step 5 is faithful rather than a guess.
  const foreignKeys = (await sql`
    SELECT con.conrelid::regclass::text AS table_name,
           con.conname,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.confrelid
    WHERE con.contype = 'f' AND rel.relname = 'users'
    ORDER BY 1, 2
  `) as ForeignKey[]

  console.log(`  · ${foreignKeys.length} claves foráneas apuntan a users(id):`)
  for (const fk of foreignKeys) console.log(`      ${fk.table_name}.${fk.conname}`)

  for (const fk of foreignKeys) {
    const cascading = fk.def.includes('ON UPDATE') ? fk.def : `${fk.def} ON UPDATE CASCADE`
    await sql.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT "${fk.conname}"`)
    await sql.query(`ALTER TABLE ${fk.table_name} ADD CONSTRAINT "${fk.conname}" ${cascading}`)
  }
  console.log('  ✔ Cascada temporal habilitada\n')

  try {
    // ─── 2. Identity ────────────────────────────────────────────────────────
    // One statement for id + name + email + image so they all derive from the
    // same row_number(). Doing them separately would renumber between updates
    // (the ordering key changes the moment id changes) and pair a user with
    // someone else's fake name.
    //
    // Guests keep email NULL — migration 015 made the column nullable precisely
    // so a guest is a real user row without an address, and inventing one here
    // would erase the distinction the teacher's roster relies on.
    await sql.query(
      `
      WITH numbered AS (
        SELECT id AS old_id,
               row_number() OVER (ORDER BY created_at NULLS FIRST, id) AS rn
        FROM users
      )
      UPDATE users u
      SET id    = 'stg-user-' || lpad(n.rn::text, 4, '0'),
          name  = (ARRAY['Ana','Bruno','Carla','Diego','Elena','Facundo','Gabriela',
                         'Hernán','Irina','Joaquín','Karina','Lucas','Malena','Nicolás',
                         'Olivia','Pablo'])[1 + (n.rn % 16)::int]
                  || ' ' ||
                  (ARRAY['Álvarez','Benítez','Cabrera','Domínguez','Escobar','Ferreyra',
                         'Gutiérrez','Herrera','Ibáñez','Juárez','Ledesma','Medina',
                         'Navarro','Ocampo','Paredes','Quiroga'])[1 + ((n.rn / 16) % 16)::int],
          email = CASE WHEN u.email IS NULL THEN NULL
                       ELSE 'usuario' || n.rn || '@${ANONYMIZED_EMAIL_DOMAIN}' END,
          -- Google profile photo URL: identifies the person as directly as the
          -- name does, and stays live on googleusercontent.com.
          image = NULL
      FROM numbered n
      WHERE u.id = n.old_id
      `,
    )
    console.log('  ✔ users: id (Google sub), name, email, image')

    // ─── 3. OAuth linkage and live credentials ──────────────────────────────
    // provider_account_id is the Google sub again. The token columns are worse:
    // they are WORKING Google credentials, and cloning prod into a lower-trust
    // environment copies them along. Nulling them is not hygiene, it is the
    // reason this step is not optional.
    await sql`
      UPDATE accounts
      SET provider_account_id = 'google-' || user_id,
          access_token        = NULL,
          refresh_token       = NULL,
          id_token            = NULL,
          session_state       = NULL,
          scope               = NULL,
          expires_at          = NULL
    `
    console.log('  ✔ accounts: provider_account_id + tokens OAuth vivos anulados')

    // ─── 4. Denormalized copies ─────────────────────────────────────────────
    // classroom_members keeps its own display_name, so the roster the teacher
    // sees would still show real names even with users.name scrubbed.
    await sql`
      UPDATE classroom_members cm
      SET display_name = u.name
      FROM users u
      WHERE cm.user_id = u.id
    `
    console.log('  ✔ classroom_members: display_name')

    // identifier is an email address; the table is unused in the Google-only
    // JWT flow, so there is nothing to preserve.
    await sql`DELETE FROM verification_tokens`

    // The uploaded programs themselves: real PDFs and Word files from real
    // teachers, stored as bytes. They already expire on their own (expires_at),
    // which is the app telling us they are disposable cache — so staging has no
    // claim on them, and dropping them keeps the branch small.
    const uploads = (await sql`DELETE FROM teacher_program_uploads RETURNING 1`) as unknown[]

    // Texto libre escrito por alumnos y docentes reales. No tiene columna de
    // email, pero es dato personal de hecho: quien reporta un problema escribe
    // lo que se le ocurre, incluido su nombre o el de su docente. No se
    // anonimiza fila por fila porque no hay nada que preservar acá — un reporte
    // sirve para volver a preguntarle a quien lo escribió, y en staging no hay
    // a quién preguntarle.
    const reports = (await sql`DELETE FROM feedback_reports RETURNING 1`) as unknown[]
    console.log(
      `  ✔ verification_tokens vaciada · teacher_program_uploads: ${uploads.length} archivo(s) borrado(s)` +
        ` · feedback_reports: ${reports.length} reporte(s) borrado(s)`,
    )
  } finally {
    // ─── 5. Put the schema back ─────────────────────────────────────────────
    // In `finally` so a failure mid-anonymization still restores the original
    // constraints. Staging exists to rehearse migrations against a production
    // shaped schema; leaving ON UPDATE CASCADE behind would quietly invalidate
    // every rehearsal run on this branch.
    for (const fk of foreignKeys) {
      await sql.query(`ALTER TABLE ${fk.table_name} DROP CONSTRAINT "${fk.conname}"`)
      await sql.query(`ALTER TABLE ${fk.table_name} ADD CONSTRAINT "${fk.conname}" ${fk.def}`)
    }
    console.log('  ✔ Claves foráneas restauradas a su definición original\n')
  }

  // ─── 6. Claim the branch ──────────────────────────────────────────────────
  // Runs assertAnonymized internally: if anything above missed a row, this
  // throws and the branch stays marked production rather than being certified
  // clean on the strength of the script having reached the end.
  await markEnvironment(target, 'staging', `Anonimizada desde ${target.host}`)

  const sample = (await sql`SELECT id, name, email, role, is_guest FROM users ORDER BY id LIMIT 5`) as Record<
    string,
    unknown
  >[]
  console.log('\nMuestra del resultado:')
  console.table(sample)
  console.log('\n✅ Branch anonimizada y marcada como staging.')
}

run().catch((err) => {
  console.error('\n❌ Error durante la anonimización:', err.message ?? err)
  console.error('   La branch quedó en un estado intermedio: borrala y volvé a clonarla.')
  process.exit(1)
})
