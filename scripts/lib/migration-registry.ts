import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Sql } from './db-target'

/**
 * Registro de migraciones aplicadas (tabla `schema_migrations`, migración 024).
 *
 * Complementa a `check-schema-drift.ts`, no lo reemplaza: aquél DEDUCE mirando
 * el catálogo y por eso no ve índices, constraints, COMMENT ni backfills; esto
 * REGISTRA, así que no deduce nada. El chequeo de drift sigue siendo el que
 * funciona en una base que nunca vio este registro.
 */

export interface AppliedMigration {
  version: string
  filename: string
  checksum: string
  applied_at: string
  source: 'runner' | 'backfill'
}

/** Todas las versiones que el repo conoce: las que tienen .sql y las que no. */
export function knownVersions(scriptsDir: string): string[] {
  const versions = new Set<string>()

  for (const file of readdirSync(scriptsDir)) {
    // La 018 no tiene .sql: vive entera dentro de su runner. La 012 no existe
    // ni como uno ni como otro — es el hueco aceptado que declara
    // tests/migrations.test.ts.
    const sqlMatch = /^(\d{3})-.*\.sql$/.exec(file)
    const runnerMatch = /^run-migration-(\d{3})\.ts$/.exec(file)
    if (sqlMatch) versions.add(sqlMatch[1])
    if (runnerMatch) versions.add(runnerMatch[1])
  }

  return [...versions].sort()
}

/**
 * Archivo que representa a una migración: el .sql si existe, y si no el runner.
 * Es lo que se mide para el checksum.
 */
export function migrationFile(scriptsDir: string, version: string): string {
  const sql = readdirSync(scriptsDir).find((f) => new RegExp(`^${version}-.*\\.sql$`).test(f))
  if (sql) return sql

  const runner = `run-migration-${version}.ts`
  if (existsSync(join(scriptsDir, runner))) return runner

  throw new Error(`No hay archivo para la migración ${version} en ${scriptsDir}`)
}

export function migrationChecksum(scriptsDir: string, version: string): { filename: string; checksum: string } {
  const filename = migrationFile(scriptsDir, version)
  // Se normalizan los fines de línea antes de hashear: este repo se edita en
  // Windows y git convierte a CRLF al checkout. Sin esto, la misma migración
  // daría checksums distintos según la máquina y el aviso de "alguien editó una
  // migración aplicada" saltaría siempre, que es como se apaga un aviso.
  const contenido = readFileSync(join(scriptsDir, filename), 'utf8').replace(/\r\n/g, '\n')
  return { filename, checksum: createHash('sha256').update(contenido).digest('hex') }
}

/**
 * Lee el registro. Devuelve `null` —y no un mapa vacío— cuando la tabla todavía
 * no existe: "no hay registro" y "el registro dice que no se aplicó ninguna"
 * son cosas distintas, y confundirlas haría que una base sin la 024 reporte las
 * 23 migraciones como faltantes.
 */
export async function readAppliedMigrations(sql: Sql): Promise<Map<string, AppliedMigration> | null> {
  try {
    const rows = (await sql`
      SELECT version, filename, checksum, applied_at, source
      FROM schema_migrations
      ORDER BY version
    `) as AppliedMigration[]

    return new Map(rows.map((r) => [r.version, r]))
  } catch (error) {
    // 42P01 = undefined_table. Cualquier otro error es un problema real de
    // conexión o permisos y no se puede tragar como "todavía no está la tabla".
    if ((error as { code?: string }).code === '42P01') return null

    // 42501 = insufficient_privilege. Le pasó al rol `ci_schema_check` en la
    // primera corrida real del gate (24/08/2026): `docs/gate-de-esquema.md`
    // listaba un solo GRANT, sobre `deployment_env`, y esa lista quedó vieja el
    // mismo día, cuando el chequeo sumó la capa del registro.
    //
    // NO se degrada a `null`. Sería tentador —el chequeo seguiría corriendo con
    // la capa del catálogo— y sería exactamente la enfermedad que este proyecto
    // ya pagó tres veces: apagar en silencio la mitad exacta de la verificación
    // y que el job siga en verde.
    if ((error as { code?: string }).code === '42501') {
      throw new Error(
        'Sin permiso para leer schema_migrations.\n' +
          '   El rol necesita:  GRANT SELECT ON schema_migrations TO <rol>;\n' +
          '   Ver docs/gate-de-esquema.md. No se sigue sin esta capa: es la que detecta\n' +
          '   una migración de sólo índices, constraints, COMMENT o backfill.',
      )
    }

    throw error
  }
}

/**
 * Deja constancia de que una migración se aplicó. Idempotente: volver a correr
 * un runner (todos son `IF NOT EXISTS`) actualiza la fila en vez de fallar.
 *
 * No explota si la tabla todavía no existe. Los runners anteriores a la 024 la
 * llaman igual, y en una base vieja simplemente no hay dónde anotar — eso no
 * puede convertir una migración exitosa en un error.
 */
export async function recordMigration(
  sql: Sql,
  version: string,
  scriptsDir = join(process.cwd(), 'scripts'),
  source: 'runner' | 'backfill' = 'runner',
): Promise<void> {
  const { filename, checksum } = migrationChecksum(scriptsDir, version)

  try {
    await sql`
      INSERT INTO schema_migrations (version, filename, checksum, applied_at, source)
      VALUES (${version}, ${filename}, ${checksum}, NOW(), ${source})
      ON CONFLICT (version) DO UPDATE
        SET filename   = EXCLUDED.filename,
            checksum   = EXCLUDED.checksum,
            applied_at = NOW(),
            source     = EXCLUDED.source
    `
  } catch (error) {
    if ((error as { code?: string }).code === '42P01') {
      console.warn(
        `   (sin registrar: falta la tabla schema_migrations — corré npx tsx scripts/run-migration-024.ts)`,
      )
      return
    }
    throw error
  }
}
