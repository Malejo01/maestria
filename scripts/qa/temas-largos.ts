/**
 * Ronda T · D2: lista (no modifica) los temas largos de las materias guardadas
 * y cómo se separarían hoy (`separarTemaLargo`, D1): con un corte seguro, o
 * pidiéndole a la IA la división (el botón "Separar en temas" de *Mis materias*).
 *
 * Uso:
 *   npx tsx scripts/qa/temas-largos.ts                       (staging, por defecto)
 *   $env:CONFIRM_PRODUCTION="<id del proyecto>"; npx tsx scripts/qa/temas-largos.ts --env=production
 *
 * Sólo lee: ninguna consulta escribe, ni en staging ni en producción. No llama a
 * la IA.
 */
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.argv.push('--env=staging')

import { resolveDbTarget } from '../lib/db-target'
import { LARGO_MAXIMO_DE_TEMA, separarTemaLargo } from '../../lib/temas-granulares'

interface Fila {
  id: number
  subject_name: string
  units: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura de los temas largos de cada materia (no escribe nada)',
    destructive: true,
  })
  const filas = (await target.sql`SELECT id, subject_name, units FROM teacher_programs WHERE status = 'active' ORDER BY id`) as Fila[]
  console.log(`Base: ${target.environment} (${target.host}) · materias activas: ${filas.length} · largo máximo de un tema: ${LARGO_MAXIMO_DE_TEMA}\n`)

  let largos = 0
  let seguros = 0
  const materias = new Set<number>()
  for (const fila of filas) {
    const unidades = Array.isArray(fila.units) ? (fila.units as { name?: string; topics?: { name?: string }[] }[]) : []
    for (const unidad of unidades) {
      for (const tema of unidad.topics ?? []) {
        const nombre = String(tema.name ?? '').replace(/\s+/g, ' ').trim()
        if (nombre.length <= LARGO_MAXIMO_DE_TEMA) continue
        largos++
        materias.add(fila.id)
        const r = separarTemaLargo(nombre)
        if (r.seguro && r.pedazos.length > 1) seguros++
        console.log(`#${fila.id} «${fila.subject_name}» · ${String(unidad.name ?? '').slice(0, 50)} · ${nombre.length} caracteres`)
        console.log(`    ${r.seguro && r.pedazos.length > 1 ? `se separa en ${r.pedazos.length} (corte seguro)` : 'hace falta la IA (sin corte seguro)'}: «${nombre.slice(0, 110)}${nombre.length > 110 ? '…' : ''}»`)
      }
    }
  }
  console.log(`\nTemas largos: ${largos} en ${materias.size} materias · con corte seguro: ${seguros} · para la IA: ${largos - seguros}`)
}

run().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
