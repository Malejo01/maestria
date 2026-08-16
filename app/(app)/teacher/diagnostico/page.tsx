'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  DiagnosticCourseReport,
  type CourseDiagnostic,
} from '@/components/diagnostic-course-report'

/**
 * El diagnóstico del 10/08 leído a nivel curso.
 *
 * Página propia y no una pestaña del seguimiento de un aula: el diagnóstico no
 * se tomó dentro de ninguna (los 84 intentos tienen `classroom_id` en NULL), y
 * colgarlo de un aula obligaría a inventar una pertenencia que no existió.
 */
export default function DiagnosticoPage() {
  const [report, setReport] = useState<CourseDiagnostic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/teacher/diagnostic-report')
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!ok) setError(data?.error ?? 'No se pudo cargar el reporte.')
        else setReport(data.report)
      })
      .catch(() => setError('No pudimos conectarnos. Probá de nuevo en un momento.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/teacher"
          className="text-xs font-bold text-primary inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
        </Link>
        <h1 className="text-2xl font-black text-foreground mt-2">
          Diagnóstico del 10 de agosto de 2026
        </h1>
        {report && (
          <p className="text-sm text-muted-foreground mt-1">
            {report.students} alumnos · {report.attempts} cuestionarios. Sin nombres: esto es para
            planificar el curso.
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && (error || !report) && (
        <Card className="p-8 text-center border-2 rounded-2xl">
          <p className="text-sm text-muted-foreground">{error ?? 'Sin datos.'}</p>
        </Card>
      )}

      {!loading && report && <DiagnosticCourseReport report={report} />}
    </div>
  )
}
