/**
 * Scoring de la calibración.
 *
 * Una rúbrica sin calibrar no sirve, pero medir sólo recall tampoco alcanza:
 * un agente que marca `critical` en todo detecta el 100% de los defectos
 * conocidos y es inútil. Por eso el set tiene dos caras y el gate también:
 *
 *   - RECALL sobre casos que sabemos malos: tiene que ser 1,0. Si un agente
 *     aprueba una pregunta que sabemos que estaba mal, la rúbrica no sirve.
 *   - PRECISIÓN sobre casos que sabemos buenos: tiene que superar el umbral.
 *     Con 10% de falsos positivos el reporte todavía se lee; con más, se ignora,
 *     y un reporte ignorado es peor que ninguno.
 *
 * Los casos sintéticos se MIDEN Y REPORTAN pero no bloquean: los escribimos
 * nosotros, así que su número dice qué tan bien redactamos el defecto, no qué
 * tan bueno es el agente. Sólo la evidencia real del diagnóstico del 2026-08-10
 * puede reprobar a un agente.
 */
import type { Question } from '@/lib/types'
import { compareSeverity, DIMENSIONS, type Dimension, type Finding, type Severity } from '@/lib/qa/rubric'

export type Provenance = 'real' | 'synthetic'

/** Lo que se espera que el agente encuentre. `null` = el caso tiene que pasar limpio. */
export interface ExpectedDefect {
  dimension: Dimension
  /** El hallazgo cuenta si su severidad es ésta o peor. */
  minSeverity: Severity
}

export interface CalibrationCase {
  /**
   * Trazabilidad. Para los reales es `quiz_answers.<id>`, así se puede volver a
   * la fila exacta del diagnóstico; para los sintéticos, un slug descriptivo.
   */
  id: string
  provenance: Provenance
  /** Persona bajo la que se evalúa. La MISMA pregunta puede aparecer bajo dos
   *  personas con expectativas opuestas — ese es el control negativo cruzado. */
  persona: string
  question: Question
  expected: ExpectedDefect | null
  /**
   * Dimensiones sobre las que el agente TIENE que quedarse callado en este caso.
   *
   * Existe porque el defecto de una pregunta casi nunca es total. Las preguntas
   * de cónicas del 10/08 están fuera del programa de la Tecnicatura (critical en
   * `adecuacion_programa`) y al mismo tiempo su matemática es impecable —
   * verifiqué las seis a mano. Marcarlas también en `correccion_disciplinar`
   * sería el agente inventando un error para justificar la mala nota, que es
   * justo el fallo que un umbral de recall solo no puede ver.
   *
   * Un caso con `expected: null` no necesita declararlas: se le exige silencio
   * en todas.
   */
  mustNotFlag?: Dimension[]
  /** Por qué sabemos que está mal (o bien). Va al prompt de nadie: es para humanos. */
  note: string
}

export interface CaseOutcome {
  id: string
  provenance: Provenance
  expected: ExpectedDefect | null
  /** ¿Detectó el defecto esperado? `null` cuando el caso no espera ninguno. */
  detected: boolean | null
  /** ¿Se quedó callado donde debía? `null` cuando el caso no exige silencio. */
  silent: boolean | null
  /** Dimensiones sobre las que se exigió silencio y no lo hubo. */
  falsePositiveDimensions: Dimension[]
  /** Findings del modelo sobre este caso, para poder mirar el porqué de un rojo. */
  modelFindings: Finding[]
  lintFindings: Finding[]
}

export interface CalibrationScore {
  persona: string
  /** Recall sobre known-bad reales. El gate exige 1,0. */
  recallReal: number
  /**
   * Precisión sobre known-good reales.
   *
   * Definición operativa, la que fija el umbral: fracción de casos buenos sobre
   * los que el modelo se quedó CALLADO (sin hallazgos `major` ni `critical`).
   * No es la precisión de libro TP/(TP+FP) — es la tasa de silencio sobre lo
   * bueno, que es lo que decide si el reporte se lee o se ignora.
   */
  precisionReal: number
  recallSynthetic: number
  precisionSynthetic: number
  counts: {
    realBad: number
    realGood: number
    syntheticBad: number
    syntheticGood: number
  }
  /**
   * Hallazgos del LINT sobre casos buenos. Tiene que ser 0. No entra en el
   * umbral porque no es una opinión calibrable: es un bug de una regex, y se
   * arregla en lib/qa/lint-questions.ts, no subiendo un threshold.
   */
  lintFalsePositives: number
  outcomes: CaseOutcome[]
}

export interface CalibrationGate {
  passed: boolean
  reasons: string[]
}

/** Un `major` o un `critical` cuentan como "el agente marcó esto". Un `minor` no. */
const FLAG_THRESHOLD: Severity = 'major'

function findingsForCase(findings: Finding[], index: number, source: Finding['source']): Finding[] {
  return findings.filter((finding) => finding.questionIndex === index && finding.source === source)
}

function matchesExpected(finding: Finding, expected: ExpectedDefect): boolean {
  return (
    finding.dimension === expected.dimension && compareSeverity(finding.severity, expected.minSeverity) <= 0
  )
}

function isFlag(finding: Finding): boolean {
  return compareSeverity(finding.severity, FLAG_THRESHOLD) <= 0
}

/**
 * Puntúa una corrida de calibración.
 *
 * `cases` y `findings` se alinean por posición: el caso en el índice i es la
 * pregunta que el evaluador vio como `questionIndex: i`.
 */
export function scoreCalibration(
  persona: string,
  cases: CalibrationCase[],
  findings: Finding[]
): CalibrationScore {
  const outcomes: CaseOutcome[] = cases.map((calibrationCase, index) => {
    const modelFindings = findingsForCase(findings, index, 'model')
    const lintFindings = findingsForCase(findings, index, 'lint')

    // known-bad: alguien tiene que haberlo detectado, lint o modelo. Si una
    // regex lo atrapa, el defecto está detectado igual — y con mejor evidencia.
    const detected = calibrationCase.expected
      ? [...modelFindings, ...lintFindings].some((finding) =>
          matchesExpected(finding, calibrationCase.expected as ExpectedDefect)
        )
      : null

    const silenceDimensions = silenceScope(calibrationCase)
    const falsePositiveDimensions = silenceDimensions
      ? [
          ...new Set(
            modelFindings
              .filter((finding) => isFlag(finding) && silenceDimensions.includes(finding.dimension))
              .map((finding) => finding.dimension)
          ),
        ].sort()
      : []

    return {
      id: calibrationCase.id,
      provenance: calibrationCase.provenance,
      expected: calibrationCase.expected,
      detected,
      silent: silenceDimensions ? falsePositiveDimensions.length === 0 : null,
      falsePositiveDimensions,
      modelFindings,
      lintFindings,
    }
  })

  const withProvenanceOf = (provenance: Provenance) =>
    outcomes.filter((_, index) => cases[index].provenance === provenance)

  const rate = (group: CaseOutcome[], key: 'detected' | 'silent') => {
    const applicable = group.filter((outcome) => outcome[key] !== null)
    if (applicable.length === 0) return 1
    return applicable.filter((outcome) => outcome[key] === true).length / applicable.length
  }

  const real = withProvenanceOf('real')
  const synthetic = withProvenanceOf('synthetic')
  const countOf = (group: CaseOutcome[], key: 'detected' | 'silent') =>
    group.filter((outcome) => outcome[key] !== null).length

  const lintFalsePositives = outcomes.filter((outcome, index) => {
    const scope = silenceScope(cases[index])
    if (!scope) return false
    return outcome.lintFindings.some((finding) => isFlag(finding) && scope.includes(finding.dimension))
  }).length

  return {
    persona,
    recallReal: rate(real, 'detected'),
    precisionReal: rate(real, 'silent'),
    recallSynthetic: rate(synthetic, 'detected'),
    precisionSynthetic: rate(synthetic, 'silent'),
    counts: {
      realBad: countOf(real, 'detected'),
      realGood: countOf(real, 'silent'),
      syntheticBad: countOf(synthetic, 'detected'),
      syntheticGood: countOf(synthetic, 'silent'),
    },
    lintFalsePositives,
    outcomes,
  }
}

/**
 * Dimensiones sobre las que este caso exige silencio, o `null` si no exige
 * ninguno. Un caso conocido como bueno (`expected: null`) exige silencio total;
 * uno conocido como malo sólo sobre las que declare `mustNotFlag`.
 */
function silenceScope(calibrationCase: CalibrationCase): Dimension[] | null {
  if (!calibrationCase.expected) return [...DIMENSIONS]
  if (calibrationCase.mustNotFlag && calibrationCase.mustNotFlag.length > 0) {
    return calibrationCase.mustNotFlag
  }
  return null
}

/** Umbral de precisión acordado: con más de 10% de falsos positivos el reporte se ignora. */
export const DEFAULT_PRECISION_THRESHOLD = 0.9

/**
 * Decide si el agente puede usarse contra contenido nuevo.
 *
 * Sólo la evidencia real bloquea. Un agente sin ningún caso real (personas 1, 2,
 * 3 y 5 al día de hoy, porque las 1.680 respuestas del 10/08 son todas de
 * Matemática) NO puede aprobar: no hay con qué. Devolver "pasa" ahí sería el
 * mismo error que la rúbrica viene a evitar.
 */
export function evaluateGate(
  score: CalibrationScore,
  precisionThreshold: number = DEFAULT_PRECISION_THRESHOLD
): CalibrationGate {
  const reasons: string[] = []

  if (score.counts.realBad === 0) {
    reasons.push(
      'Sin casos reales conocidos como malos: no hay evidencia con la que aprobar a este agente. ' +
        'Los sintéticos se reportan pero no habilitan.'
    )
  } else if (score.recallReal < 1) {
    const missed = score.outcomes.filter(
      (outcome) => outcome.provenance === 'real' && outcome.detected === false
    )
    reasons.push(
      `Recall real ${score.recallReal.toFixed(2)} < 1,00 — aprobó ${missed.length} caso(s) que sabemos malos: ` +
        `${missed.map((outcome) => outcome.id).join(', ')}.`
    )
  }

  if (score.counts.realGood === 0) {
    reasons.push(
      'Sin evidencia real de precisión: ningún caso real exige silencio. Un agente que marca todo ' +
        'pasaría el recall sin que nadie lo note — declará `mustNotFlag` en los casos malos o sumá casos buenos.'
    )
  } else if (score.precisionReal < precisionThreshold) {
    const noisy = score.outcomes.filter(
      (outcome) => outcome.provenance === 'real' && outcome.silent === false
    )
    reasons.push(
      `Precisión real ${score.precisionReal.toFixed(2)} < ${precisionThreshold.toFixed(2)} — ` +
        `falsos positivos en ${noisy.map((outcome) => `${outcome.id} (${outcome.falsePositiveDimensions.join(', ')})`).join('; ')}. ` +
        'Con más de un 10% el reporte se vuelve ignorable.'
    )
  }

  if (score.lintFalsePositives > 0) {
    reasons.push(
      `El lint marcó ${score.lintFalsePositives} caso(s) bueno(s): es un bug de regex, se arregla en ` +
        'lib/qa/lint-questions.ts y no subiendo el umbral.'
    )
  }

  return { passed: reasons.length === 0, reasons }
}

/** Resumen de una línea por métrica, para la consola y para el summary del reporte. */
export function formatScore(score: CalibrationScore): string {
  const pct = (value: number) => `${(value * 100).toFixed(0)}%`
  const lines = [
    `recall real       ${pct(score.recallReal)}  (${score.counts.realBad} caso/s con defecto conocido)`,
    `precisión real    ${pct(score.precisionReal)}  (${score.counts.realGood} caso/s que exigen silencio)`,
  ]

  if (score.counts.syntheticBad + score.counts.syntheticGood > 0) {
    lines.push(
      `recall sintético  ${pct(score.recallSynthetic)}  (${score.counts.syntheticBad} caso/s) — no bloquea`,
      `precisión sint.   ${pct(score.precisionSynthetic)}  (${score.counts.syntheticGood} caso/s) — no bloquea`
    )
  }

  return lines.join('\n')
}
