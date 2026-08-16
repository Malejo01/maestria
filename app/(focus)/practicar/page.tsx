'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { CurriculumSelector, type CurriculumSelection } from '@/components/curriculum-selector'
import type { Nivel } from '@/lib/nivel-options'
import { TeacherQuizGenerated } from '@/components/teacher-quiz-generated'
import { LoadingScreen } from '@/components/loading-screen'
import { useToast } from '@/hooks/use-toast'
import type { Question } from '@/lib/types'

export default function PracticarPage() {
  const { startQuiz, setTeacherSection } = useAppStore()
  const { data: session } = useSession()
  const { toast } = useToast()
  const router = useRouter()

  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[] | null>(null)
  const [lastSelection, setLastSelection] = useState<CurriculumSelection | null>(null)

  const isDocente = session?.user?.role === 'DOCENTE'

  const generateQuiz = async (selection: CurriculumSelection): Promise<Question[]> => {
    const ejesMap = new Map<string, string[]>()
    for (const t of selection.selectedTopics) {
      if (!ejesMap.has(t.eje)) ejesMap.set(t.eje, [])
      ejesMap.get(t.eje)!.push(t.name)
    }
    const subjectUnits = Array.from(ejesMap.entries()).map(([eje, temas]) => ({
      id: eje, name: eje,
      topics: temas.map((n) => ({ id: n, name: n })),
    }))

    const res = await fetch('/api/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: selection.materia,
        subjectSource: 'teacher',
        subjectUnits,
        topics: selection.selectedTopics.map((t) => ({ id: t.id, name: t.name })),
        mode: selection.mode,
        questionCount: selection.questionCount,
        nivel: selection.nivel,
        grado: selection.grado,
        // La ruta la usa para leer el contexto profesional de la carrera desde
        // `curriculum`; sin esto la generación no sabe que el alumno estudia
        // sistemas y salen ejercicios de matemática genérica.
        carrera: selection.carrera,
        difficulty: selection.difficulty,
        questionTypes: selection.questionTypes,
        pedagogyContext: [
          `Nivel: ${selection.nivel}`,
          selection.grado ? `Grado/Año: ${selection.grado}` : null,
          `Dificultad: ${selection.difficulty}`,
        ].filter(Boolean).join(' | '),
      }),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('La IA no pudo estructurar preguntas válidas para los temas seleccionados.')
    }
    return data.questions as Question[]
  }

  const handleStartQuiz = async (selection: CurriculumSelection) => {
    setLastSelection(selection)
    setIsGenerating(true)

    try {
      const questions = await generateQuiz(selection)

      if (isDocente) {
        setGeneratedQuestions(questions)
      } else {
        startQuiz(
          {
            subject: selection.materia,
            subjectName: selection.materia,
            nivel: selection.nivel,
            grado: selection.grado,
            difficulty: selection.difficulty,
            topics: selection.selectedTopics.map((t) => ({ id: t.id, name: t.name })),
            mode: selection.mode,
            questionCount: questions.length,
            questionTypes: selection.questionTypes,
            pedagogyContext: [
              `Nivel: ${selection.nivel}`,
              selection.grado ? `Grado/Año: ${selection.grado}` : null,
              `Dificultad: ${selection.difficulty}`,
            ].filter(Boolean).join(' | '),
          },
          questions,
        )
      }
    } catch (err) {
      console.error('Error generating quiz:', err)
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: 'destructive',
        title: 'Error de Generación',
        description: `No pudimos generar tu cuestionario: ${errorMsg}. Por favor, volvé a intentarlo en unos instantes.`,
      })
    } finally {
      setIsGenerating(false)
    }
  }

  if (isGenerating) {
    return <LoadingScreen />
  }

  if (isDocente && generatedQuestions && generatedQuestions.length > 0 && lastSelection) {
    return (
      <TeacherQuizGenerated
        questions={generatedQuestions}
        selection={lastSelection}
        onBack={() => setGeneratedQuestions(null)}
        onGoToSavedQuizzes={() => {
          setGeneratedQuestions(null)
          setTeacherSection('cuestionarios')
          router.push('/teacher')
        }}
      />
    )
  }

  return (
    <CurriculumSelector
      onStartQuiz={handleStartQuiz}
      onCancel={() => router.push('/')}
      initialNivel={!isDocente ? (session?.user?.nivel as Nivel | null) : null}
      initialGrado={!isDocente ? session?.user?.grado : null}
    />
  )
}
