'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { LoadingScreen } from './loading-screen'
import { QuizEngine } from './quiz-engine'
import { ResultsScreen } from './results-screen'
import { aprueba } from '@/lib/answer-grading'

/**
 * Global full-screen overlay for the quiz-taking flow (loading/quiz/results).
 * Mounted once per route group so it can be triggered from any page (Inicio,
 * Historial "Temas a Reforzar", Panel Docente) without needing its own route —
 * navigation into it is a Zustand state flip (`activeView`), not a URL change.
 */
export function QuizOverlay() {
  const activeView = useAppStore((state) => state.activeView)
  const currentQuiz = useAppStore((state) => state.currentQuiz)
  const updateStreak = useAppStore((state) => state.updateStreak)
  const updateSubjectAverage = useAppStore((state) => state.updateSubjectAverage)
  const addWeakPoint = useAppStore((state) => state.addWeakPoint)
  const removeWeakPoint = useAppStore((state) => state.removeWeakPoint)
  const [statsUpdatedForQuizId, setStatsUpdatedForQuizId] = useState<string | null>(null)

  useEffect(() => {
    // A teacher preview must never move streaks, averages or weak points.
    if (currentQuiz.config?.previewOnly) return
    if (activeView === 'results' && currentQuiz.config && currentQuiz.answers.length > 0) {
      const attemptId = `${currentQuiz.config.subject}-${currentQuiz.answers.length}-${currentQuiz.startedAt}`
      if (statsUpdatedForQuizId !== attemptId) {
        setStatsUpdatedForQuizId(attemptId)

        const { answers, config, questions } = currentQuiz
        const incorrectAnswers = answers.filter((a) => !a.isCorrect)
        const correct = answers.filter((a) => a.isCorrect).length
        const total = questions.length
        const score = Number(((correct / total) * 10).toFixed(2))

        const passed = aprueba(score)
        updateStreak(passed)
        updateSubjectAverage(config.subject, score)

        const topicStatsMap = new Map<string, { correct: number; total: number; topicName?: string }>()

        answers.forEach((a) => {
          const topicKey = a.topic || a.topicName
          if (!topicKey) return
          const current = topicStatsMap.get(topicKey) || { correct: 0, total: 0, topicName: a.topicName }
          topicStatsMap.set(topicKey, {
            correct: current.correct + (a.isCorrect ? 1 : 0),
            total: current.total + 1,
            topicName: a.topicName || current.topicName,
          })
        })

        if (config.topics && config.topics.length === 1 && incorrectAnswers.length === 0) {
          const singleTopic = config.topics[0]
          removeWeakPoint(singleTopic.id)
          if (singleTopic.name) removeWeakPoint(singleTopic.name)
        }

        topicStatsMap.forEach((stats, topicKey) => {
          if (stats.correct === stats.total && stats.total > 0) {
            removeWeakPoint(topicKey)
            if (stats.topicName) removeWeakPoint(stats.topicName)
          } else if (stats.correct < stats.total) {
            addWeakPoint(topicKey, stats.topicName || topicKey, config.subjectName || config.subject, config.nivel, config.grado)
          }
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, currentQuiz, statsUpdatedForQuizId])

  if (activeView !== 'loading' && activeView !== 'quiz' && activeView !== 'results') return null

  // Layering contract for the whole app — keep these in sync:
  //   z-10/z-20/z-30  page content, sticky navbar, fixed page action bars
  //   z-40            this overlay (must cover the navbar)
  //   z-[45]          floating "Reportar problema" button (components/feedback-button.tsx)
  //   z-50            portaled Radix layers (Dialog, AlertDialog, Popover…)
  //   z-[100]         toasts
  // The report button sits in the gap between this overlay and the Radix layer
  // on purpose, and the gap is the whole reason it's z-[45] and not z-40+1 by
  // accident: below z-40 it disappears exactly when a student hits a broken
  // question, and at z-50 or above it would float over modal dialogs.
  // The overlay MUST stay below z-50: it used to be z-[100], which painted it
  // over every portaled dialog. Those dialogs still grabbed the body scroll
  // lock and pointer-events, so opening one from inside the quiz (the unsaved
  // changes prompt, "Explicar con IA", "Revancha") froze the page with no
  // visible way out.
  return (
    <div className="fixed inset-0 z-40 bg-background overflow-y-auto">
      {activeView === 'loading' && <LoadingScreen />}
      {activeView === 'quiz' && <QuizEngine />}
      {activeView === 'results' && <ResultsScreen />}
    </div>
  )
}
