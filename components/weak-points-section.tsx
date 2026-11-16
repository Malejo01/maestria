import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, ChevronRight, Zap, Target } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useAppStore } from '@/lib/store'
import type { WeakPoint } from '@/lib/types'
import { QuizModeDialog } from './quiz-mode-dialog'

interface WeakPointsSectionProps {
  weakPoints: WeakPoint[]
  /** 'preview' shows a capped list with a link to the full view (used on Inicio). Defaults to 'full'. */
  variant?: 'preview' | 'full'
  limit?: number
}

export function WeakPointsSection({ weakPoints, variant = 'full', limit }: WeakPointsSectionProps) {
  const { removeWeakPoint, setActiveView, startQuiz, getUsedQuestionIds, currentQuiz, userProfile } = useAppStore()
  const [loadingSubjectId, setLoadingSubjectId] = useState<string | null>(null)
  const [practiceModalSubjectId, setPracticeModalSubjectId] = useState<string | null>(null)
  const [activeSubjectModal, setActiveSubjectModal] = useState<string | null>(null)

  const handlePractice = async (subjectId: string, points: WeakPoint[], mode: 'teorico' | 'practico' | 'mixto') => {
    if (!points || points.length === 0) return

    const subjectName = subjectId

    const firstPoint = points[0]
    const targetNivel = firstPoint.nivel || currentQuiz.config?.nivel || userProfile?.nivel || 'Primario'
    const targetGrado = firstPoint.grado || currentQuiz.config?.grado || userProfile?.grado || '2do Grado'
    const targetDifficulty = currentQuiz.config?.difficulty || 'intermedio'

    const isMicroQuiz = points.length === 1
    const questionCount = isMicroQuiz ? 3 : 10

    const topics = points.map((point) => ({
      id: point.topic,
      name: point.topicName || point.topic
    }))

    const misconceptionContext = isMicroQuiz && firstPoint.misconceptionType
      ? `El estudiante ha mostrado esta confusión histórica en ${firstPoint.topicName}: "${firstPoint.misconceptionType}". Diseña las preguntas enfocándote en desafiar y romper esta confusión específica.`
      : undefined

    setLoadingSubjectId(subjectId)
    setPracticeModalSubjectId(null)
    setActiveSubjectModal(null)
    setActiveView('loading')

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subjectName,
          nivel: targetNivel,
          grado: targetGrado,
          difficulty: targetDifficulty,
          topics,
          mode,
          questionCount,
          pedagogyContext: misconceptionContext,
          previousQuestionIds: getUsedQuestionIds()
        })
      })

      const data = await response.json()

      if (data.questions && data.questions.length > 0) {
        startQuiz(
          {
            subject: subjectId,
            subjectName: subjectName,
            nivel: targetNivel,
            grado: targetGrado,
            topics,
            mode,
            questionCount: data.questions.length
          },
          data.questions
        )
      } else {
        setActiveView('dashboard')
      }
    } catch (error) {
      console.error('Error generating practice quiz:', error)
      setActiveView('dashboard')
    } finally {
      setLoadingSubjectId(null)
    }
  }

  // Group weak points by subject
  const groupedWeakPoints = weakPoints.reduce((acc, wp) => {
    if (!acc[wp.subject]) {
      acc[wp.subject] = []
    }
    acc[wp.subject].push(wp)
    return acc
  }, {} as Record<string, WeakPoint[]>)

  const allEntries = Object.entries(groupedWeakPoints)
  if (allEntries.length === 0) return null
  const entries = limit ? allEntries.slice(0, limit) : allEntries

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-flojo flex items-center justify-center text-texto-sobre-accion">
            <Zap className="w-4 h-4 fill-texto-sobre-accion" />
          </div>
          <h3 className="font-bold text-foreground text-lg">Temas a Reforzar</h3>
        </div>
        {variant === 'preview' && (
          <Link href="/history?tab=reforzar" className="flex items-center gap-1 text-xs font-bold text-flojo dark:text-flojo hover:translate-x-0.5 transition-transform shrink-0">
            Ver todos
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      {/* Grid of Subject Cards */}
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {entries.map(([subjectId, points]) => {
          const firstGrado = points[0]?.grado
          return (
            <Card
              key={subjectId}
              onClick={() => setActiveSubjectModal(subjectId)}
              className="p-4 border-2 border-flojo/80 bg-flojo-fondo/70 hover:border-flojo transition-all cursor-pointer group rounded-2xl flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-flojo/10 border border-flojo/20 flex items-center justify-center text-flojo dark:text-flojo group-hover:scale-105 transition-transform shrink-0">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground text-sm group-hover:text-flojo transition-colors">
                      {subjectId}
                    </h4>
                    {firstGrado && (
                      <span className="px-2 py-0.5 rounded-md bg-flojo-fondo/60 dark:bg-flojo-fondo text-flojo dark:text-flojo text-[10px] font-bold">
                        {firstGrado}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {points.length} tema{points.length > 1 ? 's' : ''} a reforzar
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs font-bold text-flojo dark:text-flojo gap-1 group-hover:translate-x-0.5 transition-transform"
              >
                <span>Ver</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
          )
        })}
      </div>

      {/* Subject Weak Points Modal */}
      {entries.map(([subjectId, points]) => {
        const isOpen = activeSubjectModal === subjectId
        const firstGrado = points[0]?.grado
        return (
          <Dialog
            key={subjectId}
            open={isOpen}
            onOpenChange={(open) => setActiveSubjectModal(open ? subjectId : null)}
          >
            {/* Sin `mx-4`: corría el diálogo 16 px fuera de la pantalla a 390 px (el
                mismo defecto que tenía el modal de explicación). */}
            <DialogContent className="max-h-[85dvh] overflow-y-auto rounded-3xl border-2 border-flojo p-5 sm:max-w-xl sm:p-6">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-foreground">
                  <div className="w-9 h-9 rounded-xl bg-flojo/10 flex items-center justify-center text-flojo shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <span>Temas a reforzar — {subjectId}</span>
                  {firstGrado && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-flojo/15 text-flojo text-xs font-extrabold ml-1">
                      {firstGrado}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Seleccioná un tema para tomar un micro-entrenamiento o practicá todos los contenidos a la vez.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center justify-between p-3.5 bg-flojo-fondo rounded-2xl border border-flojo/60">
                  <span className="text-xs font-semibold text-flojo dark:text-flojo">
                    Practicar todos los temas de esta materia ({points.length})
                  </span>
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveSubjectModal(null)
                      setPracticeModalSubjectId(subjectId)
                    }}
                    className="h-8 px-3 rounded-xl bg-flojo hover:bg-flojo text-texto-sobre-accion font-bold text-xs gap-1"
                  >
                    Practicar todo
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {points.map((wp) => (
                    <div
                      key={wp.topic}
                      className="p-4 bg-card rounded-2xl border-2 border-flojo/80 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-bold text-sm text-foreground">
                              {wp.topicName || wp.topic}
                            </h5>
                            {wp.grado && (
                              <span className="px-2 py-0.5 rounded-md bg-flojo-fondo dark:bg-flojo-fondo text-flojo dark:text-flojo text-[10px] font-bold">
                                {wp.grado}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-flojo dark:text-flojo font-medium mt-0.5">
                            {wp.misconceptionType || 'Necesita refuerzo conceptual'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] bg-flojo text-texto-sobre-accion px-2 py-0.5 rounded-full font-bold">
                            {wp.count} fallas
                          </span>
                          <button
                            onClick={() => removeWeakPoint(wp.topic)}
                            className="text-muted-foreground hover:text-flojo transition-colors p-1"
                            title="Eliminar de temas a reforzar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handlePractice(subjectId, [wp], 'practico')}
                        disabled={loadingSubjectId === subjectId}
                        className="w-full h-9 rounded-xl bg-flojo hover:bg-flojo text-texto-sobre-accion font-bold text-xs gap-1.5 active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 fill-texto-sobre-accion" />
                        Entrenar (3 preguntas)
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )
      })}

      {/* Practice all modal */}
      {practiceModalSubjectId && (
        <QuizModeDialog
          open={Boolean(practiceModalSubjectId)}
          onOpenChange={(open) => setPracticeModalSubjectId(open ? practiceModalSubjectId : null)}
          onSelectMode={(mode) => {
            const points = groupedWeakPoints[practiceModalSubjectId] || []
            handlePractice(practiceModalSubjectId, points, mode)
          }}
          onBack={() => {
            const subId = practiceModalSubjectId
            setPracticeModalSubjectId(null)
            setActiveSubjectModal(subId)
          }}
          isLoading={Boolean(loadingSubjectId)}
          title="Practicar temas a reforzar"
          description="Elegí el tipo de examen para generar preguntas sobre los temas que necesitás reforzar."
        />
      )}
    </section>
  )
}
