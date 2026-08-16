/**
 * Forma y serialización del reporte de un agente de contenido.
 *
 * El shape base es el acordado (`persona`, `timestamp`, `findings`, `summary`).
 * Todo lo demás es aditivo y existe para que el orquestador de backlog pueda
 * agregar sin adivinar: `dimensionsEvaluated` distingue "la dimensión pasó" de
 * "no aplicaba", y `evidence` distingue un verde sobre un caso real del examen
 * del 10/08 de un verde sobre un caso que escribimos nosotros.
 *
 * La procedencia también se escribe DENTRO de `summary`, no sólo en los
 * metadatos. Un campo se ignora; una primera línea en el resumen, no. A los dos
 * meses, mirando un verde de la persona de Historia, hay que ver ahí mismo que
 * esa evidencia es fabricada.
 */
import { compareSeverity, type Dimension, type EvidenceBasis, type Finding, type LlmDimension } from '@/lib/qa/rubric'

export type ReportKind = 'run' | 'calibration'

export interface QaReport {
  // ── shape acordado ────────────────────────────────────────────────────────
  persona: string
  timestamp: string
  findings: Finding[]
  summary: string

  // ── aditivos ──────────────────────────────────────────────────────────────
  kind: ReportKind
  /** Modelo evaluador. Nunca es el mismo que genera: ese es el punto del diseño. */
  model: string
  effort: string
  questionCount: number
  /** Las que se le pidieron al modelo. La ausencia de findings en una dimensión
   *  que NO está acá significa "no aplicaba", no "pasó". */
  dimensionsEvaluated: LlmDimension[]
  evidence: EvidenceBasis
  evidenceCounts: { real: number; synthetic: number }
  /** Clave de la caché de generación, o null cuando las preguntas no se generaron. */
  generationCacheKey: string | null
  costUsd: number
  /** Findings del modelo que apuntaban a preguntas inexistentes. >0 es señal de desalineación. */
  droppedFindings: number
}

export interface BuildReportInput {
  persona: string
  kind: ReportKind
  findings: Finding[]
  summary: string
  model: string
  effort: string
  questionCount: number
  dimensionsEvaluated: LlmDimension[]
  evidenceCounts: { real: number; synthetic: number }
  generationCacheKey?: string | null
  costUsd?: number
  droppedFindings?: number
  now?: Date
}

/** Orden de lectura: primero lo que rompe, y dentro de eso por número de pregunta. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = compareSeverity(a.severity, b.severity)
    if (bySeverity !== 0) return bySeverity
    if (a.questionIndex !== b.questionIndex) return a.questionIndex - b.questionIndex
    return a.dimension.localeCompare(b.dimension)
  })
}

export function evidenceBasis(counts: { real: number; synthetic: number }): EvidenceBasis {
  if (counts.real === 0 && counts.synthetic === 0) return 'generated'
  if (counts.synthetic > 0 && counts.real > 0) return 'mixed'
  if (counts.synthetic > 0) return 'synthetic'
  return 'real'
}

/**
 * Antepone la advertencia de procedencia al resumen del modelo.
 *
 * Deliberadamente en la primera línea y en mayúsculas: quien lee un reporte lee
 * el summary, y tiene que tropezarse con la advertencia antes que con la
 * conclusión.
 */
export function withProvenance(summary: string, counts: { real: number; synthetic: number }): string {
  const basis = evidenceBasis(counts)
  const trimmed = summary.trim()

  if (basis === 'synthetic') {
    return (
      `⚠ EVIDENCIA SINTÉTICA — los ${counts.synthetic} casos de este reporte los escribimos nosotros ` +
      `con el defecto inyectado a propósito. Este resultado mide qué tan bien redactamos el defecto, ` +
      `no qué tan bueno es el agente contra contenido real.\n\n${trimmed}`
    )
  }

  if (basis === 'mixed') {
    return (
      `⚠ EVIDENCIA MIXTA — ${counts.real} caso(s) real(es) del diagnóstico y ${counts.synthetic} ` +
      `sintético(s). Sólo los reales sostienen una conclusión sobre el agente.\n\n${trimmed}`
    )
  }

  return trimmed
}

export function buildReport(input: BuildReportInput): QaReport {
  const counts = input.evidenceCounts

  return {
    persona: input.persona,
    timestamp: (input.now ?? new Date()).toISOString(),
    findings: sortFindings(input.findings),
    summary: withProvenance(input.summary, counts),
    kind: input.kind,
    model: input.model,
    effort: input.effort,
    questionCount: input.questionCount,
    dimensionsEvaluated: [...input.dimensionsEvaluated],
    evidence: evidenceBasis(counts),
    evidenceCounts: { ...counts },
    generationCacheKey: input.generationCacheKey ?? null,
    costUsd: input.costUsd ?? 0,
    droppedFindings: input.droppedFindings ?? 0,
  }
}

/** Conteo por severidad, para el resumen de consola y para el agregado del backlog. */
export function countBySeverity(findings: Finding[]): Record<string, number> {
  return findings.reduce<Record<string, number>>((counts, finding) => {
    counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
    return counts
  }, {})
}

/** Conteo por dimensión, incluyendo en cero las evaluadas sin hallazgos. */
export function countByDimension(
  findings: Finding[],
  dimensionsEvaluated: readonly LlmDimension[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const dimension of dimensionsEvaluated) counts[dimension] = 0
  for (const finding of findings) {
    counts[finding.dimension] = (counts[finding.dimension] ?? 0) + 1
  }
  return counts
}

/** `YYYY-MM-DD` en UTC. Sin locale: el nombre de archivo tiene que ser estable entre máquinas. */
export function reportDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * Ruta relativa del reporte, con fecha. Un directorio por día y un archivo por
 * persona: dos corridas del mismo día y la misma persona se pisan a propósito
 * — lo que interesa conservar es el último estado, y el histórico ya vive en
 * git para los fixtures y en el backlog para los hallazgos.
 */
export function reportPath(persona: string, kind: ReportKind, now: Date = new Date()): string {
  const prefix = kind === 'calibration' ? 'calibration-' : ''
  return `qa-reports/${reportDate(now)}/${prefix}${persona}.json`
}

export function serializeReport(report: QaReport): string {
  return `${JSON.stringify(report, null, 2)}\n`
}

/** Dimensiones con hallazgos, para el log de consola. */
export function affectedDimensions(findings: Finding[]): Dimension[] {
  return [...new Set(findings.map((finding) => finding.dimension))].sort()
}
