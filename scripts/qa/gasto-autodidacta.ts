/**
 * Ronda T · E2: el gasto de IA del modo autodidacta, alumno por alumno (no
 * modifica nada). Sale de `ai_usage_log` con endpoint 'autodidacta' (el tope
 * propio de E2), más cuántos cuestionarios generó cada uno y si tiene pase.
 *
 * Uso:
 *   npx tsx scripts/qa/gasto-autodidacta.ts                       (staging, por defecto)
 *   $env:CONFIRM_PRODUCTION="<id del proyecto>"; npx tsx scripts/qa/gasto-autodidacta.ts --env=production
 *
 * Sólo lee: ninguna consulta escribe. No llama a la IA.
 */
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.argv.push('--env=staging')

import { resolveDbTarget } from '../lib/db-target'

const DIAS = Number(process.argv.find((a) => a.startsWith('--dias='))?.slice(7) ?? 30)

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura del gasto de IA del modo autodidacta (no escribe nada)',
    destructive: true,
  })
  const filas = (await target.sql`
    SELECT l.user_id,
           COALESCE(u.name, l.user_id) AS alumno,
           COUNT(*)::int AS llamadas,
           COALESCE(SUM(l.estimated_cost_usd), 0)::float AS usd
    FROM ai_usage_log l
    LEFT JOIN users u ON u.id = l.user_id
    WHERE l.endpoint = 'autodidacta' AND l.created_at > NOW() - make_interval(days => ${DIAS})
    GROUP BY l.user_id, u.name
    ORDER BY usd DESC
  `) as { user_id: string; alumno: string; llamadas: number; usd: number }[]

  console.log(`Base: ${target.environment} (${target.host}) · últimos ${DIAS} días · ${filas.length} alumnos\n`)
  let total = 0
  for (const f of filas) {
    total += f.usd
    const materias = (await target.sql`
      SELECT p.subject_name, p.pase_hasta, (SELECT COUNT(*)::int FROM autodidacta_usos x WHERE x.program_id = p.id) AS usos
      FROM teacher_programs p WHERE p.user_id = ${f.user_id} AND p.personal = TRUE AND p.status = 'active'
    `) as { subject_name: string; pase_hasta: string | null; usos: number }[]
    console.log(`${f.alumno} · ${f.llamadas} llamadas · US$${f.usd.toFixed(4)}`)
    for (const m of materias) console.log(`   ${m.subject_name} · ${m.usos} cuestionarios · ${m.pase_hasta ? `pase hasta ${String(m.pase_hasta).slice(0, 10)}` : 'gratis'}`)
  }
  console.log(`\nTotal: US$${total.toFixed(4)}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
