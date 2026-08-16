import { resolveDbTarget, normalizeNeonHost } from './lib/db-target'

/**
 * Migration 018: Normalizes the existing `origin_host` in the `deployment_env` table.
 * 
 * Previously, the `origin_host` was saved exactly as the host string from the DATABASE_URL.
 * Since Neon provides both a pooled (with `-pooler`) and unpooled host for the same database,
 * saving the pooled host meant that connecting via the unpooled URL (which lacks `-pooler`)
 * caused the guardrail to see a mismatch and classify Production as a Staging clone.
 * 
 * The canonical value must be the unpooled host (without `-pooler` in its main subdomain)
 * because it is the common denominator, and `normalizeNeonHost` ensures both connection strings
 * are resolved to this same canonical value before comparison.
 */
async function run() {
  const target = await resolveDbTarget({ action: 'migración 018 (normalizar origin_host)' })

  const rows = (await target.sql`SELECT origin_host FROM deployment_env WHERE id = true`) as {
    origin_host: string | null
  }[]

  if (rows.length === 0) {
    throw new Error('Fallo crítico: No se encontró la fila en deployment_env. Ejecutá la migración 017 primero.')
  }

  const currentHost = rows[0]?.origin_host

  if (currentHost) {
    const normalized = normalizeNeonHost(currentHost)
    if (normalized !== currentHost) {
      await target.sql`
        UPDATE deployment_env
           SET origin_host = ${normalized}, updated_at = NOW()
         WHERE id = true
      `
      console.log(`✔ Origin host normalizado: ${currentHost} -> ${normalized}`)
    } else {
      console.log(`✔ Origin host ya estaba normalizado: ${currentHost}`)
    }
  } else {
    console.log('⚠ origin_host es NULL (aún no se había marcado con éxito).')
  }

  console.log('✅ ¡Migración 018 completada con éxito!')
}

run().catch((err) => {
  console.error('❌ Error en la migración 018:', err.message ?? err)
  process.exit(1)
})
