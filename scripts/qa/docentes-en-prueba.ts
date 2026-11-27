/**
 * Tanda AA · AA1: cuántos docentes están en la prueba de 30 días y qué les
 * pasa cuando `MAESTRIA_PRUEBA_DIAS` queda en 0 (el valor por defecto desde AA1).
 *
 * Uso:
 *   npx tsx scripts/qa/docentes-en-prueba.ts                        (staging, por defecto)
 *   npx tsx scripts/qa/docentes-en-prueba.ts --env=production       (sólo lectura)
 *
 * Sólo lee: ninguna consulta escribe. No imprime emails ni nombres, sólo ids y
 * conteos. Para cada docente calcula el estado con la prueba encendida (30) y
 * apagada (0) usando la misma lógica que la app (`estadoDelPlan`) y los mismos
 * lugares (`lugaresDelDocente`).
 */
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.argv.push('--env=staging')

import { resolveDbTarget } from '../lib/db-target'

interface Fila {
  id: string
  email: string | null
  plan_nivel: unknown
  plan_vence_el: string | null
  prueba_iniciada_el: string | null
  plan_tipo?: unknown
  aula_cursos?: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'conteo de sólo lectura de los docentes en prueba (no escribe nada)',
    destructive: false,
  })
  // lib/db lee DATABASE_URL al primer uso: ya quedó cargada por resolveDbTarget.
  process.env.DATABASE_URL = target.url
  const { estadoDelPlan, pruebaSinArrancar } = await import('../../lib/planes')
  const { lugaresDelDocente } = await import('../../lib/alumnos-docente-server')
  const { isAdminEmail } = await import('../../lib/ai-rate-limit')

  const filas = (await target.sql`
    SELECT id, email, plan_nivel, plan_vence_el, prueba_iniciada_el, plan_tipo, aula_cursos
    FROM users
    WHERE role = 'DOCENTE' AND COALESCE(ejemplo, FALSE) = FALSE
    ORDER BY created_at
  `) as Fila[]

  const ahora = new Date()
  const conteo = new Map<string, number>()
  const sumar = (clave: string) => conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
  const cambian: string[] = []

  for (const fila of filas) {
    const esExento = isAdminEmail(fila.email)
    let lugares = { total: 0, porTipo: undefined as undefined | { particulares: number; cursos: number[] } }
    try {
      const l = await lugaresDelDocente(fila.id)
      lugares = { total: l.total, porTipo: l.porTipo }
    } catch {
      sumar('sin poder contar alumnos')
    }
    const datos = {
      nivel: fila.plan_nivel,
      venceEl: fila.plan_vence_el,
      pruebaIniciadaEl: fila.prueba_iniciada_el,
      esExento,
      ahora,
      alumnosActuales: lugares.total,
      tipo: fila.plan_tipo,
      aulaCursos: fila.aula_cursos,
      lugares: lugares.porTipo,
    }
    const antes = estadoDelPlan(datos, { ...process.env, MAESTRIA_PRUEBA_DIAS: '30' })
    const despues = estadoDelPlan(datos, { ...process.env, MAESTRIA_PRUEBA_DIAS: '0' })
    const sinArrancar = pruebaSinArrancar(datos)
    sumar(`hoy ${antes}${sinArrancar && antes === 'prueba' ? ' (sin arrancar)' : ''}`)
    if (antes !== despues) cambian.push(`  ${fila.id} · ${lugares.total} alumnos · ${antes}${sinArrancar ? ' sin arrancar' : ''} → ${despues}`)
  }

  console.log(`Base: ${target.environment} (${target.host}) · docentes: ${filas.length}\n`)
  for (const [clave, n] of [...conteo.entries()].sort()) console.log(`  ${clave}: ${n}`)
  console.log(`\nCambian de estado con MAESTRIA_PRUEBA_DIAS=0: ${cambian.length}`)
  for (const linea of cambian) console.log(linea)
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
