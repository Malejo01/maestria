'use client'

import { Cargando } from '@/components/sistema/cargando'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import { StreakBadge } from './streak-badge'
import { MathBackground } from './math-background'
import { LaTeXRenderer } from './latex-renderer'
import { ExplicacionMarkdown } from './explicacion-markdown'
import { Home, RotateCcw, TrendingUp, TrendingDown, Sparkles, XCircle, CheckCircle, ChevronDown, ChevronUp, AlertCircle, Lightbulb, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import confetti from 'canvas-confetti'
import type { Answer } from '@/lib/types'
import { countsAsCorrect, countsAsIncorrect, isGraded, scoreOutOfTen, tallyAnswers } from '@/lib/answer-grading'
import { QuizModeDialog } from './quiz-mode-dialog'
import { ExplanationModal } from './explanation-modal'
import { answerRecapLine } from './answer-recap'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { aiCutoffMessage } from '@/lib/ai-cutoff-message'

/**
 * Los colores del papel picado, leídos de los tokens del modo activo. El
 * canvas no entiende variables CSS, así que se resuelven al momento.
 */
function coloresDelSistema(): string[] {
  const estilo = getComputedStyle(document.documentElement)
  return ['--accion', '--logrado', '--flojo'].map((token) => estilo.getPropertyValue(token).trim())
}

export function ResultsScreen() {
  const { currentQuiz, userProgress, resetQuiz, setActiveView, startQuiz } = useAppStore()
  const { answers, questions, config } = currentQuiz
  const [showCorrect, setShowCorrect] = useState(false)
  const [showIncorrect, setShowIncorrect] = useState(false)
  const [loadingExplanation, setLoadingExplanation] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [isRetrying, setIsRetrying] = useState(false)
  const { toast } = useToast()
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

  // El papel picado al aprobar: la única animación decorativa de la app y la
  // única que no es de Framer Motion, así que no puede usar useReducedMotion().
  // `disableForReducedMotion` hace que la librería consulte la preferencia y
  // no dibuje nada. Ver design-reference/sistema/accesibilidad.md, "Movimiento".
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
          colors: coloresDelSistema(),
          disableForReducedMotion: true,
        })
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: coloresDelSistema(),
          disableForReducedMotion: true,
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

      // El corte no se guarda en `explanations`: cuando se libere el cupo,
      // volver a abrir la pregunta tiene que pedir la explicación de verdad.
      const cutoff = await aiCutoffMessage(response)
      if (cutoff) {
        setSelectedModalExplanation(cutoff)
        return
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

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
      setSelectedModalExplanation('No se pudo cargar la explicación. Por favor intentá de nuevo.')
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
      
      const cutoff = await aiCutoffMessage(response)
      const data = await response.json()
      
      if (data.questions && data.questions.length === config.questionCount) {
        startQuiz({ ...config, mode }, data.questions)
      } else {
        // Antes volvía a resultados sin decir nada: el botón parecía no andar.
        setActiveView('results')
        toast({
          title: 'No pudimos armar el cuestionario nuevo',
          description: cutoff ?? 'Probá de nuevo en un rato.',
        })
      }
    } catch {
      setActiveView('results')
      toast({ title: 'No pudimos armar el cuestionario nuevo', description: 'Revisá tu conexión y probá de nuevo.' })
    } finally {
      setIsRetrying(false)
    }
  }, [config, questions, setActiveView, startQuiz, toast])

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
        title: isPrimario ? 'A no desanimarse' : 'Seguí practicando',
        subtitle: isPrimario ? 'Cada error es una oportunidad para aprender. Mirá tus recomendaciones abajo.' : 'Repasá los temas fallados para mejorar tu rendimiento.',
        badgeClass: 'bg-flojo/10 text-flojo dark:text-flojo border border-flojo/30',
      }
    }
    if (results.score < 9) {
      return {
        badgeText: 'Buen trabajo',
        title: isPrimario ? 'Muy bien hecho' : 'Buen trabajo',
        subtitle: isPrimario ? 'Estás aprendiendo muchísimo. Mirá los detalles para perfeccionarlo.' : 'Gran avance en la materia.',
        badgeClass: 'bg-logrado/10 text-logrado dark:text-logrado border border-logrado/30',
      }
    }
    return {
      badgeText: 'Excelente',
      title: isPrimario ? 'Espectacular' : 'Excelente trabajo',
      subtitle: isPrimario ? 'Dominaste este cuestionario por completo.' : 'Rendimiento sobresaliente.',
      badgeClass: 'bg-accion/10 text-accion dark:text-accion border border-accion/30',
    }
  }

  const emotionalInfo = getEmotionalHeader()

  return (
    <div className="min-h-screen relative">
      <MathBackground />
      
      {/* Header */}
      <header className="px-4 py-8 text-center relative z-10 space-y-2">
        <div className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs',
          emotionalInfo.badgeClass
        )}>
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
      {/* Con ancho máximo: a 1280 px las tarjetas medían la ventana entera. */}
      <main className="relative z-10 mx-auto w-full max-w-2xl space-y-5 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))]">
        {/* Score Card */}
        <Card className={cn(
          'p-6 text-center border-2 overflow-hidden relative rounded-3xl',
          results.passed 
            ? 'border-logrado/30 bg-logrado-fondo' 
            : 'border-flojo bg-flojo-fondo '
        )}>
          {results.passed && (
            <>
              <Sparkles className="absolute top-4 left-4 w-6 h-6 text-logrado/40" />
              <Sparkles className="absolute top-8 right-6 w-4 h-4 text-logrado/30" />
            </>
          )}
          
          {/* `w-fit`: la insignia de tendencia se ancla a la esquina del
              recuadro, no a un cuarto del ancho de la tarjeta. */}
          <div className="relative mx-auto w-fit">
            {/* Ancho mínimo y no fijo: "10.00/10" a 48 px no entra en 144 px y
                pisaba el "/10". El recuadro crece con la nota. */}
            <div className={cn(
              'mx-auto flex h-36 w-fit min-w-36 items-center justify-center whitespace-nowrap rounded-3xl px-5',
              'border-4',
              results.passed 
                ? 'border-logrado bg-superficie-tarjeta' 
                : 'border-flojo bg-superficie-tarjeta '
            )}>
              <div>
                <span className={cn(
                  'text-5xl font-black',
                  results.passed ? 'text-logrado' : 'text-flojo'
                )}>
                  {results.score.toFixed(2)}
                </span>
                <span className="text-lg text-muted-foreground font-bold">/10</span>
              </div>
            </div>

            <div className={cn(
              'absolute -right-4 -top-3 w-12 h-12 rounded-2xl flex items-center justify-center',
              results.passed 
                ?' bg-logrado' 
                :' bg-flojo '
            )}>
              {results.passed ? (
                <TrendingUp className="w-6 h-6 text-texto-sobre-accion" />
              ) : (
                <TrendingDown className="w-6 h-6 text-texto-sobre-accion" />
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
        <Card className="p-5 border-2 border-border bg-card/90">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Tu racha</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {userProgress.streak >= 2 
                  ? 'Racha activa, seguí así' 
                  : userProgress.streak === 1
                    ? 'Una más para activar la racha'
                    : 'Aprobá 2 seguidos para activarla'}
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
                ? 'border-logrado bg-logrado-fondo' 
                : 'border-logrado/30 bg-logrado-fondo/50 hover:bg-logrado-fondo'
            )}
            onClick={() => { setShowCorrect(!showCorrect); setShowIncorrect(false) }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-logrado flex items-center justify-center mb-2">
                <CheckCircle className="w-6 h-6 text-texto-sobre-accion" />
              </div>
              <span className="text-3xl font-black text-logrado">{results.correct}</span>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wide mt-1">Correctas</span>
              <div className="flex items-center gap-1 mt-2 text-logrado">
                <span className="text-xs font-semibold">Ver</span>
                {showCorrect ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </Card>
          <Card 
            className={cn(
              'p-4 border-2 cursor-pointer transition-all',
              showIncorrect 
                ? 'border-destructive bg-destructive/10' 
                : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
            )}
            onClick={() => { setShowIncorrect(!showIncorrect); setShowCorrect(false) }}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-destructive flex items-center justify-center mb-2">
                <XCircle className="w-6 h-6 text-texto-sobre-accion" />
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
          <div className="space-y-3 fade-in-50 slide-in-from-top-4">
            <h3 className="font-bold text-foreground flex items-center gap-2 px-1">
              <CheckCircle className="w-5 h-5 text-logrado" />
              Respuestas Correctas
            </h3>
            {results.correctAnswers.map((answer, i) => (
              <Card key={answer.questionId} className="p-4 border-2 border-logrado/30 bg-logrado-fondo">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-logrado text-texto-sobre-accion text-xs font-bold flex items-center justify-center shrink-0">
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
                  <div className="ml-8 p-2 bg-superficie-tarjeta rounded-lg border border-logrado/20">
                    <p className="text-sm text-logrado font-semibold">
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
          <div className="space-y-3 fade-in-50 slide-in-from-top-4">
            <h3 className="font-bold text-foreground flex items-center gap-2 px-1">
              <XCircle className="w-5 h-5 text-destructive" />
              Respuestas Incorrectas
            </h3>
            {results.incorrectAnswers.map((answer, i) => (
              <Card key={answer.questionId} className="p-4 border-2 border-destructive/30 bg-destructive/5">
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-destructive text-texto-sobre-accion text-xs font-bold flex items-center justify-center shrink-0">
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
                    <div className="p-2 bg-logrado-fondo rounded-lg border border-logrado/20">
                      <p className="text-sm text-logrado font-semibold">
                        Correcta: <LaTeXRenderer content={answerRecapLine(answer, 'correct')} />
                      </p>
                    </div>
                  </div>

                  {/* Explanation */}
                  {explanations[answer.questionId] && (
                    <Card className="ml-8 p-4 border-2 border-[var(--algebra)]/30 bg-[var(--algebra-light)]">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-5 h-5 text-[var(--algebra)] shrink-0 mt-0.5" />
                        <ExplicacionMarkdown content={explanations[answer.questionId]} className="flex-1" />
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
                          <Cargando className="w-4 h-4" />
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
      {/* `data-quiz-action-bar`: el botón de "Reportar un problema" mide esta
          barra para ponerse arriba y no encima (components/feedback-button.tsx). */}
      <div
        data-quiz-action-bar=""
        className="fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-card/95 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="max-w-md mx-auto space-y-2.5">
          {!results.passed && (
            <Button
              onClick={() => handleRetry('practico')}
              disabled={isRetrying}
              className="w-full h-auto min-h-13 whitespace-normal py-2 rounded-2xl bg-flojo hover:bg-flojo text-texto-sobre-accion font-bold text-sm gap-2 active:scale-95 transition-all"
            >
              {isRetrying ? (
                <>
                  <Cargando className="w-5 h-5 fill-texto-sobre-accion" />
                  <span>Generando Revancha...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5 text-texto-sobre-accion" />
                  <span>Tomar revancha de todo el cuestionario</span>
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
                    <Cargando className="w-4 h-4" />
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
                'flex-1 h-13 gap-2 rounded-2xl font-bold text-sm text-texto-sobre-accion',
                ' bg-[var(--algebra)]',
                ' hover:scale-[1.02] active:scale-[0.98] transition-all'
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
        description="Seleccioná si querés regenerar este cuestionario en modo teórico, práctico o mixto con los mismos temas."
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
