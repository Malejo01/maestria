'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { pedirJson } from '@/lib/pedir-json'
import { cn } from '@/lib/utils'
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Loader2 } from 'lucide-react'
import {
  CHANCE_FLOOR,
  QUESTION_TYPE_LABEL,
  RELIABLE_QUESTION_TYPES,
  type ReliableQuestionType,
  type TypeTally,
} from '@/lib/diagnostic-report'

interface ProgramLink {
  programUnit: string | null
  rationale: string
}

interface UnitReport {
  unit: string
  byType: Record<ReliableQuestionType, TypeTally>
  excludedShortAnswers: number
  programLink: ProgramLink
}

export interface StudentDiagnostic {
  date: string
  attempts: number
  units: UnitReport[]
  unattributedAnswers: number
  shortAnswerTotal: number
}

function formatDate(iso: string): string {
  // Se parte a mano en vez de `new Date(iso)`: un 'YYYY-MM-DD' se interpreta
  // como UTC y en Argentina (UTC-3) se mostraría el día anterior.
  const [year, month, day] = iso.split('-').map(Number)
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${day} de ${meses[month - 1]} de ${year}`
}

/**
 * Fila de un tipo de pregunta.
 *
 * Muestra el conteo crudo ("4 de 6") y no sólo un porcentaje, y al lado cuántas
 * habría acertado el azar. Con seis preguntas un "67%" suena a nota; "4 de 6, y
 * tirando la moneda salían 3" es lo que ese número realmente significa.
 *
 * Deliberadamente NO usa `chanceVerdict`: el test de significancia necesita un
 * n que un alumno individual no tiene. Ahí el piso se muestra como referencia
 * para que lo lea la persona, no como veredicto del sistema.
 */
function TypeRow({ type, tally }: { type: ReliableQuestionType; tally: TypeTally }) {
  if (tally.total === 0) return null

  const floor = CHANCE_FLOOR[type]
  const byChance = Math.round(floor * tally.total)

  return (
    <div className="flex items-baseline justify-between gap-3 text-sm py-1">
      <span className="text-muted-foreground">{QUESTION_TYPE_LABEL[type]}</span>
      <span className="flex items-baseline gap-2 shrink-0">
        <span className="font-bold text-foreground tabular-nums">
          {tally.correct} de {tally.total}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {floor > 0 ? `azar ≈ ${byChance}` : 'sin azar posible'}
        </span>
      </span>
    </div>
  )
}

/**
 * Resultado del alumno en el diagnóstico del 10/08.
 *
 * `defaultOpen` en false cuando el alumno ya rindió cosas más nuevas: el
 * diagnóstico importa mucho la semana que viene y nada en noviembre, y no tiene
 * por qué seguir siendo lo primero que ve para siempre.
 */
export function DiagnosticReportCard({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [report, setReport] = useState<StudentDiagnostic | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    let alive = true

    // "No rendiste el diagnóstico" (report null, el bloque no se dibuja) y
    // "falló la consulta" son estados distintos: el primero es silencio
    // legítimo, el segundo tiene que verse (§6a de deuda-tecnica.md).
    pedirJson<{ report?: StudentDiagnostic | null }>('/api/student/diagnostic-report')
      .then((res) => {
        if (!alive) return
        if ('error' in res) setLoadError(res.error)
        else setReport(res.data.report ?? null)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="p-4 border-2 border-border/80 rounded-2xl flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Buscando tu diagnóstico…</span>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="p-4 border-2 border-destructive/30 rounded-2xl text-sm text-muted-foreground">
        No pudimos cargar tu reporte del diagnóstico ({loadError}). Recargá la página para
        reintentar.
      </Card>
    )
  }

  // El alumno no rindió ese día: no hay nada que contarle.
  if (!report) return null

  return <DiagnosticReportView report={report} open={open} onToggle={() => setOpen((v) => !v)} />
}

/**
 * La vista, sin acceso a red. Separada del contenedor para poder mirarla con
 * datos reales sin depender de una sesión iniciada — el reporte lo ven alumnos
 * concretos y no hay forma de autenticarse como uno de ellos para revisarlo.
 */
export function DiagnosticReportView({
  report,
  open,
  onToggle,
}: {
  report: StudentDiagnostic
  open: boolean
  onToggle: () => void
}) {
  const inProgram = report.units.filter((unit) => unit.programLink.programUnit !== null)
  const outOfProgram = report.units.filter((unit) => unit.programLink.programUnit === null)

  return (
    <Card className="border-2 border-primary/30 bg-card rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-foreground text-sm">
            Tu diagnóstico del {formatDate(report.date)}
          </h3>
          <p className="text-xs text-muted-foreground font-medium">
            {report.units.length} tema{report.units.length === 1 ? '' : 's'} ·{' '}
            {report.attempts} cuestionario{report.attempts === 1 ? '' : 's'}
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* No se esconde: quince alumnos respondieron bien y el sistema los
              reprobó. Merecen leerlo antes que cualquier número. */}
          {report.shortAnswerTotal > 0 && (
            <div className="flex gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Hubo un problema técnico con las preguntas de respuesta escrita
                </p>
                <p className="text-amber-900/80 dark:text-amber-200/80 mt-1">
                  Ese día, un error nuestro hizo que el corrector automático no llegara a
                  revisar las respuestas escritas y quedaran marcadas como incorrectas sin
                  haber sido leídas. Te tocaron {report.shortAnswerTotal} de esas preguntas y{' '}
                  <strong>no están contadas acá</strong>: si respondiste bien, el sistema no lo
                  registró, y no es tu error. Lo de abajo sólo usa las preguntas que sí se
                  corrigieron bien.
                </p>
              </div>
            </div>
          )}

          <UnitList
            title="Entra en el programa de la materia"
            subtitle="Esto es lo que conviene repasar."
            units={inProgram}
            highlight
          />

          <UnitList
            title="No se va a dictar en la materia"
            subtitle="Te lo mostramos para que sepas de dónde salió, pero no tenés que preocuparte por estos números."
            units={outOfProgram}
          />

          {report.unattributedAnswers > 0 && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Otras {report.unattributedAnswers} respuestas tuyas fueron de cuestionarios que
              mezclaban temas de varias unidades, así que no se pueden asignar a una sola y
              quedaron fuera de este corte.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function UnitList({
  title,
  subtitle,
  units,
  highlight = false,
}: {
  title: string
  subtitle: string
  units: UnitReport[]
  highlight?: boolean
}) {
  if (units.length === 0) return null

  return (
    <div className="space-y-2">
      <div>
        <h4
          className={cn(
            'text-xs font-bold uppercase tracking-wide',
            highlight ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {title}
        </h4>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>

      {units.map((unit) => (
        <div
          key={unit.unit}
          className={cn(
            'p-3 rounded-xl border',
            highlight ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30',
          )}
        >
          <p className="font-bold text-sm text-foreground">{unit.unit}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {unit.programLink.programUnit
              ? `Prepara: ${unit.programLink.programUnit}`
              : unit.programLink.rationale}
          </p>

          <div className="mt-2 divide-y divide-border/60">
            {RELIABLE_QUESTION_TYPES.map((type) => (
              <TypeRow key={type} type={type} tally={unit.byType[type]} />
            ))}
          </div>

          {unit.excludedShortAnswers > 0 && (
            <p className="text-[11px] text-muted-foreground mt-2">
              + {unit.excludedShortAnswers} de respuesta escrita, sin contar por el problema
              técnico.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
