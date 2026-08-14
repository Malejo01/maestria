'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { StreakBadge } from './streak-badge'
import { MathBackground } from './math-background'
import { LaTeXRenderer } from './latex-renderer'
import { Home, RotateCcw, TrendingUp, TrendingDown, Sparkles, XCircle, CheckCircle, ChevronDown, ChevronUp, AlertCircle, Loader2, Lightbulb, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import confetti from 'canvas-confetti'
import type { Answer } from '@/lib/types'
import { countsAsCorrect, countsAsIncorrect, isGraded, scoreOutOfTen, tallyAnswers } from '@/lib/answer-grading'
import { QuizModeDialog } from './quiz-mode-dialog'
import { ExplanationModal } from './explanation-modal'
import { answerRecapLine } from './answer-recap'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function ResultsScreen() {
  const { currentQuiz, userProgress, resetQuiz, setActiveView, startQuiz } = useAppStore()
  const { answers, questions, config } = currentQuiz
  const [showCorrect, setShowCorrect] = useState(false)
  const [showIncorrect, setShowIncorrect] = useState(false)
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [isRetrying, setIsRetrying] = useState(false)
  const [showRetryModal, setShowRetryModal] = useState(false)
  const { data: session, status } = useSession()
  const isSignedIn = status === 'authenticated'
  const isAlumno = session?.user?.role === 'ALUMNO'
  const hasSavedRef = useRef(false)
  const router = useRouter()

  const results = useMemo(() => {
    // Mismo criterio que `finishQuiz`: lo que no se pudo corregir no cuenta
    // como error. La nota sale sobre `tally.graded`, no sobre la cantidad de
    // preguntas — ver lib/answer-grading.ts.
    const correctAnswers = answers.filter(countsAsCorrect)
    const incorrectAnswers = answers.filter(countsAsIncorrect)
    const ungradedAnswers = answers.filter(a => !isGraded(a))
    const tally = tallyAnswers(answers)
    const correct = tally.correct
    const total = questions.length
    const score = scoreOutOfTen(tally) ?? 0
    const percentage = tally.graded === 0 ? 0 : (correct / tally.graded) * 100
    const passed = tally.graded > 0 && score >= 6

    return {
      correct,
      total,
      score,
      percentage,
      passed,
      correctAnswers,
      incorrectAnswers,
      ungradedAnswers,
      /** Denominador real de la nota. Distinto de `total` si algo quedó sin calificar. */
      graded: tally.graded,
    }
  }, [answers, questions])

  // Save quiz result to database
  useEffect(() => {
    // Guests have no NextAuth session but do carry a signed aula cookie, so a
    // quiz run inside an aula still saves — the API validates the identity.
    const isAulaQuiz = Boolean(config?.classroomId || config?.assignmentId)
    // A teacher trying out their own quiz is not an attempt worth recording.
    if (config?.previewOnly) return
    if ((!isSignedIn && !isAulaQuiz) || hasSavedRef.current || !config || answers.length === 0) return

    hasSavedRef.current = true

    const saveResult = async () => {
      try {
        await fetch('/api/quiz/save-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: config.subjectName,
            mode: config.mode,
            topics: config.topics,
            totalQuestions: questions.length,
            correctAnswers: results.correct,
            // El server necesita las tres cifras por separado: con sólo
            // `total - correct` volvería a contar las sin calificar como
            // errores, que es el bug que estamos sacando.
            ungradedAnswers: results.ungradedAnswers.length,
            score: results.score,
            classroomId: config.classroomId ?? null,
            assignmentId: config.assignmentId ?? null,
            answers: answers.map(a => ({
              ...a,
              explanation: a.explanation || '',
              topicName: a.topicName || ''
            }))
          })
        })
      } catch (error) {
        console.error('Error saving quiz result:', error)
      }
    }
    
    saveResult()
  }, [isSignedIn, config, answers, questions.length, results.correct, results.score])

  // Trigger confetti on passing
  useEffect(() => {
    if (results.passed) {
      const duration = 3000
      const end = Date.now() + duration

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#6366f1', '#22c55e', '#f59e0b']
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#6366f1', '#22c55e', '#f59e0b']
        })

        if (Date.now() < end) {
          requestAnimationFrame(frame)
        }
      }
      frame()
    }
  }, [results.passed])

  const [selectedModalAnswer, setSelectedModalAnswer] = useState<Answer | null>(null)
  const [selectedModalExplanation, setSelectedModalExplanation] = useState<string>('')
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false)

  const handleExplainError = useCallback(async (answer: Answer) => {
    if (answer.type === 'short_answer') return
    setSelectedModalAnswer(answer)
    setIsExplanationModalOpen(true)

    if (explanations[answer.questionId]) {
      setSelectedModalExplanation(explanations[answer.questionId])
      return
    }

    setLoadingExplanation(answer.questionId)

    try {
      const response = await fetch('/api/explain-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: answer.questionText,
          questionType: answer.type,
          selectedText: answerRecapLine(answer, 'selected'),
          correctText: answerRecapLine(answer, 'correct'),
          topic: answer.topicName,
          subject: config?.subjectName,
          pedagogyContext: config?.pedagogyContext,
          nivel: config?.nivel,
          grado: config?.grado,
        })
      })

      const data = await response.json()
      setExplanations(prev => ({ ...prev, [answer.questionId]: data.explanation }))
      setSelectedModalExplanation(data.explanation)

      if (data.tipText && config?.subjectName) {
        fetch('/api/user/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: config.subjectName,
            topicId: answer.topic,
            topicName: answer.topicName,
            misconceptionType: data.misconceptionType || 'Confusión conceptual',
            tip: data.tipText,
          }),
        }).catch((err) => console.warn('Could not auto-save tip:', err))
      }
    } catch {
      setSelectedModalExplanation('No se pudo cargar la explicación. Por favor intenta de nuevo.')
    } finally {
      setLoadingExplanation(null)
    }
  }, [explanations, config])

  const handleRetry = useCallback(async (mode: 'teorico' | 'practico' | 'mixto') => {
    if (!config) return
    
    setIsRetrying(true)
    setShowRetryModal(false)
    setActiveView('loading')
    
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: config.subjectName,
          nivel: config.nivel,
          grado: config.grado,
          difficulty: config.difficulty,
          topics: config.topics,
          mode,
          questionCount: config.questionCount,
          previousQuestions: questions.map((question) => ({
            id: question.id,
            question: question.question,
            topic: question.topic,
            topicName: question.topicName
          }))
        })
      })
      
      const data = await response.json()
      
      if (data.questions && data.questions.length === config.questionCount) {
        startQuiz({ ...config, mode }, data.questions)
      } else {
        setActiveView('results')
      }
    } catch {
      setActiveView('results')
    } finally {
      setIsRetrying(false)
    }
  }, [config, questions, setActiveView, startQuiz])

  const handleGoHome = () => {
    resetQuiz()
  }

  const handleGoToHistory = () => {
    resetQuiz()
    router.push('/history')
  }

  const isPrimario = config?.nivel === 'Primario'

  // Header emotional feedback helper
  const getEmotionalHeader = () => {
    if (results.score < 6) {
      return {
        badgeText: 'A seguir practicando',
        title: isPrimario ? '¡A no desanimarse! 💡' : '¡Sigue practicando!',
        subtitle: isPrimario ? 'Cada error es una oportunidad para aprender. ¡Mirá tus recomendaciones abajo!' : 'Repasá los temas fallados para mejorar tu rendimiento.',
        badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30',
        emojiIcon: '💡',
      }
    }
    if (results.score < 9) {
      return {
        badgeText: '¡Buen trabajo!',
        title: isPrimario ? '¡Muy bien hecho! 🌟' : '¡Buen trabajo!',
        subtitle: isPrimario ? '¡Estás aprendiendo muchísimo! Mirá los detalles para perfeccionarlo.' : '¡Gran avance en la materia!',
        badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
        emojiIcon: '🌟',
      }
    }
    return {
      badgeText: '¡Excelente!',
      title: isPrimario ? '¡ESPECTACULAR! 🚀' : '¡Excelente trabajo!',
      subtitle: isPrimario ? '¡Sos un/a genio/a! Dominaste este cuestionario por completo.' : '¡Rendimiento sobresaliente!',
      badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30',
      emojiIcon: '🚀',
    }
  }

  const emotionalInfo = getEmotionalHeader()

  return (
    <div className="min-h-screen relative">
      <MathBackground />
      
      {/* Header */}
      <header className="px-4 py-8 text-center relative z-10 space-y-2">
        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs shadow-sm',
          emotionalInfo.badgeClass
        )}>
          <span>{emotionalInfo.emojiIcon}</span>
          <span>{emotionalInfo.badgeText}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-foreground">
          {emotionalInfo.title}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto font-medium leading-relaxed">
          {emotionalInfo.subtitle}
        </p>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] space-y-5 relative z-10">
        {/* Score Card */}
        <Card className={cn(
          'p-6 text-center border-2 overflow-hidden relative rounded-3xl shadow-xl',
          results.passed 
            ? 'border-[var(--analysis)]/30 bg-gradient-to-br from-[var(--analysis-light)] to-white' 
            : 'border-orange-200 bg-gradient-to-br from-orange-50 to-white'
        )}>
          {results.passed && (
            <>
              <Sparkles className="absolute top-4 left-4 w-6 h-6 text-[var(--analysis)]/40" />
              <Sparkles className="absolute top-8 right-6 w-4 h-4 text-[var(--analysis)]/30" />
            </>
          )}
          
          <div className="relative">
            <div className={cn(
              'w-36 h-36 mx-auto rounded-3xl flex items-center justify-center',
              'border-4 shadow-xl',
              results.passed 
                ? 'border-[var(--analysis)] bg-white shadow-[var(--analysis)]/30' 
                : 'border-orange-400 bg-white shadow-orange-400/30'
            )}>
              <div>
                <span className={cn(
                  'text-5xl font-black',
                  results.passed ? 'text-[var(--analysis)]' : 'text-orange-500'
                )}>
                  {results.score.toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground font-bold">/10</span>
              </div>
            </div>

            <div className={cn(
              'absolute -top-2 right-1/4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg',
              results.passed 
                ? 'bg-gradient-to-br from-[var(--analysis)] to-emerald-400 shadow-[var(--analysis)]/40' 
                : 'bg-gradient-to-br from-orange-400 to-red-400 shadow-orange-400/40'
            )}>
              {results.passed ? (
                <TrendingUp className="w-6 h-6 text-white" />
              ) : (
                <TrendingDown className="w-6 h-6 text-white" />
              )}
            </div>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-xl font-bold text-foreground">
              {results.correct} de {results.total} correctas
            </p>
            <p className="text-sm text-muted-foreground font-medium">
              {Math.round(results.percentage)}% de aciertos
            </p>
          </div>
        </Card>

        {/* Streak Card */}
        <Card className="p-5 border-2 border-border bg-card/90 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Tu Racha</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {userProgress.streak >= 2 
                  ? 'Racha activa - sigue asi!' 
                  : userProgress.streak === 1
                    ? 'Una mas para activar la racha'
                    : 'Aprueba 2 seguidos para activar'}
              </p>
            </div>
            <StreakBadge streak={userProgress.streak} size="lg" />
          </div>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className={cn(
              'p-4 border-2 cursor-pointer transition-all',
              showCorrect 
                ? 'border-[var(--analysis)] bg-[var(--analysis-light)] shadow-lg' 
                : 'border-[var(--analysis)]/30 bg-[var(--analysis-light)]/50 hover:bg-[var(--analysis-light)]'
            )}
            onClick={() => { setShowCorrect(!showCorrect); setShowIncorrect(false) }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[var(--analysis)] flex items-center justify-center mb-2">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black text-[var(--analysis)]">{results.correct}</span>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Correctas</span>
              <div className="flex items-center gap-1 mt-2 text-[var(--analysis)]">
                <span className="text-xs font-semibold">Ver</span>
                {showCorrect ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </Card>
          <Card 
            className={cn(
              'p-4 border-2 cursor-pointer transition-all',
              showIncorrect 
                ? 'border-destructive bg-destructive/10 shadow-lg' 
                : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
            )}
            onClick={() => { setShowIncorrect(!showIncorrect); setShowCorrect(false) }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-destructive flex items-center justify-center mb-2">
                <XCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black text-destructive">{results.total - results.correct}</span>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Incorrectas</span>
              <div className="flex items-center gap-1 mt-2 text-destructive">
                <span className="text-xs font-semibold">Ver</span>
                {showIncorrect ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </Card>
        </div>

        {/* Correct Answers List */}
        {showCorrect && results.correctAnswers.length > 0 && (
          <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-4">
            <h3 className="font-bold text-foreground flex items-center gap-2 px-1">
              <CheckCircle className="w-5 h-5 text-[var(--analysis)]" />
              Respuestas Correctas
            </h3>
            {results.correctAnswers.map((answer, i) => (
              <Card key={answer.questionId} className="p-4 border-2 border-[var(--analysis)]/30 bg-[var(--analysis-light)]">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[var(--analysis)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        <LaTeXRenderer content={answer.questionText} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tema: {answer.topicName}
                      </p>
                    </div>
                  </div>
                  <div className="ml-8 p-2 bg-white rounded-lg border border-[var(--analysis)]/20">
                    <p className="text-sm text-[var(--analysis)] font-semibold">
                      <LaTeXRenderer content={answerRecapLine(answer, 'correct')} />
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Incorrect Answers List */}
        {showIncorrect && results.incorrectAnswers.length > 0 && (
          <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-4">
            <h3 className="font-bold text-foreground flex items-center gap-2 px-1">
              <XCircle className="w-5 h-5 text-destructive" />
              Respuestas Incorrectas
            </h3>
            {results.incorrectAnswers.map((answer, i) => (
              <Card key={answer.questionId} className="p-4 border-2 border-destructive/30 bg-destructive/5">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-destructive text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        <LaTeXRenderer content={answer.questionText} />
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Tema: {answer.topicName}
                      </p>
                    </div>
                  </div>
                  
                  <div className="ml-8 space-y-2">
                    <div className="p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                      <p className="text-sm text-destructive font-semibold">
                        Tu respuesta: <LaTeXRenderer content={answerRecapLine(answer, 'selected')} />
                      </p>
                    </div>
                    <div className="p-2 bg-[var(--analysis-light)] rounded-lg border border-[var(--analysis)]/20">
                      <p className="text-sm text-[var(--analysis)] font-semibold">
                        Correcta: <LaTeXRenderer content={answerRecapLine(answer, 'correct')} />
                      </p>
                    </div>
                  </div>

                  {/* Explanation */}
                  {explanations[answer.questionId] && (
                    <Card className="ml-8 p-4 border-2 border-[var(--algebra)]/30 bg-[var(--algebra-light)]">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-5 h-5 text-[var(--algebra)] shrink-0 mt-0.5" />
                        <div className="text-sm text-foreground/80 whitespace-pre-wrap">
                          <LaTeXRenderer content={explanations[answer.questionId]} />
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Explain Error Button */}
                  {!explanations[answer.questionId] && answer.type !== 'short_answer' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExplainError(answer)}
                      disabled={loadingExplanation === answer.questionId}
                      className="ml-8 gap-2 border-2"
                    >
                      {loadingExplanation === answer.questionId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          Explicar Error
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Fixed Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-card/95 backdrop-blur-xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
        <div className="max-w-md mx-auto space-y-2.5">
          {!results.passed && (
            <Button
              onClick={() => handleRetry('practico')}
              disabled={isRetrying}
              className="w-full h-13 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-sm gap-2 shadow-lg active:scale-95 transition-all"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin fill-white" />
                  <span>Generando Revancha...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5 text-white" />
                  <span>⚡ ¡Tomar Revancha de todo el Cuestionario!</span>
                </>
              )}
            </Button>
          )}

          <div className="flex gap-2.5">
            {results.passed && (
              <Button
                variant="outline"
                onClick={() => setShowRetryModal(true)}
                disabled={isRetrying}
                className="flex-1 h-13 gap-2 rounded-2xl border-2 font-bold text-xs sm:text-sm"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Volver a intentar</span>
                  </>
                )}
              </Button>
            )}

            {isAlumno && (
              <Button
                variant="outline"
                onClick={handleGoToHistory}
                className="flex-1 h-13 gap-2 rounded-2xl border-2 font-bold text-primary border-primary/30 text-xs sm:text-sm hover:bg-primary/5"
              >
                <History className="w-4 h-4" />
                <span>Historial</span>
              </Button>
            )}

            <Button
              onClick={handleGoHome}
              className={cn(
                'flex-1 h-13 gap-2 rounded-2xl font-bold shadow-lg text-sm text-white',
                'bg-gradient-to-r from-[var(--algebra)] to-[var(--analysis)]',
                'hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all'
              )}
            >
              <Home className="w-4 h-4" />
              <span>Continuar</span>
            </Button>
          </div>
        </div>
      </div>

      <QuizModeDialog
        open={showRetryModal}
        onOpenChange={setShowRetryModal}
        onSelectMode={handleRetry}
        isLoading={isRetrying}
        title="Reintentar cuestionario"
        description="Selecciona si quieres regenerar este cuestionario en modo teorico, practico o mixto con los mismos temas."
        showQuestionCountSelector={false}
      />

      {isExplanationModalOpen && selectedModalAnswer && (
        <ExplanationModal
          open={isExplanationModalOpen}
          onClose={() => setIsExplanationModalOpen(false)}
          question={selectedModalAnswer.questionText}
          userAnswer={answerRecapLine(selectedModalAnswer, 'selected')}
          correctAnswer={answerRecapLine(selectedModalAnswer, 'correct')}
          explanation={selectedModalExplanation || 'Cargando explicación con IA...'}
          topic={selectedModalAnswer.topic}
          topicName={selectedModalAnswer.topicName}
          subject={config?.subjectName}
          nivel={config?.nivel}
          grado={config?.grado}
          allowRevancha={selectedModalAnswer.type === 'multiple_choice'}
        />
      )}
    </div>
  )
}
