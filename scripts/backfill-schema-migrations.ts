import { join } from 'node:path'
import { resolveDbTarget, type Sql } from './lib/db-target'
import { buildSchemaModel, migrationFiles } from './lib/schema-model'
import { knownVersions, readAppliedMigrations, recordMigration } from './lib/migration-registry'
import { readFileSync } from 'node:fs'

/**
 * Llena `schema_migrations` (migración 024) con las migraciones que ya estaban
 * aplicadas antes de que el registro existiera.
 *
 * La evidencia sale del escalón anterior: se arma el modelo del esquema hasta
 * cada versión y se pregunta si los objetos que ESA migración introduce están
 * en el catálogo. Si están, se da por aplicada.
 *
 * Hay migraciones que no introducen ningún objeto observable —sólo índices,
 * constraints, COMMENT o un backfill de datos—. Sobre esas no se puede inferir
 * nada, y el script NO las marca solo: las lista y pide `--asumir=NNN,NNN`.
 * Marcarlas por las dudas sería exactamente el error que este registro existe
 * para evitar: una fila que dice "aplicada" sin que nadie lo haya comprobado.
 *
 * Uso:
 *   npx tsx scripts/backfill-schema-migrations.ts
 *   npx tsx scripts/backfill-schema-migrations.ts --apply
 *   npx tsx scripts/backfill-schema-migrations.ts --apply --asumir=008,012,018
 */

const SCRIPTS_DIR = join(process.cwd(), 'scripts')

type Veredicto = 'aplicada' | 'falta' | 'sin-evidencia' | 'ya-registrada'

interface Fila {
  version: string
  veredicto: Veredicto
  detalle: string
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

/**
 * Objetos que cada migración aporta al esquema FINAL, agrupados por versión.
 *
 * El modelo se arma una sola vez con todas las migraciones, y no una vez por
 * versión cortando el archivo ahí. La diferencia no es de eficiencia: cortando
 * en la 015 el modelo todavía dice `ai_generation_log`, que no existe en el
 * catálogo porque la 016 la renombró, y la 015 —que está aplicada -- se
 * reportaba como faltante. Es exactamente el falso positivo que ya había
 * aparecido en el prototipo del detector de drift, y reaparece cada vez que uno
 * mira una migración fuera de la secuencia que la sigue.
 *
 * Consecuencia asumida: una migración cuyos objetos fueron todos renombrados
 * después aparece como "sin evidencia", porque en el esquema final ya no lleva
 * su sello. Es lo correcto — la prueba de que corrió la tiene la migración que
 * la renombró.
 */
function objetosPorVersion(): Map<string, { tablas: string[]; columnas: string[] }> {
  const model = buildSchemaModel(migrationFiles(SCRIPTS_DIR), (f) =>
    readFileSync(join(SCRIPTS_DIR, f), 'utf8'),
  )

  const porVersion = new Map<string, { tablas: string[]; columnas: string[] }>()
  const bucket = (v: string) => {
    if (!porVersion.has(v)) porVersion.set(v, { tablas: [], columnas: [] })
    return porVersion.get(v)!
  }

  for (const tabla of model.values()) {
    bucket(tabla.migration).tablas.push(tabla.name)
    for (const [col, mig] of tabla.columns) {
      bucket(mig).columnas.push(`${tabla.name}.${col}`)
    }
  }

  return porVersion
}

async function catalogo(sql: Sql) {
  const tablas = new Set(
    (
      (await sql`
        SELECT c.relname AS table_name FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      `) as { table_name: string }[]
    ).map((r) => r.table_name),
  )

  const columnas = new Set(
    (
      (await sql`
        SELECT c.relname AS table_name, a.attname AS column_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
      `) as { table_name: string; column_name: string }[]
    ).map((r) => `${r.table_name}.${r.column_name}`),
  )

  return { tablas, columnas }
}

async function run() {
  const apply = process.argv.includes('--apply')
  const asumir = new Set((readFlag('asumir') ?? '').split(',').map((s) => s.trim()).filter(Boolean))

  const { sql } = await resolveDbTarget({
    action: 'backfill de schema_migrations',
    destructive: apply,
  })

  const aplicadas = await readAppliedMigrations(sql)
  if (aplicadas === null) {
    throw new Error(
      'No existe la tabla schema_migrations.\n   Corré primero: npx tsx scripts/run-migration-024.ts',
    )
  }

  const cat = await catalogo(sql)
  const porVersion = objetosPorVersion()
  const filas: Fila[] = []

  for (const version of knownVersions(SCRIPTS_DIR)) {
    if (aplicadas.has(version)) {
      filas.push({ version, veredicto: 'ya-registrada', detalle: aplicadas.get(version)!.source })
      continue
    }

    const { tablas, columnas } = porVersion.get(version) ?? { tablas: [], columnas: [] }

    if (tablas.length === 0 && columnas.length === 0) {
      filas.push({
        version,
        veredicto: asumir.has(version) ? 'aplicada' : 'sin-evidencia',
        detalle: asumir.has(version)
          ? 'asumida por --asumir'
          : 'no declara tablas ni columnas (sólo índices, constraints, COMMENT o backfill)',
      })
      continue
    }

    const faltanTablas = tablas.filter((t) => !cat.tablas.has(t))
    const faltanColumnas = columnas.filter((c) => !cat.columnas.has(c))

    if (faltanTablas.length === 0 && faltanColumnas.length === 0) {
      filas.push({
        version,
        veredicto: 'aplicada',
        detalle: `${tablas.length} tabla(s), ${columnas.length} columna(s) presentes`,
      })
    } else {
      filas.push({
        version,
        veredicto: 'falta',
        detalle: [...faltanTablas, ...faltanColumnas].join(', '),
      })
    }
  }

  const simbolo: Record<Veredicto, string> = {
    aplicada: '+',
    falta: '!',
    'sin-evidencia': '?',
    'ya-registrada': '=',
  }

  console.log('\n====== QUÉ SE VA A REGISTRAR ======\n')
  for (const f of filas) {
    console.log(`  ${simbolo[f.veredicto]} ${f.version}  ${f.veredicto.padEnd(14)} ${f.detalle}`)
  }

  const aRegistrar = filas.filter((f) => f.veredicto === 'aplicada')
  const sinEvidencia = filas.filter((f) => f.veredicto === 'sin-evidencia')
  const faltantes = filas.filter((f) => f.veredicto === 'falta')

  console.log(`\n  A registrar   : ${aRegistrar.length}`)
  console.log(`  Ya registradas: ${filas.filter((f) => f.veredicto === 'ya-registrada').length}`)
  console.log(`  Sin evidencia : ${sinEvidencia.length}`)
  console.log(`  NO aplicadas  : ${faltantes.length}`)

  if (faltantes.length > 0) {
    console.log('\n  Estas migraciones NO están en la base. No se registran — hay que correrlas:')
    for (const f of faltantes) console.log(`      npx tsx scripts/run-migration-${f.version}.ts   (${f.detalle})`)
  }

  if (sinEvidencia.length > 0) {
    console.log('\n  Sobre estas no se puede inferir nada mirando el catálogo. Si sabés que')
    console.log('  están aplicadas, volvé a correr agregando:')
    console.log(`      --asumir=${sinEvidencia.map((f) => f.version).join(',')}`)
  }

  if (!apply) {
    console.log('\n  DRY-RUN — no se escribió nada.\n')
    return
  }

  for (const f of aRegistrar) {
    // `source: 'backfill'` y no 'runner': esta fila es una inferencia sobre el
    // catálogo, no el testimonio de una corrida. Que se pueda distinguir
    // después importa.
    await recordMigration(sql, f.version, SCRIPTS_DIR, 'backfill')
    console.log(`  → registrada ${f.version}`)
  }

  console.log(`\n✔ ${aRegistrar.length} migración(es) registrada(s).\n`)
}

run().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
