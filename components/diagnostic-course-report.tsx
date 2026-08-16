'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, Users } from 'lucide-react'
import {
  CHANCE_FLOOR,
  CHANCE_VERDICT_LABEL,
  QUESTION_TYPE_LABEL,
  RELIABLE_QUESTION_TYPES,
  STRATEGY_LABEL,
  accuracy,
  chanceVerdict,
  type ChanceVerdict,
  type Dispersion,
  type ProgramLink,
  type ReliableQuestionType,
  type TeachingStrategy,
  type TypeTally,
} from '@/lib/diagnostic-report'

export interface CourseUnitReport {
  unit: string
  byType: Record<ReliableQuestionType, TypeTally>
  excludedShortAnswers: number
  programLink: ProgramLink
  students: number
  dispersion: Dispersion | null
  strategy: TeachingStrategy
}

export interface CourseDiagnostic {
  date: string
  students: number
  attempts: number
  units: CourseUnitReport[]
  unattributedAttempts: number
  shortAnswerTotal: number
  shortAnswerMarkedWrong: number
}

const VERDICT_CLASS: Record<ChanceVerdict, string> = {
  sobre_azar: 'text-emerald-700 dark:text-emerald-400',
  azar: 'text-amber-700 dark:text-amber-400',
  bajo_azar: 'text-rose-700 dark:text-rose-400',
  sin_piso: 'text-foreground',
  sin_datos: 'text-muted-foreground',
}

const STRATEGY_CLASS: Record<TeachingStrategy, string> = {
  frontal: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
  pares: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  repaso_puntual: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  sin_datos: 'bg-muted text-muted-foreground border-border',
}

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

/**
 * El diagnóstico a nivel curso. Sin red y sin nombres: recibe el reporte ya
 * armado, para poder mirarlo con datos reales sin una sesión de docente.
 */
export function DiagnosticCourseReport({ report }: { report: CourseDiagnostic }) {
  const inProgram = report.units.filter((unit) => unit.programLink.programUnit !== null)
  const outOfProgram = report.units.filter((unit) => unit.programLink.programUnit === null)

  return (
    <div className="space-y-6">
      {/* Lo que NO se puede leer va antes que lo que sí. Un reporte que empieza
          por los números invita a usarlos sin saber qué les falta. */}
      <Card className="p-4 border-2 border-amber-500/30 bg-amber-500/5 rounded-2xl">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs leading-relaxed">
            <p className="font-bold text-sm text-foreground">Qué no dice este reporte</p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">
                Las {report.shortAnswerTotal} respuestas escritas quedaron afuera.
              </strong>{' '}
              {report.shortAnswerMarkedWrong} se guardaron como incorrectas sin que el corrector
              llegara a leerlas, y no hay forma de distinguirlas de un error real. Ningún número de
              acá las usa.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">
                Los porcentajes no son comparables entre sí.
              </strong>{' '}
              Cada tipo tiene su piso de azar: {pct(CHANCE_FLOOR.multiple_choice)} en múltiple
              choice de 4 opciones, {pct(CHANCE_FLOOR.true_false)} en verdadero/falso, 0% en
              numérica. La columna numérica es la única que retrata lo que el curso puede producir.
            </p>
            <p className="text-muted-foreground">
              <strong className="text-foreground">Faltan 5 de las 7 unidades del programa.</strong>{' '}
              El diagnóstico midió el currículum de Secundario 4to, así que no dice nada sobre
              lógica, conjuntos, matrices, límites ni derivadas.
            </p>
            {report.unattributedAttempts > 0 && (
              <p className="text-muted-foreground">
                {report.unattributedAttempts} de {report.attempts} cuestionarios mezclaban temas de
                varias unidades y no se pueden asignar a una sola: quedaron fuera del corte.
              </p>
            )}
          </div>
        </div>
      </Card>

      <UnitSection
        title="Entra en el programa — esto es lo que hay que nivelar"
        units={inProgram}
        highlight
      />
      <UnitSection title="No se dicta en la materia" units={outOfProgram} />
    </div>
  )
}

function UnitSection({
  title,
  units,
  highlight = false,
}: {
  title: string
  units: CourseUnitReport[]
  highlight?: boolean
}) {
  if (units.length === 0) return null

  return (
    <div className="space-y-3">
      <h2
        className={cn(
          'text-xs font-bold uppercase tracking-wide',
          highlight ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {title}
      </h2>

      {units.map((unit) => (
        <Card
          key={unit.unit}
          className={cn(
            'p-4 border-2 rounded-2xl space-y-3',
            highlight ? 'border-primary/30' : 'border-border',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-foreground">{unit.unit}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {unit.programLink.programUnit
                  ? `Prerrequisito de ${unit.programLink.programUnit}. ${unit.programLink.rationale}`
                  : unit.programLink.rationale}
              </p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {unit.students}
            </span>
          </div>

          {/* Por tipo, con el piso al lado. Un 28% junto a "azar 25%" se lee
              solo; un 28% suelto se lee como "flojo pero algo saben". */}
          {/* El piso va dentro de la celda del tipo y no en su propia columna:
              la columna "Lectura" es la que carga el sentido, y en un teléfono
              era justo la que se cortaba. */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold pb-1">Tipo · piso de azar</th>
                <th className="text-right font-semibold pb-1 pr-2">Resp.</th>
                <th className="text-right font-semibold pb-1 pr-2">Acierto</th>
                <th className="text-right font-semibold pb-1">Lectura</th>
              </tr>
            </thead>
            <tbody>
              {RELIABLE_QUESTION_TYPES.map((type) => {
                const tally = unit.byType[type]
                const verdict = chanceVerdict(type, tally)
                return (
                  <tr key={type} className="border-t border-border/60 align-baseline">
                    <td className="py-1.5 pr-2">
                      <span className="text-muted-foreground">{QUESTION_TYPE_LABEL[type]}</span>{' '}
                      <span className="text-[11px] text-muted-foreground/70 tabular-nums whitespace-nowrap">
                        {CHANCE_FLOOR[type] > 0 ? `· ${pct(CHANCE_FLOOR[type])}` : '· sin piso'}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground pr-2">
                      {tally.total}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-foreground pr-2">
                      {pct(accuracy(tally))}
                    </td>
                    <td
                      className={cn(
                        'py-1.5 text-right text-[11px] font-semibold leading-tight',
                        VERDICT_CLASS[verdict],
                      )}
                    >
                      {CHANCE_VERDICT_LABEL[verdict]}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {unit.dispersion && (
            <div className="rounded-xl bg-muted/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Cómo está repartido el curso
                </p>
                <span
                  className={cn(
                    'text-[11px] font-bold px-2 py-0.5 rounded-full border',
                    STRATEGY_CLASS[unit.strategy],
                  )}
                >
                  {STRATEGY_LABEL[unit.strategy]}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                <Stat label="Alumnos" value={String(unit.dispersion.students)} />
                <Stat label="Promedio" value={pct(unit.dispersion.mean)} />
                <Stat label="Desvío" value={pct(unit.dispersion.stdDev)} />
                <Stat label="Mediana" value={pct(unit.dispersion.median)} />
                <Stat label="≥ 60%" value={String(unit.dispersion.atOrAbove60)} />
                <Stat label="< 35%" value={String(unit.dispersion.below35)} />
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Rango: {pct(unit.dispersion.min)} a {pct(unit.dispersion.max)}. Sobre los tres tipos
                confiables juntos, contando a cada alumno una vez.
              </p>
            </div>
          )}

          {unit.excludedShortAnswers > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {unit.excludedShortAnswers} respuestas escritas excluidas en esta unidad.
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-black text-foreground tabular-nums leading-none">{value}</div>
      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  )
}
