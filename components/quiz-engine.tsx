'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { X, ChevronRight, ChevronLeft, Check, Loader2, Pencil, Sparkles, Eye, Zap, AlertCircle, RotateCcw } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { LaTeXRenderer } from './latex-renderer'
import { MathBackground } from './math-background'
import { ExplanationModal } from './explanation-modal'
import { AnswerInput, emptySelectionFor, type AnswerSelection } from './quiz-answer-inputs'
import { AnswerRecap, answerRecapLine } from './answer-recap'
import { isCorrectMultipleChoice, isCorrectNumeric, isCorrectTrueFalse } from '@/lib/answer-grading'
import { gradeShortAnswerLocally } from '@/lib/short-answer-autograde'
import { cn } from '@/lib/utils'
import type { Answer, Question, ShortAnswerQuestion } from '@/lib/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type AnswerState = {
  selection: AnswerSelection
  submitted: boolean
  /**
   * `true`/`false` cuando se corrigió; `null` mientras no se envió **o** cuando
   * la corrección no pudo correr. Para distinguir esos dos `null` está
   * `submitted`: enviada y `isCorrect === null` es "sin calificar".
   */
  isCorrect: boolean | null
}

export function QuizEngine() {
  const { currentQuiz } = useAppStore()
  const { questions, currentIndex } = currentQuiz
  const currentQuestion = questions[currentIndex]

  if (!currentQuestion) {
    return null
  }

  /**
   * Every piece of per-question state (the selection, whether it was already
   * submitted, the AI feedback, the teacher's edit drafts) is seeded from the
   * question it belongs to, so it must not outlive that question. Remounting
   * on each change is what enforces that: `key` resets the state during the
   * same render that first sees the new question.
   *
   * This used to be a `useEffect` keyed on `currentIndex`, which cannot work —
   * effects run *after* their render, so the render that first saw question
   * N+1 still held question N's selection and reached `buildAnswer` with a
   * mismatched pair, throwing "Selection type does not match question type"
   * during render, straight past every handler and into the error boundary.
   * It fired on any type transition, which is why no non-multiple_choice
   * answer ever made it into `quiz_answers`. Both `nextQuestion` and the
   * teacher preview's `previousQuestion` went through it; the remount covers
   * the two by construction. See components/quiz-engine.test.tsx.
   */
  return <QuizQuestionRunner key={`${currentIndex}:${currentQuestion.id}`} question={currentQuestion} />
}

function QuizQuestionRunner({ question: currentQuestion }: { question: Question }) {
  const { currentQuiz, answerQuestion, nextQuestion, previousQuestion, setActiveView, finishQuiz, updateQuestions } = useAppStore()
  const { questions, currentIndex, config } = currentQuiz

  const [answerState, setAnswerState] = useState<AnswerState>({
    selection: emptySelectionFor(currentQuestion),
    submitted: false,
    isCorrect: null
  })
  const [isGradingShortAnswer, setIsGradingShortAnswer] = useState(false)
  const [shortAnswerFeedback, setShortAnswerFeedback] = useState<string | null>(null)
  const [detailedExplanation, setDetailedExplanation] = useState<string | null>(null)
  const [showExplanationModal, setShowExplanationModal] = useState(false)
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false)
  const [isEditingQuestion, setIsEditingQuestion] = useState(false)
  const [questionDraft, setQuestionDraft] = useState('')
  const [optionsDraft, setOptionsDraft] = useState<string[]>([])
  const [correctAnswerDraft, setCorrectAnswerDraft] = useState(0)
  const [explanationDraft, setExplanationDraft] = useState('')
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingAction, setPendingAction] = useState<'exit' | 'next' | 'prev' | 'cancel-edit' | null>(null)

  const isPreviewMode = Boolean(config?.previewOnly)
  const progress = isPreviewMode
    ? ((currentIndex + 1) / questions.length) * 100
    : ((currentIndex + (answerState.submitted ? 1 : 0)) / questions.length) * 100
  const isLastQuestion = currentIndex === questions.length - 1
  const isFirstQuestion = currentIndex === 0

  const requestOrRunAction = useCallback((
    action: 'exit' | 'next' | 'prev' | 'cancel-edit',
    runAction: () => void
  ) => {
    if (isEditingQuestion) {
      setPendingAction(action)
      setShowUnsavedDialog(true)
      return
    }
    runAction()
  }, [isEditingQuestion])

  const applyPendingAction = useCallback((action: 'exit' | 'next' | 'prev' | 'cancel-edit' | null) => {
    setIsEditingQuestion(false)
    if (action === 'exit') {
      setActiveView('dashboard')
    } else if (action === 'next' && !isLastQuestion) {
      nextQuestion()
    } else if (action === 'prev' && !isFirstQuestion) {
      previousQuestion()
    }
  }, [isFirstQuestion, isLastQuestion, nextQuestion, previousQuestion, setActiveView])

  /**
   * Editing invalidates whatever the teacher had already answered here. The
   * question keeps its id through an edit, so this is not covered by the
   * remount in QuizEngine and still has to be done by hand.
   */
  const resetAnswerState = useCallback(() => {
    setAnswerState({ selection: emptySelectionFor(currentQuestion), submitted: false, isCorrect: null })
    setShortAnswerFeedback(null)
    setDetailedExplanation(null)
  }, [currentQuestion])

  const handleStartEditQuestion = useCallback(() => {
    if (!isPreviewMode || currentQuestion.type !== 'multiple_choice') return
    setQuestionDraft(currentQuestion.question)
    setOptionsDraft([...currentQuestion.options])
    setCorrectAnswerDraft(currentQuestion.correctAnswer)
    setExplanationDraft(currentQuestion.explanation ?? '')
    resetAnswerState()
    setIsEditingQuestion(true)
  }, [isPreviewMode, currentQuestion, resetAnswerState])

  const handleSaveEditedQuestion = useCallback(() => {
    if (!isPreviewMode || currentQuestion.type !== 'multiple_choice') return

    const nextQuestions = questions.map((question, index) => (
      index === currentIndex && question.type === 'multiple_choice'
        ? {
            ...question,
            question: questionDraft,
            options: [...optionsDraft],
            correctAnswer: correctAnswerDraft,
            explanation: explanationDraft,
          }
        : question
    ))

    updateQuestions(nextQuestions)
    resetAnswerState()
    setIsEditingQuestion(false)
  }, [
    isPreviewMode, currentQuestion, questions, currentIndex, questionDraft,
    optionsDraft, correctAnswerDraft, explanationDraft, updateQuestions, resetAnswerState,
  ])

  const handleCancelEditQuestion = useCallback(() => {
    requestOrRunAction('cancel-edit', () => setIsEditingQuestion(false))
  }, [requestOrRunAction])

  const handleAnswerChange = useCallback((selection: AnswerSelection) => {
    if (isEditingQuestion) return
    if (answerState.submitted) return
    setAnswerState(prev => ({ ...prev, selection }))
  }, [answerState.submitted, isEditingQuestion])

  /**
   * Builds the typed Answer that gets persisted/recapped, given the current
   * question + selection.
   *
   * `gradingStatus` sólo lo manda `short_answer` cuando la corrección no pudo
   * correr. En ese caso `isCorrect` va en `false` porque el tipo lo exige, pero
   * el que manda es `gradingStatus` — ver el comentario en `BaseAnswer`.
   */
  const buildAnswer = useCallback((
    question: Question,
    selection: AnswerSelection,
    isCorrect: boolean,
    gradingStatus?: 'graded' | 'ungraded',
  ): Answer => {
    const base = {
      questionId: question.id,
      questionText: question.question,
      isCorrect,
      topic: question.topic,
      topicName: question.topicName,
      explanation: question.explanation,
      ...(gradingStatus === 'ungraded' ? { gradingStatus } : {}),
    }
    if (question.type === 'multiple_choice' && selection.type === 'multiple_choice') {
      return { ...base, type: 'multiple_choice', options: question.options, selectedAnswer: selection.value ?? -1, correctAnswer: question.correctAnswer }
    }
    if (question.type === 'true_false' && selection.type === 'true_false') {
      return { ...base, type: 'true_false', selectedAnswer: selection.value ?? false, correctAnswer: question.correctAnswer }
    }
    if (question.type === 'numeric' && selection.type === 'numeric') {
      return { ...base, type: 'numeric', selectedValue: selection.value ?? NaN, correctAnswer: question.correctAnswer, tolerance: question.tolerance }
    }
    if (question.type === 'short_answer' && selection.type === 'short_answer') {
      return { ...base, type: 'short_answer', selectedText: selection.value, acceptedAnswers: question.acceptedAnswers }
    }
    throw new Error('Selection type does not match question type')
  }, [])

  /**
   * Corrección de una respuesta corta, en dos etapas.
   *
   * **Etapa 1, determinista y local.** Si `gradeShortAnswerLocally` resuelve, se
   * termina acá: no se llama a Gemini. Es lo que hace que un "13" idéntico al
   * esperado se corrija bien aunque la API esté caída — el escenario exacto del
   * 2026-08-10, donde el endpoint falló ~224 veces y 15 respuestas correctas
   * quedaron marcadas mal. Como efecto secundario, cada resolución local es una
   * fila menos en `ai_usage_log` y una llamada menos facturada.
   *
   * **Etapa 2, la IA.** Sólo para lo que el determinista no puede afirmar. Y
   * acá está el otro arreglo: un 500 **no lanza** —`fetch` sólo rechaza por
   * fallo de red— así que sin mirar `response.ok` la respuesta de error entraba
   * por el camino feliz, `data.isCorrect` daba `undefined`, `Boolean(undefined)`
   * daba `false` y el alumno quedaba con una respuesta marcada incorrecta y sin
   * un solo aviso de que nadie la había corregido.
   *
   * Lo que no se pudo corregir queda `ungraded`: ni acierto ni error.
   */
  const gradeShortAnswer = useCallback(async (
    question: ShortAnswerQuestion,
    selection: Extract<AnswerSelection, { type: 'short_answer' }>,
  ) => {
    const markUngraded = (mensaje: string) => {
      setShortAnswerFeedback(mensaje)
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect: null }))
      answerQuestion(buildAnswer(question, selection, false, 'ungraded'))
    }

    // ─── Etapa 1: determinista ───────────────────────────────────────────────
    const local = gradeShortAnswerLocally(selection.value, question.acceptedAnswers)
    if (local.resolved) {
      setShortAnswerFeedback(
        local.via === 'numeric'
          ? '¡Correcto! Tu respuesta equivale a la esperada.'
          : '¡Correcto!'
      )
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect: true }))
      answerQuestion(buildAnswer(question, selection, true))
      return
    }

    // ─── Etapa 2: IA ─────────────────────────────────────────────────────────
    setIsGradingShortAnswer(true)
    try {
      const response = await fetch('/api/quiz/grade-short-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.question,
          acceptedAnswers: question.acceptedAnswers,
          studentAnswer: selection.value,
          nivel: config?.nivel,
          grado: config?.grado,
        }),
      })

      // Los mensajes dicen sólo la CAUSA: la consecuencia ("no cuenta como
      // error") la agrega el panel, para no repetirla dos veces en pantalla.
      if (!response.ok) {
        markUngraded('No pudimos corregir esta respuesta.')
        return
      }

      const data = await response.json()

      // Un 200 con un cuerpo que no trae un booleano es tan poco una
      // corrección como un 500. Se exige el tipo en vez de coercionar.
      if (typeof data?.isCorrect !== 'boolean') {
        markUngraded('No pudimos corregir esta respuesta.')
        return
      }

      setShortAnswerFeedback(typeof data.feedback === 'string' ? data.feedback : null)
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect: data.isCorrect }))
      answerQuestion(buildAnswer(question, selection, data.isCorrect))
    } catch {
      markUngraded('No pudimos conectarnos para corregir.')
    } finally {
      setIsGradingShortAnswer(false)
    }
  }, [answerQuestion, buildAnswer, config])

  /** Reintento manual de la corrección, desde el aviso de "sin calificar". */
  const retryShortAnswerGrading = useCallback(async () => {
    if (currentQuestion.type !== 'short_answer') return
    const selection = answerState.selection
    if (selection.type !== 'short_answer') return

    // Volver a "sin enviar" para que el reintento pase por el mismo camino y
    // pueda terminar en cualquiera de los tres estados, no sólo en el actual.
    setAnswerState(prev => ({ ...prev, submitted: false, isCorrect: null }))
    setShortAnswerFeedback(null)
    await gradeShortAnswer(currentQuestion, selection)
  }, [currentQuestion, answerState.selection, gradeShortAnswer])

  const handleSubmit = useCallback(async () => {
    if (isEditingQuestion) return
    const selection = answerState.selection

    if (currentQuestion.type === 'multiple_choice' && selection.type === 'multiple_choice') {
      if (selection.value === null) return
      const isCorrect = isCorrectMultipleChoice(currentQuestion, selection.value)
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect }))
      answerQuestion(buildAnswer(currentQuestion, selection, isCorrect))
      return
    }

    if (currentQuestion.type === 'true_false' && selection.type === 'true_false') {
      if (selection.value === null) return
      const isCorrect = isCorrectTrueFalse(currentQuestion, selection.value)
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect }))
      answerQuestion(buildAnswer(currentQuestion, selection, isCorrect))
      return
    }

    if (currentQuestion.type === 'numeric' && selection.type === 'numeric') {
      if (selection.value === null) return
      const isCorrect = isCorrectNumeric(currentQuestion, selection.value)
      setAnswerState(prev => ({ ...prev, submitted: true, isCorrect }))
      answerQuestion(buildAnswer(currentQuestion, selection, isCorrect))
      return
    }

    if (currentQuestion.type === 'short_answer' && selection.type === 'short_answer') {
      if (selection.value.trim().length === 0) return
      await gradeShortAnswer(currentQuestion, selection)
    }
  }, [answerState.selection, currentQuestion, answerQuestion, isEditingQuestion, buildAnswer, gradeShortAnswer])

  const handleNext = useCallback(() => {
    if (isPreviewMode) {
      requestOrRunAction('next', () => {
        setIsEditingQuestion(false)
        if (!isLastQuestion) {
          nextQuestion()
        }
      })
      return
    }

    setDetailedExplanation(null)
    setShowExplanationModal(false)
    
    if (isLastQuestion) {
      finishQuiz()
      setActiveView('results')
    } else {
      nextQuestion()
      // answerState resets via the useEffect keyed on currentIndex once the store updates.
    }
  }, [isPreviewMode, isLastQuestion, finishQuiz, nextQuestion, requestOrRunAction, setActiveView])

  const handlePrevious = useCallback(() => {
    if (!isPreviewMode || isFirstQuestion) return
    requestOrRunAction('prev', () => {
      setIsEditingQuestion(false)
      previousQuestion()
    })
  }, [isPreviewMode, isFirstQuestion, previousQuestion, requestOrRunAction])

  const [modalInitialMode, setModalInitialMode] = useState<'explain' | 'revancha'>('explain')

  // Revancha and "Explicar mi error" both need a fully-formed Answer to recap —
  // short_answer is excluded from both in this phase (gated at render time).
  const currentAnswer = answerState.submitted
    ? buildAnswer(currentQuestion, answerState.selection, answerState.isCorrect ?? false)
    : null

  const isAnswerReady = (() => {
    const selection = answerState.selection
    switch (selection.type) {
      case 'multiple_choice':
      case 'true_false':
      case 'numeric':
        return selection.value !== null
      case 'short_answer':
        return selection.value.trim().length > 0
    }
  })()

  const handleExplainError = useCallback(async () => {
    if (!currentAnswer || currentQuestion.type === 'short_answer') return
    setModalInitialMode('explain')

    if (detailedExplanation) {
      setShowExplanationModal(true)
      return
    }

    setIsLoadingExplanation(true)

    try {
      const response = await fetch('/api/explain-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion.question,
          questionType: currentQuestion.type,
          selectedText: answerRecapLine(currentAnswer, 'selected'),
          correctText: answerRecapLine(currentAnswer, 'correct'),
          topic: currentQuestion.topicName,
          subject: config?.subjectName,
          pedagogyContext: config?.pedagogyContext,
          nivel: config?.nivel,
          grado: config?.grado,
        })
      })

      const data = await response.json()
      setDetailedExplanation(data.explanation)
      setShowExplanationModal(true)

      // Auto-save tip to student's tips chest / misconceptions.
      // Never from the teacher preview — it would file the tip under the
      // teacher's own account as if they had got the question wrong.
      if (!isPreviewMode && data.tipText && config?.subjectName && currentQuestion.topicName) {
        fetch('/api/user/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: config.subjectName,
            topicId: currentQuestion.topic,
            topicName: currentQuestion.topicName,
            misconceptionType: data.misconceptionType || 'Confusión conceptual',
            tip: data.tipText,
          }),
        }).catch((err) => console.warn('Could not auto-save tip:', err))
      }
    } catch {
      setDetailedExplanation('No se pudo cargar la explicación. Por favor intentá de nuevo.')
      setShowExplanationModal(true)
    } finally {
      setIsLoadingExplanation(false)
    }
  }, [currentQuestion, currentAnswer, config, detailedExplanation, isPreviewMode])

  const handleExit = useCallback(() => {
    if (isPreviewMode) {
      requestOrRunAction('exit', () => {
        setIsEditingQuestion(false)
        setActiveView('dashboard')
      })
      return
    }

    if (confirm('¿Seguro que querés salir? Perderás tu progreso actual.')) {
      setActiveView('dashboard')
    }
  }, [isPreviewMode, requestOrRunAction, setActiveView])

  return (
    <div className="min-h-screen relative flex flex-col">
      <MathBackground />

      {/* Teacher Preview Banner */}
      {isPreviewMode && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold z-30 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">Modo Vista Previa (Docente) — Estás simulando la experiencia del alumno.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExit}
            className="h-8 px-3 rounded-lg border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 text-xs font-bold shrink-0"
          >
            Volver al Editor
          </Button>
        </div>
      )}

      {/* Header with Progress */}
      <header className="sticky top-0 z-20 bg-card/95 backdrop-blur-xl border-b-2 border-border shadow-sm">
        <div className="px-4 py-3 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExit}
            className="shrink-0 rounded-xl hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <Progress value={progress} className="h-3 bg-muted [&>div]:bg-gradient-to-r [&>div]:from-[var(--algebra)] [&>div]:to-[var(--analysis)]" />
          </div>
          <div className="shrink-0 bg-[var(--algebra-light)] text-[var(--algebra)] px-3 py-1 rounded-full text-sm font-bold">
            {currentIndex + 1}/{questions.length}
          </div>
        </div>
        <div className="px-4 pb-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isPreviewMode
              ? `Previsualizacion - ${currentQuestion.topicName}`
              : `${config?.mode === 'teorico' ? 'Modo Teorico' : config?.mode === 'practico' ? 'Modo Practico' : 'Modo Mixto'} - ${currentQuestion.topicName}`}
          </span>
        </div>
      </header>

      {/* Question Content */}
      {/* El padding inferior reserva la barra de acción (~88px) más el botón
          de reporte que ahora se apoya encima (h-12 + separación), más el
          safe-area: si no, la última opción de la pregunta termina abajo de
          uno de los dos cuando el contenido llega al final del scroll. */}
      <main className="flex-1 px-4 py-6 pb-[calc(11rem_+_env(safe-area-inset-bottom))] overflow-y-auto">
        <div className="space-y-5">
          {/* Question */}
          <Card className="p-6 border-2 border-border bg-card/90 backdrop-blur-sm shadow-lg">
            <div className="space-y-4">
              {isPreviewMode && currentQuestion.type === 'multiple_choice' && (
                <div className="flex flex-wrap gap-2">
                  {!isEditingQuestion ? (
                    <Button type="button" variant="outline" onClick={handleStartEditQuestion}>
                      Editar Pregunta
                    </Button>
                  ) : (
                    <>
                      <Button type="button" onClick={handleSaveEditedQuestion}>Guardar</Button>
                      <Button type="button" variant="outline" onClick={handleCancelEditQuestion}>Salir sin guardar</Button>
                    </>
                  )}
                </div>
              )}

              {!isEditingQuestion ? (
                <h2 className="text-xl font-bold text-foreground leading-relaxed">
                  <LaTeXRenderer content={currentQuestion.question} />
                </h2>
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Pregunta / Enunciado</span>
                    <textarea
                      className="w-full min-h-28 border rounded-lg p-3 bg-background text-sm"
                      value={questionDraft}
                      onChange={(event) => setQuestionDraft(event.target.value)}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Editá el texto de cada opción abajo y tocá su letra para marcar cuál es la correcta.
                  </p>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">Explicación</span>
                    <textarea
                      className="w-full min-h-20 border rounded-lg p-3 bg-background text-sm"
                      value={explanationDraft}
                      onChange={(event) => setExplanationDraft(event.target.value)}
                      placeholder="Qué se le muestra al alumno después de responder."
                    />
                  </label>
                </div>
              )}
            </div>
          </Card>

          {/* Answer input */}
          <AnswerInput
            question={currentQuestion}
            selection={answerState.selection}
            submitted={answerState.submitted}
            onChange={handleAnswerChange}
            isCorrect={answerState.submitted ? answerState.isCorrect : undefined}
            editing={isEditingQuestion && currentQuestion.type === 'multiple_choice'}
            editedOptions={optionsDraft}
            editedCorrectAnswer={correctAnswerDraft}
            onEditCorrectAnswer={setCorrectAnswerDraft}
            onEditOption={(index, value) => {
              setOptionsDraft((prev) => {
                const next = [...prev]
                next[index] = value
                return next
              })
            }}
          />

          {isGradingShortAnswer && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              Corrigiendo con IA...
            </div>
          )}

          {/* Feedback after answer - correct */}
          {answerState.submitted && answerState.isCorrect && (
            <Card className="p-5 border-2 border-[var(--analysis)] bg-[var(--analysis-light)] animate-in fade-in-50 slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--analysis)] flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--analysis)] mb-1">Correcto!</h3>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    <LaTeXRenderer content={currentQuestion.explanation} />
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Feedback after answer - sin calificar.
              Va ANTES del panel de incorrecta y es un estado propio: ni verde ni
              rojo. `isCorrect === null` con `submitted` en true significa que la
              corrección no pudo correr, no que el alumno se haya equivocado. */}
          {answerState.submitted && answerState.isCorrect === null && (
            <Card className="p-4 sm:p-5 border-2 border-amber-400/40 bg-amber-50/60 animate-in fade-in-50 slide-in-from-bottom-4 space-y-4 max-w-full overflow-hidden min-w-0">
              <div className="flex items-start gap-3 min-w-0 max-w-full overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0 space-y-3 max-w-full overflow-hidden">
                  <h3 className="font-bold text-amber-700 text-lg">Sin calificar</h3>

                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {shortAnswerFeedback ?? 'No pudimos corregir esta respuesta.'}{' '}
                    <strong>No cuenta como error en tu nota.</strong>
                  </p>

                  {/* La respuesta esperada igual se muestra: que la corrección
                      haya fallado no es razón para que el alumno se quede sin
                      saber cuál era. */}
                  <div className="text-sm text-foreground/80 leading-relaxed pt-1 break-words min-w-0 max-w-full overflow-hidden">
                    <LaTeXRenderer content={currentQuestion.explanation} />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={retryShortAnswerGrading}
                    disabled={isGradingShortAnswer}
                    className="h-11 rounded-xl border-amber-500/50 text-amber-700 hover:bg-amber-100 font-bold gap-2"
                  >
                    {isGradingShortAnswer
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <RotateCcw className="w-4 h-4" />}
                    Reintentar la corrección
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Feedback after answer - incorrect */}
          {answerState.submitted && answerState.isCorrect === false && (
            <Card className="p-4 sm:p-5 border-2 border-destructive/30 bg-destructive/5 animate-in fade-in-50 slide-in-from-bottom-4 space-y-4 max-w-full overflow-hidden min-w-0">
              <div className="flex items-start gap-3 min-w-0 max-w-full overflow-hidden">
                <div className="w-10 h-10 rounded-xl bg-destructive flex items-center justify-center shrink-0">
                  <X className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
                <div className="flex-1 min-w-0 space-y-3 max-w-full overflow-hidden">
                  <h3 className="font-bold text-destructive text-lg">Respuesta Incorrecta</h3>

                  {currentAnswer && <AnswerRecap answer={currentAnswer} />}

                  {currentQuestion.type === 'short_answer' && shortAnswerFeedback && (
                    <div className="text-sm text-foreground/80 leading-relaxed pt-1 break-words min-w-0 max-w-full overflow-hidden">
                      <LaTeXRenderer content={shortAnswerFeedback} />
                    </div>
                  )}

                  <div className="text-sm text-foreground/80 leading-relaxed pt-1 break-words min-w-0 max-w-full overflow-hidden">
                    <LaTeXRenderer content={currentQuestion.explanation} />
                  </div>

                  {/* Acciones directas post-error — Revancha y "Explicar con IA" están
                      disponibles para multiple_choice/true_false/numeric; short_answer
                      ya recibió feedback de IA en la corrección misma. */}
                  {currentQuestion.type !== 'short_answer' && (
                    <div className="pt-2 flex flex-col sm:flex-row gap-2.5 w-full min-w-0 max-w-full">
                      {currentQuestion.type === 'multiple_choice' && (
                        <Button
                          type="button"
                          onClick={() => {
                            setModalInitialMode('revancha')
                            setShowExplanationModal(true)
                          }}
                          className="w-full sm:flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs gap-1.5 shadow-md hover:from-amber-600 hover:to-orange-600 active:scale-95 whitespace-normal leading-tight px-3"
                        >
                          <Zap className="w-4 h-4 fill-white shrink-0" />
                          <span>⚡ ¡Tomarme la Revancha ahora!</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleExplainError}
                        disabled={isLoadingExplanation}
                        className="w-full sm:flex-1 h-12 rounded-xl border-2 border-primary/40 bg-background text-primary font-bold text-xs gap-1.5 hover:bg-primary/10 whitespace-normal leading-tight px-3"
                      >
                        <Sparkles className="w-4 h-4 text-primary shrink-0" />
                        <span>Explicar mi error con la IA</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>

      {/* Fixed Action Button */}
      {/* `data-quiz-action-bar` es el enganche que usa
          components/feedback-button.tsx para medir esta barra y apoyarse
          encima en vez de flotar sobre "Siguiente" — no lo saques sin leer el
          comentario de cabecera de ese archivo.

          El padding inferior lleva env(safe-area-inset-bottom) porque un `p-4`
          seco no sabe nada de la barra de gestos: en un teléfono moderno los
          botones quedaban pegados a la barrita de "home", que se come el
          toque. */}
      <div
        data-quiz-action-bar=""
        className="fixed bottom-0 left-0 right-0 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] bg-card/95 backdrop-blur-xl border-t-2 border-border z-20"
      >
        <div className={cn(isPreviewMode ? 'flex flex-col gap-2.5' : 'flex gap-2.5')}>
          {isPreviewMode ? (
            <>
              {/* The teacher answers for real here, but can also just skim:
                  "Verificar" only shows while the question is unanswered, and
                  Anterior/Siguiente stay available either way. */}
              {!answerState.submitted && (
                <Button
                  onClick={handleSubmit}
                  disabled={!isAnswerReady || isGradingShortAnswer || isEditingQuestion}
                  className={cn(
                    'h-14 w-full text-base font-bold rounded-2xl shadow-lg transition-all',
                    'bg-gradient-to-r from-[var(--algebra)] to-[var(--algebra)]/80',
                    'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
                    'disabled:opacity-50 disabled:shadow-none disabled:scale-100'
                  )}
                >
                  {isGradingShortAnswer ? (
                    <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Corrigiendo...</span>
                  ) : (
                    'Verificar'
                  )}
                </Button>
              )}
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={isFirstQuestion}
                  className="flex-1 h-14 rounded-2xl border-2 font-bold gap-2"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Anterior
                </Button>
                {isLastQuestion ? (
                  <Button
                    onClick={handleExit}
                    className="flex-1 h-14 text-base font-bold gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
                  >
                    <Pencil className="w-5 h-5 shrink-0" />
                    <span className="truncate">Volver al editor</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-14 text-lg font-bold gap-2 rounded-2xl"
                  >
                    Siguiente
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
          {answerState.submitted && answerState.isCorrect === false && (
            <>
              {currentQuestion.type === 'multiple_choice' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setModalInitialMode('revancha')
                    setShowExplanationModal(true)
                  }}
                  className="flex-1 h-14 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs sm:text-sm gap-1.5 hover:bg-amber-500/20 transition-all"
                >
                  <Zap className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
                  <span className="truncate">⚡ Revancha</span>
                </Button>
              )}

              {currentQuestion.type !== 'short_answer' && (
                <Button
                  variant="outline"
                  onClick={handleExplainError}
                  disabled={isLoadingExplanation}
                  className="flex-1 h-14 rounded-2xl border-2 border-primary/30 font-bold text-primary text-xs sm:text-sm gap-1.5 hover:bg-primary/10 transition-all"
                >
                  {isLoadingExplanation ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                      <span className="truncate">Analizando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">Explicar con IA</span>
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {!answerState.submitted ? (
            <Button
              onClick={handleSubmit}
              disabled={!isAnswerReady || isGradingShortAnswer}
              className={cn(
                'flex-1 h-14 text-base font-bold rounded-2xl shadow-lg transition-all',
                'bg-gradient-to-r from-[var(--algebra)] to-[var(--algebra)]/80',
                'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
                'disabled:opacity-50 disabled:shadow-none disabled:scale-100'
              )}
            >
              {isGradingShortAnswer ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Corrigiendo...</span>
              ) : (
                'Verificar'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className={cn(
                'flex-1 h-14 text-xs sm:text-sm font-bold gap-1.5 rounded-2xl shadow-lg transition-all',
                'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]',
                answerState.isCorrect 
                  ? 'bg-gradient-to-r from-[var(--analysis)] to-[var(--analysis)]/80 shadow-[var(--analysis)]/30' 
                  : 'bg-gradient-to-r from-[var(--algebra)] to-[var(--algebra)]/80'
              )}
            >
              <span className="truncate">{isLastQuestion ? 'Ver Resultados' : 'Siguiente'}</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </Button>
          )}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios de esta pregunta no fueron guardados. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingAction(null)
                setShowUnsavedDialog(false)
              }}
            >
              No
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingAction
                setPendingAction(null)
                setShowUnsavedDialog(false)
                applyPendingAction(action)
              }}
            >
              Si
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showExplanationModal && currentAnswer && (
        <ExplanationModal
          open={showExplanationModal}
          onClose={() => setShowExplanationModal(false)}
          question={currentQuestion.question}
          userAnswer={answerRecapLine(currentAnswer, 'selected')}
          correctAnswer={answerRecapLine(currentAnswer, 'correct')}
          explanation={detailedExplanation || currentQuestion.explanation}
          topic={currentQuestion.topic}
          topicName={currentQuestion.topicName}
          subject={config?.subjectName}
          nivel={config?.nivel}
          grado={config?.grado}
          initialMode={modalInitialMode}
          allowRevancha={currentQuestion.type === 'multiple_choice'}
        />
      )}
    </div>
  )
}
