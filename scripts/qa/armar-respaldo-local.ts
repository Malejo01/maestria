/**
 * Ronda Y · Y2 — Arma el respaldo de STAGING (sólo lectura) y lo guarda en un
 * archivo local, sin subirlo a ningún lado: para probar la restauración con
 * `scripts/restaurar-respaldo.ts --archivo=… --env=staging --ensayo`.
 *
 *   npx tsx scripts/qa/armar-respaldo-local.ts --env=staging --salida=respaldo.json.gz
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

function leerEnv(archivo: string): Record<string, string> {
  if (!existsSync(archivo)) return {}
  return Object.fromEntries(
    readFileSync(archivo, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, '')]),
  )
}

if (!process.argv.includes('--env=staging')) {
  console.error('Sólo arma el de staging: agregá --env=staging.')
  process.exit(1)
}
process.env.DATABASE_URL = leerEnv('.env.staging.local').DATABASE_URL
const salida = process.argv.find((a) => a.startsWith('--salida='))?.slice(9) ?? 'respaldo-staging.json.gz'

async function main() {
  const { armarRespaldo, comprimir } = await import('../../lib/respaldo-server')
  const { resumenDelRespaldo } = await import('../../lib/respaldo')
  const inicio = Date.now()
  const r = await armarRespaldo()
  const datos = comprimir(r)
  writeFileSync(salida, datos)
  for (const { tabla, filas } of resumenDelRespaldo(r)) console.log(`  ${tabla.padEnd(32)} ${filas}`)
  console.log(`\n${salida}: ${(datos.length / 1024).toFixed(1)} KB comprimido, en ${((Date.now() - inicio) / 1000).toFixed(1)} s.`)
}
main()
