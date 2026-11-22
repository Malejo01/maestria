/**
 * Ronda T · A2: lista (no modifica) las materias de los docentes con el área
 * y el carácter de cada unidad que se infieren hoy, para revisarlas a mano.
 *
 * Es lo mismo que pasa la primera vez que el docente abre o edita una materia
 * guardada antes de la ronda T (lib/area-del-programa.ts): acá sólo se mira.
 *
 * Uso:
 *   npx tsx scripts/qa/areas-de-programas.ts                       (staging, por defecto)
 *   $env:CONFIRM_PRODUCTION="<id del proyecto>"; npx tsx scripts/qa/areas-de-programas.ts --env=production
 *
 * Sólo lee: ninguna consulta escribe, ni en staging ni en producción.
 */
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.argv.push('--env=staging')

import { resolveDbTarget } from '../lib/db-target'
import { PERFILES } from '../../lib/areas'
import { completarAreaDelPrograma } from '../../lib/area-del-programa'
import { CONFIANZA_BAJA } from '../../lib/inferir-area'

interface Fila {
  id: number
  subject_name: string
  pedagogy_profile: Record<string, unknown> | null
  units: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura del área de cada materia (no escribe nada)',
    // En producción pide confirmación (o CONFIRM_PRODUCTION) aunque sólo lea.
    destructive: true,
  })

  const filas = (await target.sql`
    SELECT id, subject_name, pedagogy_profile, units
    FROM teacher_programs
    WHERE status = 'active'
    ORDER BY id
  `) as Fila[]

  console.log(`Base: ${target.environment} (${target.host}) · materias activas: ${filas.length}\n`)

  const porArea = new Map<string, number>()
  let dudosas = 0
  for (const fila of filas) {
    const perfil = fila.pedagogy_profile ?? {}
    const unidades = Array.isArray(fila.units) ? (fila.units as { name?: string; topics?: { name?: string }[] }[]) : []
    const r = completarAreaDelPrograma({
      materia: fila.subject_name,
      carrera: typeof perfil.degree === 'string' ? perfil.degree : null,
      perfil,
      unidades,
    })
    const nombre = PERFILES[r.perfil.area].nombre
    porArea.set(nombre, (porArea.get(nombre) ?? 0) + 1)
    const dudosa = r.perfil.areaConfianza < CONFIANZA_BAJA
    if (dudosa) dudosas++
    const guardada = typeof perfil.area === 'string' ? 'guardada' : 'sin guardar'
    console.log(
      `#${fila.id} «${fila.subject_name}» → ${nombre} (${r.perfil.areaOrigen}, ${guardada}, confianza ${r.perfil.areaConfianza.toFixed(2)})${dudosa ? '  ← REVISAR' : ''}`,
    )
    r.unidades.forEach((u, i) => {
      const temas = Array.isArray(u.topics) ? u.topics.length : 0
      console.log(`    ${i + 1}. ${String(u.name ?? '').slice(0, 70)} — ${u.caracter} (${temas} temas)`)
    })
  }

  console.log('\nPor área:')
  for (const [area, n] of [...porArea.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${area}: ${n}`)
  console.log(`Con confianza baja (revisar): ${dudosas}`)
}

run().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
