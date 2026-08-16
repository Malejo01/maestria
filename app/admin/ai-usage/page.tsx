import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getAdminViewer } from '@/lib/auth-session'
import { readAiUsageReport, type GroupedSpendRow } from '@/lib/ai-usage'

/**
 * Vista interna de costo de IA, previa al lanzamiento.
 *
 * Vive fuera del grupo (app) a propósito: no necesita la navbar, ni los guards
 * de onboarding, ni el fondo animado. Es una herramienta para mirar un número
 * antes de invitar usuarios, no una pantalla del producto.
 *
 * Acceso por `ADMIN_EMAILS`. Quien no esté en la lista recibe un 404: si no es
 * para vos, la página no existe.
 *
 * La vuelta es un `<Link>` pelado y no la navbar, justamente para no perder eso:
 * la navbar arrastraría el layout de (app) con sus guards. Hace falta porque
 * estando fuera del grupo no hay ningún otro camino de salida — sin esto, la
 * única forma de volver es editar la barra de direcciones.
 */
export const dynamic = 'force-dynamic'

const money = (value: number) =>
  value.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

const compact = (value: number) => value.toLocaleString('es-AR')

/**
 * `daysAgo` viene de Postgres, no de la posición en el array: un día sin
 * llamadas no genera fila, y contar por índice haría que la primera dijera
 * "Hoy" cuando en realidad es de anteayer.
 */
function dayLabel(day: string, daysAgo: number): string {
  if (daysAgo === 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  return day.slice(5).split('-').reverse().join('/')
}

function Metric({
  label,
  value,
  hint,
  tone = 'normal',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'normal' | 'warn' | 'danger'
}) {
  const toneClass =
    tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-foreground'

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function GroupTable({ title, rows, emptyLabel }: { title: string; rows: GroupedSpendRow[]; emptyLabel: string }) {
  return (
    <section className="rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 text-right font-medium">Llamadas</th>
                <th className="px-4 py-2 text-right font-medium">Tokens in</th>
                <th className="px-4 py-2 text-right font-medium">Tokens out</th>
                <th className="px-4 py-2 text-right font-medium">Errores</th>
                <th className="px-4 py-2 text-right font-medium">Costo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{row.key}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{compact(row.calls)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {compact(row.inputTokens)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {compact(row.outputTokens)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right tabular-nums ${row.errors > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}
                  >
                    {compact(row.errors)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">{money(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default async function AiUsagePage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  const report = await readAiUsageReport()

  const budgetPct = report.budgetUsd > 0 ? (report.spendTodayUsd / report.budgetUsd) * 100 : 0
  const budgetTone = budgetPct >= 100 ? 'danger' : budgetPct >= 70 ? 'warn' : 'normal'

  // Escala del gráfico: relativa al día más caro, no al presupuesto. Con gasto
  // bajo, escalar contra el presupuesto deja todas las barras invisibles.
  const maxDailyCost = Math.max(...report.daily.map((d) => d.costUsd), 0.000001)

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la app
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Costo de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gasto estimado de los últimos 30 días. Los importes salen de los tokens que reporta cada
          llamada por la tarifa de <code className="font-mono text-xs">lib/ai-usage.ts</code> — son una
          estimación, no la factura de Google. Los <em>thinking tokens</em> de los modelos 2.5 se
          facturan como salida y pueden no venir reportados, así que el real tiende a ser algo mayor.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Hoy (24 h)"
          value={money(report.spendTodayUsd)}
          hint={`${budgetPct.toFixed(0)} % de ${money(report.budgetUsd)}`}
          tone={budgetTone}
        />
        <Metric label="Últimos 7 días" value={money(report.spendWeekUsd)} />
        <Metric label="Últimos 30 días" value={money(report.spendMonthUsd)} />
        <Metric
          label="Llamadas hoy"
          value={compact(report.callsToday)}
          hint={report.unpricedCalls > 0 ? `${compact(report.unpricedCalls)} sin costo medido` : undefined}
        />
      </div>

      {budgetPct >= 100 ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Se alcanzó el presupuesto diario: los endpoints de IA están respondiendo 503 hasta que la
          ventana de 24 h se libere. Para levantarlo, subí <code className="font-mono">AI_DAILY_BUDGET_USD</code>.
        </p>
      ) : null}

      <section className="mt-6 rounded-xl border bg-card">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Por día</h2>
        {report.daily.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Todavía no hay llamadas registradas. Aparecen acá apenas alguien genere un cuestionario.
          </p>
        ) : (
          <ul className="divide-y">
            {report.daily.map((day) => (
              <li key={day.day} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {dayLabel(day.day, day.daysAgo)}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-foreground/70"
                    style={{ width: `${Math.max(1, (day.costUsd / maxDailyCost) * 100)}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {compact(day.calls)} ll.
                </span>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {money(day.costUsd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 space-y-6">
        <GroupTable
          title="Por endpoint"
          rows={report.byEndpoint}
          emptyLabel="Sin datos todavía."
        />
        <GroupTable
          title="Por modelo"
          rows={report.byModel}
          emptyLabel="Sin datos todavía."
        />
      </div>
    </main>
  )
}
