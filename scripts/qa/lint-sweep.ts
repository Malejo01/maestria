/**
 * Barrido de lint determinista de sólo lectura, contra datos vivos.
 *
 * Complementa a calibrate.ts --lint-only, que lintea el fixture commiteado de
 * 10 casos: esto lintea poblaciones enteras. Reproduce exacto el baseline de
 * 88 hallazgos del roadmap (verificado el 25/08/2026 contra staging).
 *
 * Modo A (--diagnostico): las 1.680 respuestas del 10/08 reconstruidas desde
 * quiz_answers (misma reconstrucción que fetch-calibration-set.ts).
 * Modo B (--listar-quizzes y --quiz=<id>): las preguntas de un teacher_quiz —
 * para lintear una generación nueva apenas sale.
 *
 * Uso:
 *   npx tsx scripts/qa/lint-sweep.ts --env-file=<ruta .env> --diagnostico
 *   npx tsx scripts/qa/lint-sweep.ts --env-file=<ruta .env> --listar-quizzes
 *   npx tsx scripts/qa/lint-sweep.ts --env-file=<ruta .env> --quiz=<id>
 *
 * Sólo lee. Nunca escribe. Contra producción no pide confirmación justamente
 * porque declara destructive: false — no agregarle escrituras.
 */
import * as dotenv from 'dotenv'
import { resolveDbTarget, type Sql } from '../lib/db-target'
import { lintQuestions } from '../../lib/qa/lint-questions'
import type { Question, QuestionType } from '../../lib/types'
import type { Finding } from '../../lib/qa/rubric'

const FECHA_DIAGNOSTICO = '2026-08-10'
const CONTEXT = { nivel: 'Superior', grado: '1er Año', materia: 'Matemática' }

interface AnswerRow {
  id: number
  question_id: string
  question_text: string
  question_type: QuestionType
  topic_name: string
  options: unknown
  correct_answer: number | null
  answer_payload: Record<string, unknown> | null
  explanation: string | null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function rowToQuestion(row: AnswerRow): Question {
  const base = {
    id: row.question_id,
    topic: row.topic_name,
    topicName: row.topic_name,
    question: row.question_text,
    explanation: row.explanation ?? '',
  }
  const payload = row.answer_payload ?? {}
  switch (row.question_type) {
    case 'short_answer':
      return { ...base, type: 'short_answer', acceptedAnswers: asStringArray(payload.acceptedAnswers) }
    case 'true_false':
      return { ...base, type: 'true_false', correctAnswer: Boolean(payload.correctAnswer) }
    case 'numeric':
      return {
        ...base,
        type: 'numeric',
        correctAnswer: Number(payload.correctAnswer),
        tolerance: typeof payload.tolerance === 'number' ? payload.tolerance : undefined,
      }
    case 'multiple_choice':
    default:
      return {
        ...base,
        type: 'multiple_choice',
        options: asStringArray(row.options).length > 0 ? asStringArray(row.options) : asStringArray(payload.options),
        correctAnswer:
          typeof row.correct_answer === 'number' ? row.correct_answer : Number(payload.correctAnswer ?? 0),
      }
  }
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

function summarize(findings: Finding[], label: (index: number) => string) {
  const byRule = new Map<string, { count: number; severity: string; samples: string[] }>()
  for (const f of findings) {
    // Agrupar por el prefijo de la justificación (antes del primer "—" o ":")
    const key = `${f.dimension} · ${f.severity} · ${f.justification.replace(/\(.*?\)/g, '').slice(0, 80)}`
    const ruleKey = f.justification
      .replace(/^(Enunciado|Explicación): /, '')
      .replace(/".*?"/g, '"…"')
      .replace(/= [\d.-]+ no apunta.*$/, 'no apunta a ninguna opción')
      .replace(/Sólo \d+ opción/, 'Sólo N opción')
      .slice(0, 90)
    const entry = byRule.get(ruleKey) ?? { count: 0, severity: f.severity, samples: [] }
    entry.count += 1
    if (entry.samples.length < 6) entry.samples.push(label(f.questionIndex))
    byRule.set(ruleKey, entry)
  }
  const sorted = [...byRule.entries()].sort((a, b) => b[1].count - a[1].count)
  for (const [rule, { count, severity, samples }] of sorted) {
    console.log(`  ${String(count).padStart(4)} × [${severity}] ${rule}`)
    console.log(`         ids: ${samples.join(', ')}${count > samples.length ? ', …' : ''}`)
  }
  console.log(`  TOTAL: ${findings.length} hallazgos`)
}

async function lintDiagnostico(sql: Sql) {
  const rows = (await sql`
    SELECT qa.id, qa.question_id, qa.question_text, qa.question_type, qa.topic_name,
           qa.options, qa.correct_answer, qa.answer_payload, qa.explanation
    FROM quiz_answers qa
    JOIN quiz_attempts at ON at.id = qa.quiz_attempt_id
    WHERE at.completed_at::date = ${FECHA_DIAGNOSTICO}::date
    ORDER BY qa.id
  `) as AnswerRow[]

  console.log(`\n── Diagnóstico ${FECHA_DIAGNOSTICO}: ${rows.length} respuestas ──`)
  const questions = rows.map(rowToQuestion)
  const findings = lintQuestions(questions, CONTEXT)
  summarize(findings, (i) => String(rows[i]?.id ?? `?${i}`))
}

async function listarQuizzes(sql: Sql) {
  const rows = (await sql`
    SELECT id, title, subject_name, mode, question_count, created_at
    FROM teacher_quizzes
    WHERE created_at >= '2026-08-20'
    ORDER BY created_at DESC
    LIMIT 20
  `) as { id: number; title: string; subject_name: string; mode: string; question_count: number; created_at: Date }[]
  for (const r of rows) {
    console.log(`  id=${r.id} · "${r.title}" · ${r.subject_name} · ${r.mode} · ${r.question_count} preguntas · ${r.created_at}`)
  }
}

async function lintQuiz(sql: Sql, quizId: number) {
  const rows = (await sql`
    SELECT id, title, subject_name, mode, question_count, questions, created_at
    FROM teacher_quizzes WHERE id = ${quizId}
  `) as { id: number; title: string; subject_name: string; mode: string; question_count: number; questions: unknown; created_at: Date }[]
  const quiz = rows[0]
  if (!quiz) throw new Error(`No existe teacher_quizzes.id = ${quizId}`)
  const questions = (Array.isArray(quiz.questions) ? quiz.questions : []) as Question[]
  console.log(`\n── Quiz ${quiz.id}: "${quiz.title}" · ${quiz.subject_name} · ${quiz.mode} · ${questions.length} preguntas · ${quiz.created_at} ──`)
  const tipos = new Map<string, number>()
  for (const q of questions) tipos.set(q.type, (tipos.get(q.type) ?? 0) + 1)
  console.log(`  tipos: ${[...tipos.entries()].map(([t, n]) => `${t}=${n}`).join(', ')}`)
  const findings = lintQuestions(questions, CONTEXT)
  if (findings.length === 0) {
    console.log('  ✔ 0 hallazgos')
  } else {
    for (const f of findings) {
      console.log(`  [${f.severity}] pregunta #${f.questionIndex} (${questions[f.questionIndex]?.id}): ${f.justification}`)
    }
    console.log(`  TOTAL: ${findings.length} hallazgos`)
  }
}

async function run() {
  const envFileFlag = readFlag('env-file')
  if (envFileFlag) dotenv.config({ path: envFileFlag })

  const target = await resolveDbTarget({
    action: 'barrido de lint de sólo lectura (quiz_answers del 10/08 y teacher_quizzes)',
    destructive: false,
  })

  if (process.argv.includes('--diagnostico')) await lintDiagnostico(target.sql)
  if (process.argv.includes('--listar-quizzes')) await listarQuizzes(target.sql)
  const quizId = readFlag('quiz')
  if (quizId) await lintQuiz(target.sql, Number(quizId))
}

run().catch((error) => {
  console.error('❌', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
