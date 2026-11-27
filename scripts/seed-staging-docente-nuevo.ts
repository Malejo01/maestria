/**
 * Tanda AA · AA4 — Un docente RECIÉN registrado en staging (sin rol, sin
 * materias, sin plan arrancado), para recorrer el registro de punta a punta
 * con el ingreso de desarrollo. Datos ficticios: nombre de prueba y email en
 * `staging.invalid`. Imprime el id.
 *
 *   npx tsx scripts/seed-staging-docente-nuevo.ts --env=staging [--fundador]
 *
 * `--fundador` además crea en staging el código FUNDADOR que propone el
 * análisis Founder (33 %, Particular, mensual, 3 meses, 20 usos), si no existe.
 * Se niega a correr fuera de staging.
 */
import { resolveDbTarget } from './lib/db-target'

async function main() {
  if (!process.argv.includes('--env=staging')) throw new Error('Sólo corre contra staging: agregá --env=staging.')
  const target = await resolveDbTarget({ action: 'alta de un docente de prueba en staging' })
  if (target.environment !== 'staging') throw new Error(`La base no es staging (${target.environment}). Abortado.`)
  const { sql } = target

  const sello = Date.now().toString(36)
  const id = `aa4-docente-${sello}`
  await sql`
    INSERT INTO users (id, email, name, created_at, updated_at)
    VALUES (${id}, ${`aa4-${sello}@staging.invalid`}, ${`Docente Nueva AA4 ${sello.slice(-4)}`}, NOW(), NOW())
  `

  if (process.argv.includes('--fundador')) {
    await sql`
      INSERT INTO codigos_descuento (codigo, porcentaje, aplica, forma, meses, usos_maximos, nota, creado_por, activo)
      SELECT 'FUNDADOR', 33, 'particular', 'mensual', 3, 20, 'AA4: el código fundador del análisis Founder (staging)', 'aa4', TRUE
      WHERE NOT EXISTS (SELECT 1 FROM codigos_descuento WHERE codigo = 'FUNDADOR')
    `
  }
  console.log(id)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
