/**
 * Corre los agentes contra el set de calibración y mide si sirven.
 *
 * Este script no genera nada: lee el fixture commiteado y evalúa. Iterar la
 * rúbrica cuesta sólo evaluación (~USD 0,10 por persona), así que se puede
 * iterar sin mirar el reloj.
 *
 * El gate está en lib/qa/calibration.ts y es explícito: recall 1,0 sobre los
 * casos reales conocidos como malos, precisión ≥ 0,9 sobre los que exigen
 * silencio. Un agente que no cumple no se usa contra contenido nuevo y este
 * script sale con código ≠ 0.
 *
 * Uso:
 *   npx tsx scripts/qa/calibrate.ts --env=staging
 *   npx tsx scripts/qa/calibrate.ts --env-file=../../../.env.staging.local
 *   npx tsx scripts/qa/calibrate.ts --lint-only        # sin tokens: sólo lo determinista
 *   npx tsx scripts/qa/calibrate.ts --persona=superior-matematica-sistemas
 *   npx tsx scripts/qa/calibrate.ts --effort=medium
 *   npx tsx scripts/qa/calibrate.ts --max-usd=2          # techo de gasto de la corrida
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as dotenv from 'dotenv'
import { resolveDbTarget, type Sql } from '../lib/db-target'
import { dimensionsForPersona, personaById } from '../../lib/qa/personas'
import { lintQuestions } from '../../lib/qa/lint-questions'
import {
  DEFAULT_PRECISION_THRESHOLD,
  evaluateGate,
  formatScore,
  scoreCalibration,
  type CalibrationCase,
} from '../../lib/qa/calibration'
import { buildReport, reportPath, serializeReport } from '../../lib/qa/report'
import type { Finding, LlmDimension } from '../../lib/qa/rubric'
import { loadGroundTruth } from './lib/curriculum-ground-truth'
import { DEFAULT_EVALUATOR_MODEL, evaluate, requireApiKey, type Effort } from './lib/evaluator'
import { Budget, DEFAULT_MAX_USD } from './lib/budget'

const FIXTURE_PATH = join(process.cwd(), 'qa-fixtures', 'calibration-2026-08-10.json')

interface Fixture {
  generado: string
  fechaDiagnostico: string
  cases: CalibrationCase[]
}

function readFlag(name: string): string | null {
  const flag = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return flag ? flag.slice(name.length + 3) : null
}

function groupByPersona(cases: CalibrationCase[]): Map<string, CalibrationCase[]> {
  const groups = new Map<string, CalibrationCase[]>()
  for (const calibrationCase of cases) {
    const group = groups.get(calibrationCase.persona) ?? []
    group.push(calibrationCase)
    groups.set(calibrationCase.persona, group)
  }
  return groups
}

async function calibratePersona(
  sql: Sql,
  personaId: string,
  cases: CalibrationCase[],
  options: { lintOnly: boolean; model: string; effort: Effort; precisionThreshold: number; budget: Budget }
): Promise<boolean> {
  const persona = personaById(personaId)
  const materia = persona.materias[0]
  const questions = cases.map((calibrationCase) => calibrationCase.question)

  console.log(`\n${'═'.repeat(78)}`)
  console.log(`  ${persona.label}`)
  console.log(`  ${cases.length} caso(s) — ${cases.filter((c) => c.provenance === 'real').length} real(es), ${cases.filter((c) => c.provenance === 'synthetic').length} sintético(s)`)
  console.log('═'.repeat(78))

  const groundTruth = await loadGroundTruth(sql, persona, materia)
  console.log(`  currículum: ${groundTruth.unitCount} unidad/es${groundTruth.hasProfessionalContext ? ' (con contexto profesional)' : ''}`)

  const lintFindings = lintQuestions(questions, {
    nivel: persona.nivel,
    grado: persona.grado,
    materia,
  })
  console.log(`  lint: ${lintFindings.length} hallazgo(s) determinista(s)`)

  let modelFindings: Finding[] = []
  let summary = 'Sólo se corrió el chequeo determinista (--lint-only): el modelo no se consultó.'
  let costUsd = 0
  let dropped = 0
  let dimensionsEvaluated: LlmDimension[] = dimensionsForPersona(persona)

  if (!options.lintOnly) {
    const result = await evaluate({
      persona,
      materia,
      groundTruth,
      questions,
      model: options.model,
      effort: options.effort,
    })
    modelFindings = result.findings
    summary = result.summary
    costUsd = result.costUsd
    dropped = result.droppedFindings
    dimensionsEvaluated = result.dimensionsEvaluated
    options.budget.add(result.costUsd, `evaluación de ${personaId}`)

    console.log(
      `  modelo: ${result.findings.length} hallazgo(s) · USD ${result.costUsd.toFixed(4)} · ` +
        `${result.usage.cacheReadTokens} tok de caché leídos`
    )
    if (dropped > 0) {
      console.log(`  ⚠ ${dropped} finding(s) descartado(s) por apuntar a preguntas inexistentes`)
    }
  }

  const allFindings = [...lintFindings, ...modelFindings]
  const score = scoreCalibration(personaId, cases, allFindings)
  const gate = evaluateGate(score, options.precisionThreshold)

  console.log('')
  for (const line of formatScore(score).split('\n')) console.log(`  ${line}`)

  const evidenceCounts = {
    real: cases.filter((c) => c.provenance === 'real').length,
    synthetic: cases.filter((c) => c.provenance === 'synthetic').length,
  }

  const report = buildReport({
    persona: personaId,
    kind: 'calibration',
    findings: allFindings,
    summary: `${summary}\n\n${formatScore(score)}\n\nGate: ${gate.passed ? 'PASA' : 'NO PASA'}${gate.reasons.length > 0 ? `\n- ${gate.reasons.join('\n- ')}` : ''}`,
    model: options.lintOnly ? 'none (--lint-only)' : options.model,
    effort: options.lintOnly ? 'n/a' : options.effort,
    questionCount: questions.length,
    dimensionsEvaluated: [...dimensionsEvaluated],
    evidenceCounts,
    costUsd,
    droppedFindings: dropped,
  })

  const path = join(process.cwd(), reportPath(personaId, 'calibration'))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeReport(report), 'utf8')

  console.log('')
  if (gate.passed) {
    console.log('  ✔ GATE: pasa — este agente puede correrse contra contenido nuevo.')
  } else {
    console.log('  ✘ GATE: NO pasa')
    for (const reason of gate.reasons) console.log(`     · ${reason}`)
  }
  console.log(`  reporte: ${reportPath(personaId, 'calibration')}`)

  return gate.passed
}

async function run() {
  const envFileFlag = readFlag('env-file')
  if (envFileFlag) dotenv.config({ path: envFileFlag })

  const lintOnly = process.argv.includes('--lint-only')
  const model = readFlag('model') ?? DEFAULT_EVALUATOR_MODEL
  const effort = (readFlag('effort') ?? 'high') as Effort
  const onlyPersona = readFlag('persona')
  const precisionThreshold = Number(readFlag('precision') ?? DEFAULT_PRECISION_THRESHOLD)
  const budget = new Budget(Number(readFlag('max-usd') ?? DEFAULT_MAX_USD))

  // Antes de tocar la base ni armar un prompt: si falta la clave, que falle acá
  // y no después de haber gastado medio script.
  if (!lintOnly) requireApiKey()

  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture
  console.log(`\nSet de calibración: ${fixture.cases.length} casos del ${fixture.fechaDiagnostico}`)
  console.log(
    `Modo: ${lintOnly ? 'sólo lint (sin tokens)' : `${model} · effort ${effort} · techo USD ${budget.remainingUsd.toFixed(2)}`}`
  )

  const target = await resolveDbTarget({
    action: 'leer curriculum para calibrar los agentes de contenido',
    destructive: false,
  })

  if (target.isRealProduction) {
    throw new Error('Este script sólo corre contra staging. El marcador dice PRODUCCIÓN.')
  }

  const groups = groupByPersona(fixture.cases)
  const results: { persona: string; passed: boolean }[] = []

  for (const [personaId, cases] of groups) {
    if (onlyPersona && personaId !== onlyPersona) continue
    const passed = await calibratePersona(target.sql, personaId, cases, {
      lintOnly,
      model,
      effort,
      precisionThreshold,
      budget,
    })
    results.push({ persona: personaId, passed })
  }

  console.log(`\n${'═'.repeat(78)}`)
  if (!lintOnly) console.log(`  ${budget.summary()}`)
  for (const result of results) {
    console.log(`  ${result.passed ? '✔' : '✘'} ${result.persona}`)
  }
  console.log('═'.repeat(78))

  const failed = results.filter((result) => !result.passed)
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} agente(s) sin calibrar. No se corren contra contenido nuevo hasta que pasen.\n`
    )
    // `exitCode` y no `process.exit()`: la conexión de Neon deja handles
    // abiertos y un exit abrupto hace abortar a libuv en Windows con un código
    // de salida que no es el que pusimos. CI necesita leer 0 ó 1, no un abort.
    process.exitCode = 1
  } else {
    console.log('\nTodos los agentes calibrados.\n')
  }
}

run().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : error}\n`)
  process.exitCode = 1
})
