/**
 * M2: lista (no modifica) las preguntas guardadas en `teacher_quizzes` cuya
 * consigna no encaja con su tipo — las que el validador de generación
 * (`lib/validar-tipo-de-pregunta.ts`) arreglaría o descartaría hoy:
 *
 *   - verdadero o falso escrito como pregunta (abierta o de sí o no),
 *   - numérica que pide un concepto, un procedimiento o un nombre,
 *   - respuesta corta que pide "el valor" de una inecuación.
 *
 * Uso:
 *   npx tsx scripts/qa/tipos-incoherentes.ts --env=staging
 *   npx tsx scripts/qa/tipos-incoherentes.ts            (producción: lo corre Mauro)
 *   … --desde=2026-11-20   sólo los cuestionarios creados desde esa fecha
 *   … --practica           suma los enunciados ya respondidos (quiz_answers)
 *
 * Sólo lee. Nunca escribe: qué hacer con las de producción lo decide Mauro
 * (o el docente, que ahora ve el aviso en *Revisar y editar*).
 */
import { resolveDbTarget } from '../lib/db-target'
import { MOTIVO_DE_PROBLEMA, problemaDeTipo, type ProblemaDeTipo } from '../../lib/validar-tipo-de-pregunta'

interface Fila {
  id: number
  title: string
  created_at: string
  questions: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura de preguntas cuyo tipo no encaja con la consigna',
    destructive: false,
  })

  const desde = process.argv.find((a) => a.startsWith('--desde='))?.slice('--desde='.length) ?? null
  const filas = (await target.sql`
    SELECT id, title, created_at, questions FROM teacher_quizzes
    WHERE ${desde}::date IS NULL OR created_at >= ${desde}::date
    ORDER BY id
  `) as Fila[]

  let revisadas = 0
  const porMotivo = new Map<ProblemaDeTipo, number>()
  const marcadas: string[] = []
  for (const fila of filas) {
    const preguntas = Array.isArray(fila.questions) ? (fila.questions as Record<string, unknown>[]) : []
    preguntas.forEach((p, i) => {
      revisadas++
      const problema = problemaDeTipo(p)
      if (!problema) return
      porMotivo.set(problema, (porMotivo.get(problema) ?? 0) + 1)
      marcadas.push(
        `- cuestionario ${fila.id} «${fila.title}», pregunta ${i + 1} (${String(p.type)}: ${MOTIVO_DE_PROBLEMA[problema]})\n` +
          `  ${String(p.question ?? '').replace(/\s+/g, ' ')}`,
      )
    })
  }

  console.log(`Base: ${target.environment} (${target.host})${desde ? ` · desde ${desde}` : ''}`)
  console.log(`Cuestionarios: ${filas.length} · preguntas revisadas: ${revisadas} · marcadas: ${marcadas.length}`)
  for (const [problema, cantidad] of porMotivo) console.log(`  ${MOTIVO_DE_PROBLEMA[problema]}: ${cantidad}`)
  if (marcadas.length) console.log('\n' + marcadas.join('\n'))

  // Los enunciados ya respondidos (práctica libre incluida): no se pueden
  // corregir, pero dicen cuánto pasaba antes del validador.
  if (process.argv.includes('--practica')) {
    const practica = (await target.sql`
      SELECT question_type, question_text, count(*)::int AS veces
      FROM quiz_answers
      WHERE question_type IN ('true_false', 'numeric')
      GROUP BY question_type, question_text
    `) as { question_type: string; question_text: string; veces: number }[]
    const enPractica = practica
      .map((f) => ({ ...f, problema: problemaDeTipo({ type: f.question_type, question: f.question_text }) }))
      .filter((f) => f.problema)
    console.log(`\nRespondidas (quiz_answers): ${practica.length} enunciados true_false/numeric distintos · marcados: ${enPractica.length}`)
    for (const f of enPractica) {
      console.log(`- (${f.question_type}: ${MOTIVO_DE_PROBLEMA[f.problema!]}, respondida ${f.veces} veces) ${f.question_text.replace(/\s+/g, ' ')}`)
    }
  }
}

run().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
