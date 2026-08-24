/**
 * Shared entry point for every script in `scripts/` that WRITES to Postgres.
 *
 * Before this existed, each runner did `dotenv.config({ path: '.env.local' })`
 * and grabbed DATABASE_URL — which meant there was no way to run one against
 * anything but production, and no way to notice you had. That is fine for the
 * `IF NOT EXISTS` migrations and genuinely dangerous for the one-off repair
 * scripts (`fix-tutoria-grades.ts` opens with `DELETE FROM curriculum`).
 *
 * The rule here: picking the env file is a convenience, but the AUTHORITY on
 * "which environment am I talking to" is the `deployment_env` row inside the
 * database itself (migration 017). A wrong env file can't fool it, because the
 * answer travels with the data.
 */
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'
import * as fs from 'node:fs'
import * as readline from 'node:readline/promises'

export type DeploymentEnv = 'production' | 'staging' | 'development'

/**
 * Normalizes a Neon host by removing the `-pooler` suffix from the first segment
 * (the main subdomain) if present. This ensures that pooled and unpooled connections
 * to the same database are recognized as identical.
 */
export function normalizeNeonHost(host: string): string {
  return host.replace(/^([^.]+)-pooler(\.|$)/, '$1$2')
}

/** What `neon(url)` actually returns: rows as arrays, not full result objects. */
export type Sql = NeonQueryFunction<false, false>

/**
 * Reserved domain for anonymized addresses. `.invalid` is reserved by RFC 2606
 * and can never be delegated, so a leaked staging dump cannot be used to mail a
 * real person even by accident — and "is this row anonymized?" becomes a plain
 * suffix check instead of a heuristic.
 */
export const ANONYMIZED_EMAIL_DOMAIN = 'staging.invalid'

export interface DbTarget {
  sql: Sql
  url: string
  host: string
  environment: DeploymentEnv
  /**
   * True only when the marker says 'production' AND we are connected to the
   * host that marker was written on. A branch cloned from production inherits
   * the row verbatim, so `environment` alone cannot tell the two apart — see
   * the comment on `origin_host` in scripts/017-deployment-env.sql.
   */
  isRealProduction: boolean
  projectId: string | null
}

interface ResolveOptions {
  /** Human description used in prompts and logs, e.g. "migración 018". */
  action: string
  /**
   * Set false for read-only scripts, which skip the production prompt.
   * Defaults to true: a script that imports this module is assumed to write.
   */
  destructive?: boolean
  /**
   * Only migration 017's own runner passes this — it is what creates the
   * marker table, so it cannot require the marker to already exist.
   */
  allowMissingMarker?: boolean
}

/** Reads `--env=<name>`, falling back to DB_TARGET, then 'local'. */
function readRequestedEnvFile(): string {
  const flag = process.argv.find((arg) => arg.startsWith('--env='))
  const requested = flag ? flag.slice('--env='.length) : process.env.DB_TARGET
  if (!requested || requested === 'local' || requested === 'production') return '.env.local'
  return `.env.${requested}.local`
}

/**
 * Resolves the marker row. Returns 'production' when the table is missing:
 * an unknown database is treated as the most dangerous one it could be, so a
 * database that predates migration 017 still gets the confirmation prompt.
 */
async function readMarker(
  sql: Sql,
): Promise<{ environment: DeploymentEnv; originHost: string | null; exists: boolean }> {
  try {
    const rows = (await sql`
      SELECT environment, origin_host FROM deployment_env WHERE id = true LIMIT 1
    `) as { environment: DeploymentEnv; origin_host: string | null }[]

    const row = rows[0]
    if (!row) return { environment: 'production', originHost: null, exists: false }
    return { environment: row.environment, originHost: row.origin_host, exists: true }
  } catch (error) {
    // 42P01 = undefined_table. Anything else is a real connection/permission
    // problem and must not be swallowed into a false "looks like production".
    if ((error as { code?: string }).code === '42P01') {
      return { environment: 'production', originHost: null, exists: false }
    }
    throw error
  }
}

async function confirmProduction(target: DbTarget, action: string): Promise<void> {
  const token = target.projectId ?? target.host

  // CI path: no TTY to prompt on, so the intent has to arrive as an env var
  // that spells out the exact project. A bare `--yes` would be too easy to
  // paste into a workflow by accident.
  const preApproved = process.env.CONFIRM_PRODUCTION
  if (preApproved) {
    if (preApproved === token) return
    throw new Error(
      `CONFIRM_PRODUCTION="${preApproved}" no coincide con el proyecto destino ("${token}"). Abortado.`,
    )
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      `Se intentó "${action}" contra PRODUCCIÓN sin terminal interactiva.\n` +
        `Si es intencional, volvé a correr con CONFIRM_PRODUCTION=${token}`,
    )
  }

  console.log('')
  console.log('  ╔════════════════════════════════════════════════════════════╗')
  console.log('  ║  ⚠  ESTO ES PRODUCCIÓN — HAY DATOS DE DOCENTES Y ALUMNOS   ║')
  console.log('  ╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`   Acción : ${action}`)
  console.log(`   Host   : ${target.host}`)
  console.log(`   Proyecto: ${token}`)
  console.log('')

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`   Escribí "${token}" para continuar (o Enter para abortar): `)
    if (answer.trim() !== token) {
      throw new Error('Confirmación no coincide. Abortado sin tocar la base.')
    }
    console.log('')
  } finally {
    rl.close()
  }
}

/**
 * `new URL(url).hostname`, pero con un error que se pueda accionar.
 *
 * Pelado, `new URL()` sobre una cadena mal formada tira **"Invalid URL"** y
 * nada más. En el gate de esquema del 24/08/2026 eso apareció en CI sobre un
 * secreto que nadie puede leer para inspeccionar, y el mensaje no distinguía
 * "el rol no tiene privilegios" de "el valor no es una URL" — que son dos
 * problemas sin nada en común.
 *
 * Los datos que se imprimen (largo, esquema, comillas, espacios) alcanzan para
 * arreglarlo y **no revelan la credencial**: el esquema es `postgresql` en todos
 * los casos y el largo no es secreto. El valor en sí no se imprime nunca, ni
 * truncado.
 */
function parseHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    const esquema = url.includes('://') ? url.slice(0, url.indexOf('://')) : null
    const pistas = [
      `largo: ${url.length}`,
      esquema === null
        ? 'no tiene "://" — no parece una URL'
        : /^(postgres|postgresql)$/.test(esquema)
          ? `esquema: "${esquema}" (correcto)`
          : `esquema: "${esquema}" (se esperaba postgresql)`,
      url !== url.trim() ? 'tiene espacios o saltos de línea alrededor' : null,
      /^['"]|['"]$/.test(url.trim()) ? 'está entre comillas' : null,
      /^\s*psql\b/.test(url) ? 'empieza con "psql" — se copió el comando entero' : null,
    ].filter(Boolean)

    throw new Error(
      'DATABASE_URL no es una URL válida.\n' +
        `   Pistas (sin exponer el valor): ${pistas.join(' · ')}\n` +
        '   Tiene que ser la cadena sola, sin comillas y sin el "psql" de adelante:\n' +
        '     postgresql://usuario:clave@host/base?sslmode=require',
    )
  }
}

export async function resolveDbTarget(options: ResolveOptions): Promise<DbTarget> {
  const envFile = readRequestedEnvFile()
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile })
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    const context = fs.existsSync(envFile)
      ? `(ni en process.env, ni en el archivo local ${envFile})`
      : `(ni en process.env, y el archivo local de fallback ${envFile} no existe)`
    console.error(`DATABASE_URL no encontrada ${context}`)
    process.exit(1)
  }

  const host = parseHost(url)
  const sql = neon(url)
  const marker = await readMarker(sql)

  if (!marker.exists && !options.allowMissingMarker) {
    console.warn(
      `⚠  ${envFile} → ${host} no tiene la tabla deployment_env (migración 017).\n` +
        '   Se lo trata como PRODUCCIÓN por precaución. Corré primero:\n' +
        '     npx tsx scripts/run-migration-017.ts\n',
    )
  }

  // A clone always arrives claiming to be production. It is only the real one
  // if we are also standing on the host the marker was stamped on.
  const isRealProduction =
    marker.environment === 'production' &&
    (marker.originHost === null || normalizeNeonHost(marker.originHost) === normalizeNeonHost(host))

  const target: DbTarget = {
    sql,
    url,
    host,
    environment: marker.environment,
    isRealProduction,
    projectId: process.env.NEON_PROJECT_ID ?? null,
  }

  const label = isRealProduction
    ? 'PRODUCCIÓN'
    : marker.environment === 'production'
      ? 'clon de producción sin marcar (probablemente staging recién creado)'
      : marker.environment
  console.log(`→ Destino: ${label} · ${host} · vía ${envFile}`)

  if (isRealProduction && options.destructive !== false) {
    await confirmProduction(target, options.action)
  }

  return target
}

/**
 * Fails when any real address survives in `users`. Guest rows legitimately have
 * a NULL email (migration 015 made the column nullable so a guest is still a
 * real user row), so NULL counts as clean; anything else must carry the
 * reserved domain.
 */
export async function assertAnonymized(sql: Sql): Promise<void> {
  const rows = (await sql`
    SELECT count(*)::int AS leftover
    FROM users
    WHERE email IS NOT NULL
      AND email NOT LIKE ${'%@' + ANONYMIZED_EMAIL_DOMAIN}
  `) as { leftover: number }[]

  const leftover = rows[0]?.leftover ?? 0
  if (leftover > 0) {
    throw new Error(
      `Hay ${leftover} email(s) sin anonimizar en users.\n` +
        `   Una branch con datos personales reales no puede marcarse como staging.\n` +
        '   Corré primero: npx tsx scripts/anonymize-staging.ts --env=staging',
    )
  }
}

/**
 * Flips the marker. Going to 'staging' or 'development' runs the anonymization
 * gate first — this is the check that makes "staging always holds fake data" an
 * invariant enforced by code rather than a line in a runbook someone skims.
 */
export async function markEnvironment(
  target: DbTarget,
  environment: DeploymentEnv,
  note: string,
): Promise<void> {
  if (environment !== 'production') {
    await assertAnonymized(target.sql)
  }

  await target.sql`
    INSERT INTO deployment_env (id, environment, origin_host, note, updated_at)
    VALUES (true, ${environment}, ${target.host}, ${note}, NOW())
    ON CONFLICT (id) DO UPDATE
      SET environment = EXCLUDED.environment,
          origin_host = EXCLUDED.origin_host,
          note        = EXCLUDED.note,
          updated_at  = NOW()
  `
  console.log(`✔ Marcador actualizado: este database es "${environment}".`)
}
