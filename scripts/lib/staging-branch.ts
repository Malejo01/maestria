/**
 * Piezas puras del procedimiento de creación de la branch de staging.
 *
 * Viven acá y no dentro de scripts/create-staging-branch.ts porque ese script
 * ejecuta `run()` al importarse y no se puede testear sin hablarle a la API de
 * Neon y a producción. Lo que se puede probar de verdad —parseo de la URL,
 * detección de fugas, render del archivo de entorno— no debería depender de eso.
 */
import { normalizeNeonHost } from './db-target'

export interface ConnectionParts {
  host: string
  database: string
  role: string
}

/**
 * Saca de una connection string de Postgres lo que la API de Neon pide por
 * separado para devolver la URI de la branch nueva.
 *
 * El rol y la base salen de la URL de producción y no de constantes: son
 * `neondb_owner` y `neondb` hoy, pero si el proyecto se recrea con otros
 * nombres, una constante daría una URI que conecta a ninguna parte.
 */
export function parseConnectionParts(url: string): ConnectionParts {
  const parsed = new URL(url)
  const database = parsed.pathname.replace(/^\//, '')
  const role = decodeURIComponent(parsed.username)

  if (!parsed.hostname || !database || !role) {
    throw new Error('La DATABASE_URL de producción no tiene host, base y usuario reconocibles.')
  }

  return { host: parsed.hostname, database, role }
}

/** Host de una connection string, sin exponer la contraseña que la acompaña. */
export function hostOf(url: string): string {
  return new URL(url).hostname
}

/**
 * Compara el `origin_host` del marcador contra el host donde estamos parados.
 *
 * Normaliza los dos lados porque `markEnvironment` guarda el host tal cual lo
 * recibió y `run-migration-017.ts` guarda el normalizado: según cuál escribió
 * último, la fila puede tener o no el sufijo `-pooler`. Comparar en crudo daría
 * un falso negativo justo en el chequeo que confirma que la branch es la nuestra.
 */
export function originHostMatches(originHost: string | null, currentHost: string): boolean {
  if (!originHost) return false
  return normalizeNeonHost(originHost) === normalizeNeonHost(currentHost)
}

/**
 * Clave de comparación. Minúsculas y sin espacios de más porque " Ana Pérez " y
 * "ana pérez" son la misma persona: comparar en crudo dejaría pasar una fuga por
 * una diferencia de mayúsculas.
 */
function comparisonKey(value: string): string {
  return value.trim().toLowerCase()
}

/** Conjunto de comparación a partir de valores reales, salteando nulos y vacíos. */
export function comparisonSet(values: (string | null | undefined)[]): Set<string> {
  const set = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const key = comparisonKey(value)
    if (key.length > 0) set.add(key)
  }
  return set
}

/**
 * Cuántos valores de la branch nueva siguen siendo valores reales de producción.
 *
 * Devuelve un número y nunca el valor: el resultado va a la consola, y el sentido
 * de todo esto es que un dato real no salga de producción. Saber que hay 3 fugas
 * en `users.email` alcanza para decidir —se borra la branch— sin imprimir el
 * email de nadie.
 */
export function countLeaks(real: Set<string>, candidates: (string | null | undefined)[]): number {
  let leaks = 0
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    if (real.has(comparisonKey(candidate))) leaks += 1
  }
  return leaks
}

/**
 * Cuántos valores NO terminan con el dominio reservado.
 *
 * Complementa a `countLeaks` en vez de reemplazarlo: el chequeo por patrón
 * detecta un email inventado que no sea `.invalid`, y el de fugas detecta un
 * email real que sobrevivió. Ninguno de los dos ve lo que ve el otro.
 */
export function countOutsideDomain(values: (string | null | undefined)[], domain: string): number {
  let outside = 0
  for (const value of values) {
    if (typeof value !== 'string') continue
    if (!value.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) outside += 1
  }
  return outside
}

export interface StagingEnvFileInput {
  pooledUrl: string
  unpooledUrl: string
  projectId: string
  branchName: string
  branchId: string
  createdAt: Date
}

/**
 * Contenido de `.env.staging.local`.
 *
 * Sólo lleva lo que identifica a la branch. El resto de las variables de staging
 * —`AUTH_SECRET`, el client de Google, la key de Gemini— tienen que ser
 * DISTINTAS de las de producción (ver docs/staging.md §2.5), y copiarlas acá
 * desde `.env.local` sería el error exacto que ese cuadro previene: compartir
 * `AUTH_SECRET` hace que una sesión de staging valga en producción.
 */
export function renderStagingEnvFile(input: StagingEnvFileInput): string {
  return `# Generado por scripts/create-staging-branch.ts el ${input.createdAt.toISOString()}
# Branch de Neon: ${input.branchName} (${input.branchId})
#
# Verificada contra producción antes de escribirse: sin emails, nombres ni
# tokens reales. Ver docs/staging.md §2.
#
# FALTAN, y NO se copian de .env.local a propósito (docs/staging.md §2.5):
#   AUTH_SECRET / NEXTAUTH_SECRET  → uno DISTINTO, o una sesión de staging
#                                    vale en producción.
#   GOOGLE_CLIENT_ID / _SECRET     → client de OAuth propio de staging.
#   GOOGLE_GENERATIVE_AI_API_KEY   → key aparte, con cuota propia.
#   AUTH_URL / NEXTAUTH_URL        → dominio de staging.

DATABASE_URL=${input.pooledUrl}
DATABASE_URL_UNPOOLED=${input.unpooledUrl}
NEON_PROJECT_ID=${input.projectId}
`
}
