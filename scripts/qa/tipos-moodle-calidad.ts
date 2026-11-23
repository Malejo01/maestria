/**
 * Ronda U · U3 — Lista (no modifica) las preguntas de tipo Moodle guardadas en
 * `teacher_quizzes` que el validador de calidad (`lib/validar-tipos-moodle.ts`)
 * descartaría hoy al generar: pares que se confunden, un orden sin criterio o
 * con pasos intercambiables, huecos sin su respuesta, distractores que son la
 * misma palabra, una calculada con fórmula o valores que no cierran, varias
 * correctas sin 2 correctas y 1 incorrecta.
 *
 * Uso:
 *   npx tsx scripts/qa/tipos-moodle-calidad.ts                  (staging, por defecto)
 *   npx tsx scripts/qa/tipos-moodle-calidad.ts --env=production (lo corre Mauro; sólo lee)
 *   … --desde=2026-11-22   sólo los cuestionarios creados desde esa fecha
 *
 * Sólo lee. Nunca escribe.
 */
import { resolveDbTarget } from '../lib/db-target'
import { MOTIVO_DE_CALIDAD, problemaDeCalidad, type ProblemaDeCalidad } from '../../lib/validar-tipos-moodle'
import { problemaDeTipoMoodle, TIPOS_MOODLE } from '../../lib/tipos-moodle'

// Por defecto, staging: producción sólo con --env=production a propósito.
if (!process.argv.some((a) => a.startsWith('--env=')) && !process.env.DB_TARGET) process.env.DB_TARGET = 'staging'

interface Fila {
  id: number
  title: string
  questions: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura de preguntas de tipo Moodle que el validador de calidad descartaría',
    destructive: false,
  })
  const desde = process.argv.find((a) => a.startsWith('--desde='))?.slice('--desde='.length) ?? null
  const filas = (await target.sql`
    SELECT id, title, questions FROM teacher_quizzes
    WHERE ${desde}::date IS NULL OR created_at >= ${desde}::date
    ORDER BY id
  `) as Fila[]

  const porTipo = new Map<string, { revisadas: number; marcadas: number }>()
  const porMotivo = new Map<ProblemaDeCalidad | 'forma', number>()
  const marcadas: string[] = []
  for (const fila of filas) {
    const preguntas = Array.isArray(fila.questions) ? (fila.questions as Record<string, unknown>[]) : []
    preguntas.forEach((p, i) => {
      if (!(TIPOS_MOODLE as readonly string[]).includes(String(p.type))) return
      const cuenta = porTipo.get(String(p.type)) ?? { revisadas: 0, marcadas: 0 }
      cuenta.revisadas++
      const deForma = problemaDeTipoMoodle(p)
      const deCalidad = deForma ? null : problemaDeCalidad(p)
      if (deForma || deCalidad) {
        cuenta.marcadas++
        porMotivo.set(deCalidad ?? 'forma', (porMotivo.get(deCalidad ?? 'forma') ?? 0) + 1)
        marcadas.push(
          `- cuestionario ${fila.id} «${fila.title}», pregunta ${i + 1} (${p.type}): ${deCalidad ? MOTIVO_DE_CALIDAD[deCalidad] : deForma}\n` +
            `  ${String(p.question ?? '').replace(/\s+/g, ' ').slice(0, 160)}`,
        )
      }
      porTipo.set(String(p.type), cuenta)
    })
  }

  console.log(`\nBase: ${target.environment} · ${filas.length} cuestionarios${desde ? ` desde ${desde}` : ''}\n`)
  if (porTipo.size === 0) {
    console.log('No hay preguntas de tipo Moodle guardadas.')
    return
  }
  console.log('Por tipo (revisadas → marcadas):')
  for (const [tipo, c] of [...porTipo.entries()].sort()) {
    console.log(`  ${tipo.padEnd(18)} ${String(c.revisadas).padStart(4)} → ${c.marcadas} (${((100 * c.marcadas) / c.revisadas).toFixed(1)} %)`)
  }
  if (porMotivo.size > 0) {
    console.log('\nPor motivo:')
    for (const [motivo, n] of porMotivo) console.log(`  ${n} · ${motivo === 'forma' ? 'mal armada (F2 a F7)' : MOTIVO_DE_CALIDAD[motivo]}`)
    console.log('\nLas marcadas:')
    console.log(marcadas.join('\n'))
  }
}

run().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
