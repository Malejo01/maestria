/**
 * Tanda AC · AC1 — Cuántos docentes tienen hoy alumnos que entraron por el link
 * (lugares de curso, regla B1) y qué les pasaría si eligieran «Doy clases
 * particulares» (todos sus alumnos cuentan como particulares: gratis 2). Con la
 * modalidad sin dato (todos los de hoy) no cambia nada: esto es para saberlo.
 *
 *   npx tsx scripts/qa/modalidad-impacto.ts                   (staging, por defecto)
 *   npx tsx scripts/qa/modalidad-impacto.ts --env=production  (sólo lectura)
 *
 * Sólo lee. No imprime emails ni nombres: ids y conteos.
 */
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.argv.push('--env=staging')

import { resolveDbTarget } from '../lib/db-target'

async function run() {
  const target = await resolveDbTarget({ action: 'conteo de sólo lectura del impacto de la modalidad (no escribe nada)', destructive: false })
  process.env.DATABASE_URL = target.url
  const { lugaresDelDocente } = await import('../../lib/alumnos-docente-server')
  const { cupoGratis } = await import('../../lib/planes')
  const { isAdminEmail } = await import('../../lib/ai-rate-limit')

  const docentes = (await target.sql`
    SELECT id, email, to_jsonb(users) ->> 'modalidad' AS modalidad
    FROM users WHERE role = 'DOCENTE' AND COALESCE((to_jsonb(users) ->> 'ejemplo')::boolean, false) = false
  `) as { id: string; email: string | null; modalidad: string | null }[]

  const cupo = cupoGratis()
  let conLink = 0
  let pasarianElCupo = 0
  const filas: string[] = []
  for (const d of docentes) {
    if (isAdminEmail(d.email)) continue
    const l = await lugaresDelDocente(d.id)
    const porLink = l.porTipo.cursos.reduce((a, b) => a + b, 0)
    if (porLink === 0) continue
    conLink++
    const pasa = l.total > cupo
    if (pasa) pasarianElCupo++
    filas.push(`  ${d.id} · modalidad ${d.modalidad ?? 'sin dato'} · ${l.porTipo.particulares} particulares + ${porLink} por link = ${l.total}${pasa ? ` (> ${cupo}: conserva los suyos, se frenaría el siguiente)` : ''}`)
  }
  console.log(`Base: ${target.environment} · docentes: ${docentes.length}`)
  console.log(`Con alumnos por link (cambiarían de cuenta si fueran particulares): ${conLink}`)
  console.log(`De ésos, con más de ${cupo} en total: ${pasarianElCupo}`)
  for (const f of filas) console.log(f)
}

run().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
