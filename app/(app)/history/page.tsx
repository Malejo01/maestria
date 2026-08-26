'use client'

import { Suspense, useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { WeakPointsSection } from '@/components/weak-points-section'
import { DiagnosticReportCard } from '@/components/diagnostic-report-card'
import { CargaFallida } from '@/components/carga-fallida'
import { pedirJson } from '@/lib/pedir-json'
import { computeHistoryStats } from '@/lib/history-stats'
import { DIAGNOSTIC_DATE } from '@/lib/diagnostic-report'
import { useAppStore } from '@/lib/store'
import {
  Calendar,
  Trophy,
  TrendingUp,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lightbulb,
  Calculator,
  Sigma,
  ChartLine as LineChart,
  FlaskConical,
  Atom,
  Ruler,
  Landmark,
  PieChart,
  Target,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUBJECT_COLOR_CLASS } from '@/lib/subject-appearance'
import Link from 'next/link'
import type {
  QuizAttempt,
  TopicMastery,
  AttemptAnswer,
  SubjectColorName,
  SubjectIconName,
  SubjectModeTotals,
  ReinforceTopic,
} from '@/lib/types'

type ModeFilter = 'all' | 'teorico' | 'practico' | 'mixto'

interface SubjectMeta {
  displayName: string
  iconName: SubjectIconName
  colorName: SubjectColorName
  nivel: string | null
  source: 'curriculum' | 'teacher'
}

const SUBJECT_ICON_MAP: Record<SubjectIconName, React.ElementType> = {
  'book-open': BookOpen,
  calculator: Calculator,
  sigma: Sigma,
  'chart-line': LineChart,
  'flask-conical': FlaskConical,
  atom: Atom,
  ruler: Ruler,
  landmark: Landmark,
  'pie-chart': PieChart,
  target: Target,
}

const DEFAULT_SUBJECT_ICON: SubjectIconName = 'book-open'
const DEFAULT_SUBJECT_COLOR: SubjectColorName = 'teal'

/** Formats a saved quiz_answers row's selected/correct value as display text, per question_type. */
function formatAttemptAnswerText(answer: AttemptAnswer, which: 'selected' | 'correct'): string {
  const payload = answer.answer_payload ?? {}
  switch (answer.question_type) {
    case 'true_false': {
      const value = which === 'selected' ? payload.selectedAnswer : payload.correctAnswer
      return value ? 'Verdadero' : 'Falso'
    }
    case 'numeric': {
      const value = which === 'selected' ? payload.selectedValue : payload.correctAnswer
      return String(value)
    }
    case 'short_answer':
      return which === 'selected' ? String(payload.selectedText ?? '') : (Array.isArray(payload.acceptedAnswers) ? payload.acceptedAnswers.join(' / ') : '')
    case 'multiple_choice':
    default: {
      const index = which === 'selected' ? answer.selected_answer : answer.correct_answer
      const options = answer.options ?? []
      if (index === undefined || index === null) return ''
      return `${String.fromCharCode(65 + index)}) ${options[index] ?? ''}`
    }
  }
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <HistoryPageContent />
    </Suspense>
  )
}

function HistoryPageContent() {
  const { status } = useSession()
  const isSignedIn = status === 'authenticated'
  const isLoaded = status !== 'loading'
  const searchParams = useSearchParams()
  const { userProgress } = useAppStore()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [mastery, setMastery] = useState<TopicMastery[]>([])
  // Agregados de las tarjetas: vienen del servidor sobre TODOS los intentos,
  // no de `attempts`, que son las 20 más recientes. Ver `SubjectModeTotals`
  // en lib/types.ts.
  const [totals, setTotals] = useState<SubjectModeTotals[]>([])
  const [reinforce, setReinforce] = useState<ReinforceTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null)
  const [attemptDetails, setAttemptDetails] = useState<Record<string, AttemptAnswer[]>>({})
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null)
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [subjectMeta, setSubjectMeta] = useState<Record<string, SubjectMeta | null>>({})

  const defaultTab = searchParams.get('tab') === 'reforzar' ? 'reforzar' : 'historial'

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const fetchHistory = async () => {
      setHistoryError(null)
      // Un 500 acá se pintaba como historial vacío (§6a de deuda-tecnica.md).
      const res = await pedirJson<{
        attempts?: QuizAttempt[]
        mastery?: TopicMastery[]
        totals?: SubjectModeTotals[]
        reinforce?: ReinforceTopic[]
      }>('/api/quiz/history')
      if ('error' in res) {
        setHistoryError(res.error)
      } else {
        setAttempts(res.data.attempts || [])
        setMastery(res.data.mastery || [])
        setTotals(res.data.totals || [])
        setReinforce(res.data.reinforce || [])
      }
      setLoading(false)
    }

    fetchHistory()
  }, [isLoaded, isSignedIn])

  const uniqueSubjects = useMemo(() => {
    const list = Array.from(new Set(attempts.map((a) => a.subject).filter(Boolean)))
    return ['all', ...list]
  }, [attempts])

  useEffect(() => {
    const allSubjects = Array.from(
      new Set([...attempts.map((a) => a.subject), ...mastery.map((m) => m.subject)].filter(Boolean))
    )
    const pending = allSubjects.filter((s) => !(s in subjectMeta))
    if (pending.length === 0) return

    fetch(`/api/subjects/meta?names=${encodeURIComponent(pending.join(','))}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (data.subjects) {
          setSubjectMeta((prev) => ({ ...prev, ...data.subjects }))
        }
      })
      .catch((error) => console.error('Error fetching subject metadata:', error))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, mastery])

  const getSubjectAppearance = (subject: string) => {
    const meta = subjectMeta[subject]
    const iconName = meta?.iconName ?? DEFAULT_SUBJECT_ICON
    const colorName = meta?.colorName ?? DEFAULT_SUBJECT_COLOR
    return {
      Icon: SUBJECT_ICON_MAP[iconName] ?? BookOpen,
      classes: SUBJECT_COLOR_CLASS[colorName] ?? SUBJECT_COLOR_CLASS[DEFAULT_SUBJECT_COLOR],
    }
  }

  const filteredAttempts = useMemo(() => {
    return attempts.filter((a) => {
      const subjectMatch =
        selectedSubjectFilter === 'all' || a.subject === selectedSubjectFilter
      const modeMatch = modeFilter === 'all' || a.mode === modeFilter
      return subjectMatch && modeMatch
    })
  }, [attempts, selectedSubjectFilter, modeFilter])

  // Stats derived from ALL attempts (no filters)
  /**
   * ¿El alumno rindió algo después del diagnóstico? Decide si el bloque del
   * diagnóstico arranca abierto o colapsado. Se compara sobre `completed_at`
   * recortado a fecha para no depender de la zona horaria del navegador: lo que
   * importa es "otro día", no "otro instante".
   */
  const hasAttemptsAfterDiagnostic = useMemo(
    () =>
      attempts.some(
        (attempt) =>
          typeof attempt.completed_at === 'string' &&
          attempt.completed_at.slice(0, 10) > DIAGNOSTIC_DATE,
      ),
    [attempts]
  )

  /**
   * Los números de las tarjetas de resumen.
   *
   * Tres cosas que antes no hacía y que eran, cada una, una forma de mentir:
   *
   *  1. **Sigue los filtros.** Se calculaba sobre `attempts` mientras la lista
   *     usaba `filteredAttempts`: filtrabas por Álgebra y el promedio seguía
   *     mostrando el de todas las materias.
   *  2. **Cubre todo el historial**, no las últimas 20. `totals` viene agregado
   *     del servidor sin `LIMIT`; `attempts` son sólo las 20 más recientes.
   *  3. **El promedio es `SUM(correctas)/SUM(calificadas)`**, no el promedio de
   *     los promedios de cada intento. Desde la migración 021 cada intento se
   *     puntúa sobre las respuestas que se pudieron corregir, así que promediar
   *     notas es promediar fracciones de denominador distinto. `×10` lo deja en
   *     la misma escala que `scoreOutOfTen`, que es la nota que el alumno ya vio
   *     al terminar cada cuestionario.
   */
  const stats = useMemo(
    () => computeHistoryStats(totals, reinforce, selectedSubjectFilter, modeFilter),
    [totals, reinforce, selectedSubjectFilter, modeFilter]
  )

  /**
   * El promedio sólo se muestra con una materia elegida.
   *
   * Un "6.7" que promedia Ciencias Sociales con Álgebra y con dos Matemáticas
   * distintas no describe ninguna materia: el alumno lo lee como su nota y no
   * lo es. Con el filtro en "todas" la tarjeta directamente no existe y la fila
   * queda en dos columnas.
   */
  const mostrarPromedio = selectedSubjectFilter !== 'all' && stats.promedio !== null

  const handleExpandAttempt = async (attemptId: string) => {
    if (expandedAttempt === attemptId) {
      setExpandedAttempt(null)
      return
    }

    setExpandedAttempt(attemptId)

    if (attemptDetails[attemptId]) return

    setLoadingDetails(attemptId)
    try {
      const response = await fetch(`/api/quiz/attempt/${attemptId}`)
      // Sin esto un 500 guardaba `[]` y el bloque quedaba mudo; con el throw se
      // cae al mensaje honesto de "No se pudieron cargar los detalles".
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setAttemptDetails(prev => ({ ...prev, [attemptId]: data.answers || [] }))
    } catch (error) {
      console.error('Error fetching attempt details:', error)
    } finally {
      setLoadingDetails(null)
    }
  }

  const handleExplainError = async (answer: AttemptAnswer) => {
    if (answer.question_type === 'short_answer') return
    const key = `${answer.id}`
    if (explanations[key]) return

    setLoadingExplanation(key)
    try {
      const response = await fetch('/api/explain-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: answer.question_text,
          questionType: answer.question_type,
          selectedText: formatAttemptAnswerText(answer, 'selected'),
          correctText: formatAttemptAnswerText(answer, 'correct'),
          topic: answer.topic_name
        })
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setExplanations(prev => ({ ...prev, [key]: data.explanation }))
    } catch {
      setExplanations(prev => ({ ...prev, [key]: 'No se pudo cargar la explicacion.' }))
    } finally {
      setLoadingExplanation(null)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Card className="p-8 text-center border-2 bg-card/80 backdrop-blur-sm">
          <h1 className="text-2xl font-bold mb-4">Inicia sesion</h1>
          <p className="text-muted-foreground mb-6">
            Debes iniciar sesion para ver tu historial de evaluaciones.
          </p>
          <Link href="/sign-in">
            <Button className="w-full">Iniciar Sesion</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">Historial y Desempeño</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tus evaluaciones pasadas y los temas que necesitás reforzar.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="reforzar">
            Temas a Reforzar {userProgress.weakPoints.length > 0 && `(${userProgress.weakPoints.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reforzar" className="pt-4">
          {userProgress.weakPoints.length > 0 ? (
            <WeakPointsSection weakPoints={userProgress.weakPoints} variant="full" />
          ) : (
            <Card className="p-8 text-center border-2 border-dashed bg-card/60 backdrop-blur-sm rounded-3xl">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                <Zap className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Sin temas pendientes</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                A medida que practiques, los temas donde tengas más errores van a aparecer acá para que los puedas reforzar.
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historial" className="pt-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : historyError ? (
            <CargaFallida
              que="tu historial"
              detalle={historyError}
              onReintentar={() => window.location.reload()}
            />
          ) : (
            <>
              {/* Arranca abierto sólo mientras el diagnóstico sea lo último que
                  rindió. En cuanto hay algo más nuevo pasa a colapsado: importa
                  esta semana, no en noviembre. */}
              <DiagnosticReportCard defaultOpen={!hasAttemptsAfterDiagnostic} />

              {/* ── Stats row ─────────────────────────────
                  `grid-cols-3` pelado, sin variante responsive: `xs:` NO es un
                  breakpoint de Tailwind 4 y este proyecto no lo define en el
                  @theme de globals.css, así que `xs:grid-cols-3` no emitía
                  ninguna regla y las tres tarjetas caían apiladas a lo ancho en
                  TODOS los tamaños — tres pantallas de scroll antes del
                  historial. Las tarjetas ya son compactas (p-3, ícono de 36px,
                  label de 10px) y entran en una fila hasta en 320px. */}
              <div className={cn('grid gap-3', mostrarPromedio ? 'grid-cols-3' : 'grid-cols-2')}>
                <Card className="p-3 border-2 border-border bg-card/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="w-9 h-9 rounded-xl bg-[var(--algebra-light)] flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-[var(--algebra)]" />
                    </div>
                    <div className="text-xl font-black text-foreground leading-none">{stats.total}</div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">
                      Evaluaciones
                    </div>
                  </div>
                </Card>

                {/* "De práctica" no es un adorno: hoy TODO lo que hay es
                    práctica libre —ningún intento tiene assignment_id— y un
                    "Promedio 6.7" pelado se lee como la nota de la materia. */}
                {mostrarPromedio && (
                  <Card className="p-3 border-2 border-border bg-card/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center text-center gap-1 w-full">
                      <div className="w-9 h-9 rounded-xl bg-[var(--analysis-light)] flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-[var(--analysis)]" />
                      </div>
                      <div className="text-xl font-black text-foreground leading-none">
                        {stats.promedio!.toFixed(1)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">
                        Promedio de práctica
                      </div>
                      {/* Envuelve en vez de truncar: el nombre de la materia
                          es lo que le da sujeto al número, y "Ciencias Socia…"
                          a 375px pierde justo eso. Medido: la fila pasa de 134
                          a 146px sólo cuando el nombre no entra en una línea. */}
                      <div className="text-[10px] text-foreground/70 font-bold leading-tight w-full break-words">
                        {selectedSubjectFilter}
                      </div>
                    </div>
                  </Card>
                )}

                <Card className="p-3 border-2 border-border bg-card/80 backdrop-blur-sm">
                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="w-9 h-9 rounded-xl bg-[var(--probability-light)] flex items-center justify-center">
                      <Target className="w-5 h-5 text-[var(--probability)]" />
                    </div>
                    <div className="text-xl font-black text-foreground leading-none">
                      {stats.temasAReforzar}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide leading-tight">
                      A reforzar
                    </div>
                  </div>
                </Card>
              </div>

              {/* ── Filtros ─────────────────────────────── */}
              <section className="space-y-2">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider px-1">
                  Filtros
                </h2>
                <div className="flex flex-wrap gap-2">
                  {uniqueSubjects.map((s) => {
                    const active = selectedSubjectFilter === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSubjectFilter(s)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                          active
                            ? 'bg-primary text-primary-foreground border-transparent shadow-md'
                            : 'bg-card/80 border-border text-muted-foreground hover:border-primary/40'
                        )}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        {s === 'all' ? 'Todas las materias' : s}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-2">
                  {(['all', 'teorico', 'practico', 'mixto'] as ModeFilter[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModeFilter(m)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all',
                        modeFilter === m
                          ? 'bg-primary text-primary-foreground border-transparent shadow-md'
                          : 'bg-card/80 border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {m === 'all' ? 'Todos los modos' : m === 'teorico' ? 'Teórico' : m === 'practico' ? 'Práctico' : 'Mixto'}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Evaluaciones ────────────────────────── */}
              <section>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Evaluaciones recientes
                  {filteredAttempts.length !== attempts.length && (
                    <span className="text-primary">({filteredAttempts.length})</span>
                  )}
                </h2>

                {filteredAttempts.length === 0 ? (
                  <Card className="p-8 text-center border-2 bg-card/80 backdrop-blur-sm">
                    <p className="text-muted-foreground text-sm">
                      {attempts.length === 0
                        ? 'Aún no completaste ninguna evaluación.'
                        : 'Ninguna evaluación coincide con los filtros.'}
                    </p>
                    {attempts.length === 0 && (
                      <Link href="/">
                        <Button className="mt-4">Empezar a practicar</Button>
                      </Link>
                    )}
                  </Card>
                ) : (
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                    {filteredAttempts.map((attempt) => {
                      const { Icon: SubIcon, classes } = getSubjectAppearance(attempt.subject)
                      const passed = Number(attempt.score) >= 6
                      const isExpanded = expandedAttempt === attempt.id

                      return (
                        <Card
                          key={attempt.id}
                          className={cn('border-2 overflow-hidden bg-card/80 backdrop-blur-sm self-start', classes.border)}
                        >
                          {/* Card header row */}
                          <div
                            className="p-4 cursor-pointer select-none"
                            onClick={() => handleExpandAttempt(attempt.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              {/* Left: icon + info */}
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', classes.iconBg)}>
                                  <SubIcon className={cn('w-5 h-5', classes.text)} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-foreground text-sm truncate">{attempt.subject}</p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span
                                      className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold text-white', classes.chip)}
                                    >
                                      {attempt.mode === 'teorico' ? 'Teórico' : attempt.mode === 'practico' ? 'Práctico' : 'Mixto'}
                                    </span>
                                    <span
                                      className={cn(
                                        'px-2 py-0.5 rounded-full text-[10px] font-bold',
                                        passed
                                          ? 'bg-[var(--analysis-light)] text-[var(--analysis)]'
                                          : 'bg-orange-100 text-orange-600'
                                      )}
                                    >
                                      {passed ? 'Aprobado' : 'Desaprobado'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(attempt.completed_at)}
                                  </div>
                                </div>
                              </div>
                              {/* Right: score + chevron */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-right">
                                  <p className={cn('text-2xl font-black leading-none', classes.text)}>
                                    {Number(attempt.score).toFixed(1)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {attempt.correct_answers}/{attempt.total_questions}
                                  </p>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded answers */}
                          {isExpanded && (
                            <div className="border-t-2 border-border/60 p-4 bg-muted/20 space-y-3">
                              {loadingDetails === attempt.id ? (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                </div>
                              ) : attemptDetails[attempt.id] ? (
                                attemptDetails[attempt.id].map((answer, i) => (
                                  <div
                                    key={answer.id}
                                    className={cn(
                                      'p-3 rounded-xl border-2',
                                      answer.is_correct
                                        ? 'border-[var(--analysis)]/30 bg-[var(--analysis-light)]'
                                        : 'border-destructive/30 bg-destructive/5'
                                    )}
                                  >
                                    <div className="flex items-start gap-2">
                                      {answer.is_correct ? (
                                        <CheckCircle className="w-5 h-5 text-[var(--analysis)] shrink-0 mt-0.5" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                      )}
                                      <div className="flex-1 space-y-2 min-w-0">
                                        <p className="text-sm font-medium">
                                          {i + 1}.{' '}
                                          <LaTeXRenderer content={answer.question_text} />
                                        </p>

                                        {!answer.is_correct && (
                                          <>
                                            <div className="text-xs space-y-1">
                                              <p className="text-destructive">
                                                Tu respuesta:{' '}
                                                <LaTeXRenderer content={formatAttemptAnswerText(answer, 'selected')} />
                                              </p>
                                              <p className="text-[var(--analysis)]">
                                                Correcta:{' '}
                                                <LaTeXRenderer content={formatAttemptAnswerText(answer, 'correct')} />
                                              </p>
                                            </div>

                                            {explanations[answer.id] ? (
                                              <Card className="p-3 border border-[var(--algebra)]/30 bg-[var(--algebra-light)]">
                                                <div className="flex items-start gap-2">
                                                  <Lightbulb className="w-4 h-4 text-[var(--algebra)] shrink-0 mt-0.5" />
                                                  <div className="text-xs text-foreground/80 whitespace-pre-wrap">
                                                    <LaTeXRenderer content={explanations[answer.id]} />
                                                  </div>
                                                </div>
                                              </Card>
                                            ) : answer.question_type === 'short_answer' ? null : (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleExplainError(answer)
                                                }}
                                                disabled={loadingExplanation === answer.id}
                                                className="gap-1 h-7 text-xs"
                                              >
                                                {loadingExplanation === answer.id ? (
                                                  <>
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Cargando...
                                                  </>
                                                ) : (
                                                  <>
                                                    <AlertCircle className="w-3 h-3" />
                                                    Explicar Error
                                                  </>
                                                )}
                                              </Button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-center text-muted-foreground text-sm">
                                  No se pudieron cargar los detalles.
                                </p>
                              )}
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* ── Dominio de Temas ─────────────────────── */}
              {mastery.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Dominio por tema
                  </h2>
                  <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                    {mastery.map((item) => {
                      const { Icon, classes } = getSubjectAppearance(item.subject)

                      return (
                        <Card
                          key={`${item.subject}-${item.topic_id}`}
                          className={cn('p-3 border-2 bg-card/80 backdrop-blur-sm', classes.border)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', classes.iconBg)}>
                              <Icon className={cn('w-4 h-4', classes.text)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{item.topic_name}</p>
                              <p className="text-xs text-muted-foreground">{item.subject}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="flex items-center gap-1">
                                <TrendingUp className={cn('w-4 h-4', classes.text)} />
                                <span className={cn('font-black text-base', classes.text)}>
                                  {Number(item.max_score).toFixed(1)}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {item.attempts_count} intento{item.attempts_count !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
