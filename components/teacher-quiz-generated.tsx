'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { exportQuizToMoodleGift } from '@/lib/moodle-export'
import { MathBackground } from '@/components/math-background'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { Navbar } from './navbar'
import {
  Save, PlayCircle, Trash2, ChevronDown, ChevronUp,
  ArrowLeft, Loader2, CheckCircle, GraduationCap, Pencil,
  BookOpen, ArrowRight, Sparkles,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { normalizeQuestions } from '@/lib/normalize-questions'
import type { Question } from '@/lib/types'
import type { CurriculumSelection } from './curriculum-selector'
import { useToast } from '@/hooks/use-toast'

interface TeacherQuizGeneratedProps {
  questions: Question[]
  selection: CurriculumSelection
  onBack: () => void
  onGoToSavedQuizzes?: () => void
}

export function TeacherQuizGenerated({ questions: initialQuestions, selection, onBack, onGoToSavedQuizzes }: TeacherQuizGeneratedProps) {
  const { data: session } = useSession()
  const startQuizPreview = useAppStore((state) => state.startQuizPreview)
  const activeView = useAppStore((state) => state.activeView)
  const { toast } = useToast()

  const [questions, setQuestions] = useState<Question[]>(() => {
    const seen = new Set<string>()
    return normalizeQuestions(initialQuestions).map((q, idx) => {
      let uniqueId = q.id || `q-${idx}`
      if (seen.has(uniqueId)) {
        uniqueId = `${uniqueId}-${idx}`
      }
      seen.add(uniqueId)
      return { ...q, id: uniqueId }
    })
  })
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showMoodleModal, setShowMoodleModal] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQuestionText, setEditQuestionText] = useState('')
  const [editOptions, setEditOptions] = useState<string[]>([])
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<number>(0)
  const [editExplanation, setEditExplanation] = useState('')

  // The preview edits the copy that lives in the store, not this local state.
  // Without adopting it back when the preview closes, every change the teacher
  // made in there was silently thrown away — including on save.
  const wasPreviewingRef = useRef(false)
  useEffect(() => {
    if (activeView === 'quiz') {
      wasPreviewingRef.current = true
      return
    }
    if (!wasPreviewingRef.current) return
    wasPreviewingRef.current = false

    const { config, questions: previewed } = useAppStore.getState().currentQuiz
    if (config?.previewOnly && previewed.length > 0) {
      setQuestions(previewed)
    }
  }, [activeView])

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }, [])

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id))

  // Inline editing is multiple_choice only for now — other types render
  // read-only in the expanded view (see the questions list below).
  const startEditing = (q: Question) => {
    if (q.type !== 'multiple_choice') return
    setEditingId(q.id)
    setEditQuestionText(q.question)
    setEditOptions([...q.options])
    setEditCorrectAnswer(q.correctAnswer)
    setEditExplanation(q.explanation || '')
  }

  const saveQuestionEdit = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id && q.type === 'multiple_choice'
          ? {
              ...q,
              question: editQuestionText,
              options: editOptions,
              correctAnswer: editCorrectAnswer,
              explanation: editExplanation,
            }
          : q
      )
    )
    setEditingId(null)
  }

  const cancelQuestionEdit = () => {
    setEditingId(null)
  }

  // ── Export to Moodle GIFT ──────────────────────────────────────────────────
  const handleExportMoodle = () => {
    // Build a TeacherQuiz-compatible shape from the current questions + metadata
    const quizForExport = {
      id: 0,
      userId: session?.user?.id ?? '',
      teacherProgramId: 0,
      title: `${selection.materia} - ${selection.grado}`,
      subjectName: selection.materia,
      mode: selection.mode,
      status: 'saved' as const,
      selectedTopics: selection.selectedTopics.map((t) => ({ id: t.id, name: t.name })),
      questionCount: questions.length,
      questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const gift = exportQuizToMoodleGift(quizForExport)
    const blob = new Blob([gift], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selection.materia.replace(/\s+/g, '_')}_moodle.gift.txt`
    a.click()
    URL.revokeObjectURL(url)
    setShowMoodleModal(true)
  }

  // ── Save quiz to DB ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      // Ensure a teacher program exists for this subject (creates one if needed)
      const programRes = await fetch('/api/teacher/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: selection.materia,
          iconName: 'book-open',
          colorName: 'teal',
          units: Object.entries(
            selection.selectedTopics.reduce<Record<string, string[]>>((acc, t) => {
              if (!acc[t.eje]) acc[t.eje] = []
              acc[t.eje].push(t.name)
              return acc
            }, {})
          ).map(([eje, temas]) => ({
            id: eje, name: eje,
            topics: temas.map((n) => ({ id: n, name: n })),
          })),
          pedagogyProfile: {
            level: selection.nivel,
            degree: selection.grado,
            academicYear: selection.grado,
            complexity: selection.difficulty,
            assessmentStyle: selection.mode,
            methodology: 'Generado desde Currícula Oficial',
          },
        }),
      })
      const programData = await programRes.json()
      const programId = programData?.program?.id
      if (!programId) throw new Error(programData?.error ?? 'No se pudo crear el programa')

      const quizRes = await fetch('/api/teacher/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherProgramId: programId,
          title: `${selection.materia} · ${selection.grado} · ${new Date().toLocaleDateString('es-AR')}`,
          subjectName: selection.materia,
          mode: selection.mode,
          status: 'saved',
          selectedTopics: selection.selectedTopics.map((t) => ({ id: t.id, name: t.name })),
          questionCount: questions.length,
          questions,
          pedagogyContext: `Nivel: ${selection.nivel} | Dificultad: ${selection.difficulty}`,
        }),
      })
      if (!quizRes.ok) {
        const d = await quizRes.json()
        throw new Error(d?.error ?? 'Error al guardar')
      }
      setSaved(true)
      toast({
        title: 'Cuestionario guardado',
        description: 'El cuestionario ha sido guardado correctamente en tu panel.',
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      setSaveError(errMsg)
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: `No se pudo guardar el cuestionario: ${errMsg}. Por favor, intentá de nuevo.`,
      })
    } finally {
      setSaving(false)
    }
  }

  // ── Send to quiz engine (preview mode) ────────────────────────────────────
  const handlePreviewAsAlumno = () => {
    startQuizPreview(
      {
        subject: selection.materia,
        subjectName: selection.materia,
        nivel: selection.nivel,
        grado: selection.grado,
        topics: selection.selectedTopics.map((t) => ({ id: t.id, name: t.name })),
        mode: selection.mode,
        questionCount: questions.length,
      },
      questions,
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      <MathBackground />
      <Navbar />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-0.5">Cuestionario generado</p>
            <h1 className="text-xl font-bold text-foreground">{selection.materia}</h1>
            <p className="text-sm text-muted-foreground">{selection.grado} · {selection.nivel} · {questions.length} preguntas · {selection.mode}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
        </div>

        {/* Action toolbar (Column Layout) */}
        <div className="flex flex-col gap-3.5 mb-8">
          {/* Card 1: Save */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group',
                saved
                  ? 'border-emerald-500/40 bg-emerald-500/5 text-foreground'
                  : 'border-border/80 bg-card hover:border-primary/50 hover:bg-primary/5 shadow-sm'
              )}
            >
              <div className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105',
                saved ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'
              )}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <Save className="w-5 h-5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-foreground">
                  {saved ? 'Guardado en tu panel' : 'Guardar en mi panel'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {saved ? 'El cuestionario ya se guardó y está listo en tus materias.' : 'Almacená este cuestionario para asignarlo, editarlo o consultarlo más tarde.'}
                </p>
              </div>
            </button>

            {saved && onGoToSavedQuizzes && (
              <button
                onClick={onGoToSavedQuizzes}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                <BookOpen className="w-4 h-4" />
                <span>Ver mis cuestionarios guardados</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>

          {/* Card 2: Moodle */}
          <button
            onClick={handleExportMoodle}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/80 bg-card hover:border-orange-500/50 hover:bg-orange-500/5 shadow-sm transition-all text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none" className="shrink-0">
                <rect width="48" height="48" rx="10" fill="#f98012"/>
                <path d="M10 32V20c0-4.4 3.6-8 8-8h4c2.2 0 4 1.8 4 4s-1.8 4-4 4h-4v12H10z" fill="white"/>
                <path d="M28 32V20h4c2.2 0 4 1.8 4 4v8h-4v-8h-4z" fill="white"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground">Exportar para Moodle (GIFT)</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Descargá el cuestionario en formato GIFT para importarlo directamente en tu aula virtual Moodle.
              </p>
            </div>
          </button>

          {/* Card 3: Preview */}
          <button
            onClick={handlePreviewAsAlumno}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/80 bg-card hover:border-violet-500/50 hover:bg-violet-500/5 shadow-sm transition-all text-left group"
          >
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 text-violet-600 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground">Vista previa interactiva</h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Visualizá y respondé las preguntas tal como las experimentarán tus alumnos.
              </p>
            </div>
          </button>
        </div>

        {saveError && <p className="text-xs text-destructive mb-4">{saveError}</p>}

        {/* Questions list */}
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="border border-border rounded-2xl overflow-hidden bg-card">
              {/* Question header */}
              <div
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(q.id)}
                  className="flex-1 flex items-start gap-3 text-left focus:outline-none"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-foreground leading-snug">
                    <LaTeXRenderer content={q.question} />
                  </span>
                </button>
                <div className="flex items-center gap-2 flex-shrink-0 self-center">
                  {q.type === 'multiple_choice' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedId !== q.id) setExpandedId(q.id)
                        startEditing(q)
                      }}
                      className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                      aria-label="Editar pregunta"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Eliminar pregunta"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(q.id)}
                    className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    aria-label={expandedId === q.id ? "Contraer" : "Expandir"}
                  >
                    {expandedId === q.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              {/* Expanded options or editor */}
              {expandedId === q.id && (
                editingId === q.id ? (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
                    {/* Question statement edit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Pregunta / Enunciado:</label>
                      <textarea
                        value={editQuestionText}
                        onChange={(e) => setEditQuestionText(e.target.value)}
                        className="w-full min-h-[80px] px-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Escribe la pregunta..."
                      />
                    </div>

                    {/* Options edit */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Opciones y respuesta correcta:</label>
                      {editOptions.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-3">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={editCorrectAnswer === oi}
                            onChange={() => setEditCorrectAnswer(oi)}
                            className="w-4 h-4 text-primary focus:ring-primary flex-shrink-0 cursor-pointer"
                          />
                          <span className="font-bold text-sm flex-shrink-0">{String.fromCharCode(65 + oi)}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...editOptions]
                              newOpts[oi] = e.target.value
                              setEditOptions(newOpts)
                            }}
                            className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Explanation edit */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Explicación (opcional):</label>
                      <textarea
                        value={editExplanation}
                        onChange={(e) => setEditExplanation(e.target.value)}
                        className="w-full min-h-[60px] px-3 py-1.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Escribe la explicación..."
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={cancelQuestionEdit}
                        className="px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-secondary transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveQuestionEdit(q.id)}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-2">
                    {q.type === 'multiple_choice' && q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={cn(
                          'flex items-start gap-2 px-3 py-2 rounded-xl text-sm',
                          oi === q.correctAnswer
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-secondary/40 text-muted-foreground'
                        )}
                      >
                        <span className="font-bold flex-shrink-0">{String.fromCharCode(65 + oi)}.</span>
                        <LaTeXRenderer content={opt} />
                      </div>
                    ))}
                    {q.type === 'true_false' && (
                      <div className="px-3 py-2 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                        Respuesta correcta: {q.correctAnswer ? 'Verdadero' : 'Falso'}
                      </div>
                    )}
                    {q.type === 'numeric' && (
                      <div className="px-3 py-2 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                        Respuesta correcta: {q.correctAnswer}{q.tolerance ? ` (± ${q.tolerance})` : ''}
                      </div>
                    )}
                    {q.type === 'short_answer' && (
                      <div className="px-3 py-2 rounded-xl text-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                        Respuestas aceptadas: {q.acceptedAnswers.join(' / ')}
                      </div>
                    )}
                    {q.explanation && (
                      <div className="mt-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">Explicación: </span>
                        <LaTeXRenderer content={q.explanation} />
                      </div>
                    )}
                    {q.type === 'multiple_choice' && (
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => startEditing(q)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar pregunta
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>

        {questions.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Todas las preguntas fueron eliminadas.
          </div>
        )}

        {/* Moodle GIFT Import Guide Modal */}
        <Dialog open={showMoodleModal} onOpenChange={setShowMoodleModal}>
          <DialogContent className="sm:max-w-md rounded-3xl border-2 border-orange-500/30 p-6 bg-card">
            <DialogHeader className="space-y-3 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/15 text-orange-600 flex items-center justify-center mx-auto sm:mx-0">
                <Sparkles className="w-6 h-6 text-orange-500" />
              </div>
              <DialogTitle className="text-xl font-bold text-foreground leading-snug">
                ¡Qué genial! 🚀 Tu cuestionario se descargó con éxito
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed pt-1">
                El archivo ha sido generado en <strong className="text-foreground font-semibold">formato GIFT</strong> (<code className="text-xs bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-mono">.gift.txt</code>). Podés subirlo directamente a tu aula virtual Moodle para evaluarlo con tus alumnos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-4 border-y border-border/60 my-2">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Paso a paso para importar en Moodle:
              </p>

              <div className="flex items-start gap-3 text-xs text-foreground">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold flex items-center justify-center shrink-0">1</span>
                <p className="pt-0.5 leading-relaxed">
                  Ingresá a tu curso en Moodle y abrí la sección <strong>Banco de preguntas</strong> en el menú de administración del curso.
                </p>
              </div>

              <div className="flex items-start gap-3 text-xs text-foreground">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold flex items-center justify-center shrink-0">2</span>
                <p className="pt-0.5 leading-relaxed">
                  Hacé click en la pestaña <strong>Importar</strong> y seleccioná la opción <strong>Formato GIFT</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3 text-xs text-foreground">
                <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-700 dark:text-orange-300 font-bold flex items-center justify-center shrink-0">3</span>
                <p className="pt-0.5 leading-relaxed">
                  Arrastrá el archivo descargado (<code className="text-[11px] bg-muted px-1 rounded">.gift.txt</code>), hacé click en <strong>Importar</strong> y ¡listo! ✨
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2 sm:justify-end">
              <button
                onClick={() => setShowMoodleModal(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                ¡Entendido, a enseñar!
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
