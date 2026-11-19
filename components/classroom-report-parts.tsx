'use client'

import { formatearNumero } from '@/lib/numeros'

/**
 * Small shared pieces of the seguimiento panel, kept in one place so the aula
 * view and the per-student dialog format marks and accuracy identically.
 */

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatScore(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const parsed = Number(value)
  return Number.isFinite(parsed) ? formatearNumero(parsed, { decimales: 1 }) : '—'
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${Math.round(value * 100)}%`
}

/**
 * Red below 60%, amber below 80%, green above — the same cut the API uses to
 * decide what counts as a weak topic, so the colour and the wording agree.
 */
export function accuracyColorClass(accuracy: number): string {
  if (accuracy < 0.6) return 'bg-flojo'
  if (accuracy < 0.8) return 'bg-flojo'
  return 'bg-logrado'
}

export function AccuracyBar({ accuracy }: { accuracy: number }) {
  const percent = Math.round(accuracy * 100)

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-2 flex-1 rounded bg-muted overflow-hidden"
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percent}% de aciertos`}
      >
        <div className={`h-full ${accuracyColorClass(accuracy)}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-semibold w-9 text-right tabular-nums">{percent}%</span>
    </div>
  )
}
