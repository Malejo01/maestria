import { join } from 'node:path'
import { resolveDbTarget } from './lib/db-target'
import { buildSchemaModelFromDir, diffAgainstDatabase } from './lib/schema-model'

/**
 * ¿La base tiene lo que las migraciones del repo declaran?
 *
 * Read-only. Es el chequeo que faltaba: `tests/migrations.test.ts` vigila la
 * numeración dentro del repo y nadie miraba la base, así que las migraciones
 * 019 y 023 quedaron sin correr contra producción y las descubrimos por el
 * daño, no por el chequeo. El porqué del modelo está en lib/schema-model.ts.
 *
 * Sale con código 1 si falta algo, para poder usarlo como gate de deploy.
 *
 * Uso:
 *   npx tsx scripts/check-schema-drift.ts --env=staging
 *   npx tsx scripts/check-schema-drift.ts                  # producción
 *   CONFIRM_PRODUCTION=<project-id> npx tsx scripts/check-schema-drift.ts   # CI
 */

async function run() {
  // `destructive: false`: no escribe nada, así que no pide confirmación de
  // producción. Es lo que lo hace usable desde CI con credenciales de sólo
  // lectura y sin ninguna variable de intención.
  const { sql, host, environment } = await resolveDbTarget({
    action: 'chequeo de drift de esquema',
    destructive: false,
  })

  const model = buildSchemaModelFromDir(join(process.cwd(), 'scripts'))

  // Se lee `pg_catalog` y NO `information_schema`, y no es un detalle de estilo:
  // information_schema sólo muestra los objetos sobre los que el rol tiene
  // algún privilegio. Un rol de CI sin un solo GRANT vería la base vacía y este
  // chequeo reportaría que falta absolutamente todo. `pg_class`/`pg_attribute`
  // tienen SELECT público, así que el rol del pipeline puede auditar el esquema
  // sin poder leer una sola fila de datos de un alumno.
  //
  // Verificado contra producción el 24/08/2026: los dos caminos dan idénticos
  // 19 tablas y 202 columnas.
  const actualTables = new Set(
    (
      (await sql`
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      `) as { table_name: string }[]
    ).map((r) => r.table_name),
  )

  const actualColumns = new Set(
    (
      (await sql`
        SELECT c.relname AS table_name, a.attname AS column_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
          AND a.attnum > 0
          AND NOT a.attisdropped
      `) as { table_name: string; column_name: string }[]
    ).map((r) => `${r.table_name}.${r.column_name}`),
  )

  const missing = diffAgainstDatabase(model, actualTables, actualColumns)

  const declaredColumns = [...model.values()].reduce((n, t) => n + t.columns.size, 0)
  console.log(`\nEsquema declarado por las migraciones: ${model.size} tablas, ${declaredColumns} columnas agregadas`)
  console.log(`Base: ${environment} · ${host}\n`)

  if (missing.length === 0) {
    console.log('✔ La base está al día con las migraciones del repo.\n')
    return
  }

  console.error(`✖ Faltan ${missing.length} objeto(s) en la base:\n`)

  const porMigracion = new Map<string, typeof missing>()
  for (const m of missing) {
    if (!porMigracion.has(m.migration)) porMigracion.set(m.migration, [])
    porMigracion.get(m.migration)!.push(m)
  }

  for (const [version, objetos] of [...porMigracion].sort()) {
    for (const o of objetos) {
      console.error(`    ${o.kind.padEnd(7)} ${o.table}${o.column ? '.' + o.column : ''}`)
    }
    console.error(`      → npx tsx scripts/run-migration-${version}.ts\n`)
  }

  console.error('El código desplegado puede estar pidiendo un esquema que la base no tiene.\n')
  process.exitCode = 1
}

run().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
