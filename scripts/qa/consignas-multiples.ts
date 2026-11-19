/**
 * K3: lista (no modifica) las preguntas `numeric` y `short_answer` guardadas en
 * `teacher_quizzes` cuya consigna pide más de un valor — las que el validador
 * de generación (`lib/consigna-multiple.ts`) descartaría hoy.
 *
 * Uso:
 *   npx tsx scripts/qa/consignas-multiples.ts --env=staging
 *   npx tsx scripts/qa/consignas-multiples.ts            (producción: lo corre Mauro)
 *   … --practica   suma los enunciados de práctica ya respondidos (quiz_answers):
 *                  no se pueden corregir, pero dicen cuánto pasaba antes del validador.
 *
 * Sólo lee. Nunca escribe: qué hacer con las de producción lo decide Mauro.
 */
import { resolveDbTarget } from '../lib/db-target'
import { motivoConsignaMultiple } from '../../lib/consigna-multiple'

interface Fila {
  id: number
  title: string
  user_id: string
  created_at: string
  questions: unknown
}

async function run() {
  const target = await resolveDbTarget({
    action: 'listado de sólo lectura de consignas que piden más de un valor',
    destructive: false,
  })

  const filas = (await target.sql`
    SELECT id, title, user_id, created_at, questions FROM teacher_quizzes ORDER BY id
  `) as Fila[]

  let revisadas = 0
  const marcadas: string[] = []
  for (const fila of filas) {
    const preguntas = Array.isArray(fila.questions) ? (fila.questions as Record<string, unknown>[]) : []
    preguntas.forEach((p, i) => {
      if (p?.type !== 'numeric' && p?.type !== 'short_answer') return
      revisadas++
      const motivo = motivoConsignaMultiple(String(p.question ?? ''))
      if (!motivo) return
      const respuesta = p.type === 'numeric' ? String(p.correctAnswer) : JSON.stringify(p.acceptedAnswers)
      marcadas.push(
        `- cuestionario ${fila.id} «${fila.title}», pregunta ${i + 1} (${p.type}, ${motivo})\n` +
          `  ${String(p.question).replace(/\s+/g, ' ')}\n` +
          `  respuesta guardada: ${respuesta}`,
      )
    })
  }

  console.log(`Base: ${target.environment} (${target.host})`)
  console.log(`Cuestionarios: ${filas.length} · preguntas numeric/short_answer revisadas: ${revisadas} · marcadas: ${marcadas.length}`)
  if (marcadas.length) console.log('\n' + marcadas.join('\n'))

  if (process.argv.includes('--practica')) {
    const practica = (await target.sql`
      SELECT question_type, question_text, count(*)::int AS veces
      FROM quiz_answers
      WHERE question_type IN ('numeric', 'short_answer')
      GROUP BY question_type, question_text
    `) as { question_type: string; question_text: string; veces: number }[]
    const enPractica = practica.filter((f) => motivoConsignaMultiple(f.question_text))
    console.log(`\nPráctica (quiz_answers): ${practica.length} enunciados distintos revisados · marcados: ${enPractica.length}`)
    for (const f of enPractica) {
      const motivo = motivoConsignaMultiple(f.question_text)
      console.log(`- (${f.question_type}, ${motivo}, respondida ${f.veces} veces) ${f.question_text.replace(/\s+/g, ' ')}`)
    }
  }
}

run().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
