/**
 * Ronda V · V3 — Arma un referido en STAGING, como pasaría en la app:
 *
 *   1. el docente que recomienda (`--referente=<id>`) tiene su código;
 *   2. un docente nuevo (`--nuevo=<id>`, se crea si no existe, @staging.invalid)
 *      llega con `?ref=CODIGO` (queda en `users.origen_ref`, como lo deja V1) y
 *      se registra: `registrarReferido` lo anota.
 *
 * Imprime `CODIGO=…` para pasárselo a simular-pago.ts (--codigo=…), que hace
 * el primer pago del nuevo con Mercado Pago simulado y dispara el premio.
 *
 *   MAESTRIA_REFERIDOS_ACTIVO=1 npx tsx scripts/qa/simular-referido.ts --env=staging --referente=<id> --nuevo=<id>
 *
 * Sólo staging (se niega si la base no está marcada staging).
 */
import { readFileSync } from 'node:fs'

if (!process.argv.includes('--env=staging')) {
  console.error('Sólo corre contra staging: agregá --env=staging.')
  process.exit(1)
}
process.env.DATABASE_URL = readFileSync('.env.staging.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.replace(/^["']|["']$/g, '')
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)

async function main() {
  const { sql } = await import('../../lib/db')
  const [env] = (await sql`SELECT environment FROM deployment_env WHERE id = true`) as { environment: string }[]
  if (env?.environment !== 'staging') throw new Error('Sólo contra una base marcada staging')
  const referente = arg('referente')
  const nuevo = arg('nuevo')
  if (!referente || !nuevo) throw new Error('Faltan --referente y --nuevo')

  const { miCodigoDeReferido, registrarReferido } = await import('../../lib/referidos-server')
  const codigo = await miCodigoDeReferido(referente)
  if (!codigo) throw new Error('Sin código: ¿MAESTRIA_REFERIDOS_ACTIVO=1 y la 046 corrida?')

  await sql`
    INSERT INTO users (id, email, name, role, is_onboarded, is_guest, created_at, updated_at)
    VALUES (${nuevo}, ${`${nuevo}@staging.invalid`}, 'Docente V3 Referido', 'DOCENTE', true, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING
  `
  await sql`UPDATE users SET origen = 'wa', origen_ref = ${codigo} WHERE id = ${nuevo}`
  await registrarReferido(nuevo)
  const [fila] = (await sql`SELECT referente_id FROM referidos WHERE referido_id = ${nuevo}`) as { referente_id: string }[]
  console.log(`CODIGO=${codigo}`)
  console.log(`REFERENTE_ANOTADO=${fila?.referente_id ?? 'ninguno'}`)
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
