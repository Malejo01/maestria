'use client'
import { useRef, useState } from 'react'
import { parametrosDeLaPractica } from '@/lib/practica-del-grupo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Check, ChevronDown, ChevronUp, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Subject, Topic } from '@/lib/types'
import { useAppStore } from '@/lib/store'
import { QuizModeDialog } from './quiz-mode-dialog'
import { pedagogyProfileToContext } from '@/lib/teacher-programs'
import { QuizActionDialog } from './quiz-action-dialog'
import { ShareQuizDialog } from './share-quiz-dialog'
import { exportQuizToMoodleGift } from '@/lib/moodle-export'
import type { ProgramUnit, Question, QuestionType, QuizActionMode, SubjectColorName, SubjectIconName, TeacherQuiz } from '@/lib/types'
import { DEFAULT_QUESTION_TYPES } from '@/lib/question-types'
import { useToast } from '@/hooks/use-toast'
import { contar } from '@/lib/textos'
import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'
import { DialogoDeLimite } from '@/components/docente/pantalla-de-limite'

interface SubjectContentProps {
  subject: Subject
  /**
   * Set when the subject is being practised from inside an aula, so the
   * resulting attempt is attributed to it and shows up on the teacher's
   * roster. Free practice outside an aula leaves it undefined.
   */
  classroomId?: number
}

const MIN_QUESTION_COUNT = 5
const MAX_QUESTION_COUNT = 50
const DEFAULT_QUESTION_COUNT = 10

function normalizeQuestionFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/\$+/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const colorConfig = {
  algebra: {
    bg: 'bg-[var(--algebra)]',
    bgLight: 'bg-[var(--algebra-light)]',
    text: 'text-[var(--algebra)]',
    border: 'border-[var(--algebra)]',
    borderLight: 'border-[var(--algebra)]/30',
    gradient: 'bg-[var(--algebra)]',
  },
  analisis: {
    bg: 'bg-[var(--analysis)]',
    bgLight: 'bg-[var(--analysis-light)]',
    text: 'text-[var(--analysis)]',
    border: 'border-[var(--analysis)]',
    borderLight: 'border-[var(--analysis)]/30',
    gradient: 'bg-[var(--analysis)]',
  },
  probabilidad: {
    bg: 'bg-[var(--probability)]',
    bgLight: 'bg-[var(--probability-light)]',
    text: 'text-[var(--probability)]',
    border: 'border-[var(--probability)]',
    borderLight: 'border-[var(--probability)]/30',
    gradient: 'bg-[var(--probability)]',
  }
}

export function SubjectContent({ subject, classroomId }: SubjectContentProps) {
  const { selectedTopics, toggleTopic, setActiveView, startQuiz, getUsedQuestionIds, addTeacherQuiz, setTeacherSection, userProfile, currentQuiz } = useAppStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showModeDialog, setShowModeDialog] = useState(false)
  const [showActionDialog, setShowActionDialog] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'teorico' | 'practico' | 'mixto' | null>(null)
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number | null>(null)
  const [questionCountValue, setQuestionCountValue] = useState<string>(String(DEFAULT_QUESTION_COUNT))
  const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>(DEFAULT_QUESTION_TYPES)
  // O3: en un grupo, los tipos se mandan sólo si el alumno tocó el selector.
  const [tocoLosTipos, setTocoLosTipos] = useState(false)
  const [pendingSharedQuiz, setPendingSharedQuiz] = useState<TeacherQuiz | null>(null)
  const [isExportingMoodle, setIsExportingMoodle] = useState(false)
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({})
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const { toast } = useToast()
  // Un 402 del plan (vencido o tope del gratis) abre la pantalla de límite en
  // vez del aviso genérico de "no se pudo generar". El ref es para saberlo en
  // el mismo turno, sin esperar el render.
  const [bloqueoPlan, setBloqueoPlan] = useState<CuerpoDeBloqueo | null>(null)
  const bloqueoRef = useRef<CuerpoDeBloqueo | null>(null)
  
  const colors = colorConfig[subject.id as keyof typeof colorConfig] || colorConfig.algebra
  const pedagogyContext = subject.pedagogyProfile
    ? pedagogyProfileToContext(subject.pedagogyProfile)
    : undefined
  const parsedQuestionCount = Number(questionCountValue)
  const isQuestionCountValid = Number.isInteger(parsedQuestionCount)
    && parsedQuestionCount >= MIN_QUESTION_COUNT
    && parsedQuestionCount <= MAX_QUESTION_COUNT
  const adjustQuestionCount = (delta: number) => {
    const base = isQuestionCountValid ? parsedQuestionCount : DEFAULT_QUESTION_COUNT
    const next = Math.min(MAX_QUESTION_COUNT, Math.max(MIN_QUESTION_COUNT, base + delta))
    setQuestionCountValue(String(next))
  }

  const totalTopics = subject.units.reduce((acc, unit) => acc + unit.topics.length, 0)
  const completedTopics = subject.units.reduce(
    (acc, unit) => acc + unit.topics.filter(t => t.completed).length, 
    0
  )
  const progressPercentage = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0

  const exampleAppearanceMap: Record<string, { iconName: SubjectIconName; colorName: SubjectColorName }> = {
    algebra: { iconName: 'sigma', colorName: 'blue' },
    analisis: { iconName: 'chart-line', colorName: 'green' },
    probabilidad: { iconName: 'pie-chart', colorName: 'amber' },
  }

  const toProgramUnits = (): ProgramUnit[] => {
    return subject.units.map((unit, unitIndex) => ({
      id: unit.id || `u-${unitIndex + 1}`,
      name: unit.name,
      topics: unit.topics.map((topic, topicIndex) => ({
        id: topic.id || `${unit.id || `u-${unitIndex + 1}`}-t-${topicIndex + 1}`,
        name: topic.name,
      })),
    }))
  }

  const resolveTeacherProgramId = async (): Promise<number> => {
    if (subject.source === 'teacher' && subject.programId) {
      return subject.programId
    }

    const lookupResponse = await fetch(`/api/teacher/programs?name=${encodeURIComponent(subject.name)}`)
    const lookupData = await lookupResponse.json()

    if (lookupResponse.ok && Array.isArray(lookupData.programs)) {
      const exactProgram = lookupData.programs.find((program: { subject_name?: string; subjectName?: string; id: number }) => {
        const currentName = String(program.subjectName || program.subject_name || '').trim().toLowerCase()
        return currentName === subject.name.trim().toLowerCase()
      })

      if (exactProgram?.id) {
        return Number(exactProgram.id)
      }
    }

    const appearance = exampleAppearanceMap[subject.id] || { iconName: 'book-open' as SubjectIconName, colorName: 'teal' as SubjectColorName }
    const createResponse = await fetch('/api/teacher/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectName: subject.name,
        iconName: appearance.iconName,
        colorName: appearance.colorName,
        units: toProgramUnits(),
        pedagogyProfile: {
          level: 'Universitario',
          degree: 'General',
          academicYear: 'No especificado',
          complexity: 'Intermedio',
          assessmentStyle: 'mixto',
          methodology: 'Generado desde materia ejemplo',
        },
      }),
    })

    const createData = await createResponse.json()
    if (!createResponse.ok || !createData?.program?.id) {
      const details = createData?.details ? ` (${createData.details})` : ''
      throw new Error(`${createData?.error || 'No se pudo preparar la materia para guardar cuestionarios'}${details}`)
    }

    return Number(createData.program.id)
  }

  const generateQuestionsByMode = async (mode: 'teorico' | 'practico' | 'mixto', questionCount: number): Promise<Question[] | null> => {
    if (selectedTopics.length === 0) return null

    // O3: en un grupo, nivel, año y carrera salen del programa del grupo.
    const practica = parametrosDeLaPractica({
      classroomId,
      programa: { nivel: subject.nivel, grado: subject.grado, carrera: subject.pedagogyProfile?.degree },
      config: currentQuiz?.config,
      perfil: userProfile,
      tipos: selectedQuestionTypes,
      tocoLosTipos,
    })
    const targetDifficulty = currentQuiz?.config?.difficulty || 'intermedio'

    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.name,
          subjectSource: subject.source || 'core',
          subjectUnits: subject.units || [],
          nivel: practica.nivel,
          grado: practica.grado,
          ...(practica.carrera ? { carrera: practica.carrera } : {}),
          difficulty: targetDifficulty,
          topics: selectedTopics,
          mode,
          questionCount,
          ...(practica.questionTypes ? { questionTypes: practica.questionTypes } : {}),
          pedagogyContext,
          previousQuestionIds: getUsedQuestionIds(),
          // J3: para que el servidor sume lo pedagógico de las fichas del grupo.
          ...(subject.source === 'teacher' && subject.programId ? { teacherProgramId: subject.programId } : {}),
        })
      })
      
      const data = await response.json()

      const frenado = response.status === 402 ? leerBloqueo(data) : null
      if (frenado) {
        bloqueoRef.current = frenado
        setBloqueoPlan(frenado)
        return null
      }

      if (Array.isArray(data.questions) && data.questions.length === questionCount) {
        return data.questions as Question[]
      }

      console.error('No questions received:', data.error)
      return null
    } catch (error) {
      console.error('Quiz generation error:', error)
      return null
    }
  }

  const generateMixedQuestions = async (questionCount: number): Promise<Question[] | null> => {
    const teoricoCount = Math.ceil(questionCount / 2)
    const practicoCount = Math.floor(questionCount / 2)

    const [teoricoQuestions, practicoQuestions] = await Promise.all([
      generateQuestionsByMode('teorico', teoricoCount),
      generateQuestionsByMode('practico', practicoCount),
    ])

    if (!teoricoQuestions || !practicoQuestions) {
      return null
    }

    const merged: Question[] = []
    const seen = new Set<string>()
    const maxLength = Math.max(teoricoQuestions.length, practicoQuestions.length)

    for (let index = 0; index < maxLength; index++) {
      const teorico = teoricoQuestions[index]
      if (teorico) {
        const fingerprint = normalizeQuestionFingerprint(teorico.question)
        if (fingerprint.length > 0 && !seen.has(fingerprint)) {
          seen.add(fingerprint)
          merged.push(teorico)
        }
      }

      const practico = practicoQuestions[index]
      if (practico && merged.length < questionCount) {
        const fingerprint = normalizeQuestionFingerprint(practico.question)
        if (fingerprint.length > 0 && !seen.has(fingerprint)) {
          seen.add(fingerprint)
          merged.push(practico)
        }
      }

      if (merged.length === questionCount) {
        break
      }
    }

    return merged.length === questionCount ? merged : null
  }

  const saveTeacherQuiz = async ({
    mode,
    questions,
    status,
  }: {
    mode: 'teorico' | 'practico' | 'mixto'
    questions: Question[]
    status: 'saved' | 'pending_share'
  }): Promise<TeacherQuiz> => {
    const teacherProgramId = await resolveTeacherProgramId()

    const response = await fetch('/api/teacher/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacherProgramId,
        title: `${subject.name} - ${mode === 'teorico' ? 'Teórico' : mode === 'practico' ? 'Práctico' : 'Mixto'} - ${new Date().toLocaleDateString('es-AR')}`,
        subjectName: subject.name,
        mode,
        status,
        selectedTopics,
        questionCount: questions.length,
        questions,
        pedagogyContext,
      })
    })

    const data = await response.json()
    if (!response.ok) {
      const details = data?.details ? ` (${data.details})` : ''
      throw new Error(`${data?.error || 'No se pudo guardar el cuestionario'}${details}`)
    }

    const mappedQuiz: TeacherQuiz = {
      id: data.quiz.id,
      userId: data.quiz.user_id,
      teacherProgramId: data.quiz.teacher_program_id,
      title: data.quiz.title,
      subjectName: data.quiz.subject_name,
      mode: data.quiz.mode,
      status: data.quiz.status,
      selectedTopics: data.quiz.selected_topics,
      questionCount: data.quiz.question_count,
      questions: data.quiz.questions,
      pedagogyContext: data.quiz.pedagogy_context || undefined,
      createdAt: data.quiz.created_at,
      updatedAt: data.quiz.updated_at,
    }

    addTeacherQuiz(mappedQuiz)

    toast({
      title: 'Cuestionario creado',
      description: status === 'saved'
        ? 'Lo vas a ver debajo de esta materia, en Guardados.'
        : 'Quedó marcado como pendiente para compartir.',
    })

    return mappedQuiz
  }

  const handleStartQuiz = async (mode: 'teorico' | 'practico' | 'mixto') => {
    if (!isQuestionCountValid) {
      toast({
        title: 'Cantidad inválida',
        description: `Ingresá un número entero entre ${MIN_QUESTION_COUNT} y ${MAX_QUESTION_COUNT}.`,
      })
      return
    }

    setSelectedMode(mode)
    setSelectedQuestionCount(parsedQuestionCount)
    setShowModeDialog(false)

    if (userProfile?.role !== 'DOCENTE') {
      await handleActionSelection('realizar', mode, parsedQuestionCount)
      return
    }

    setShowActionDialog(true)
  }

  const handleActionSelection = async (
    action: QuizActionMode,
    forcedMode?: 'teorico' | 'practico' | 'mixto',
    forcedQuestionCount?: number
  ) => {
    const effectiveMode = forcedMode || selectedMode
    const effectiveQuestionCount = forcedQuestionCount || selectedQuestionCount
    if (!effectiveMode || !effectiveQuestionCount) return
    const useLoadingScreen = userProfile?.role !== 'DOCENTE' || action === 'guardar'

    setIsLoading(true)
    setShowActionDialog(false)
    bloqueoRef.current = null
    if (useLoadingScreen) {
      setActiveView('loading')
    }

    try {
      const generatedQuestions = effectiveMode === 'mixto'
        ? await generateMixedQuestions(effectiveQuestionCount)
        : await generateQuestionsByMode(effectiveMode, effectiveQuestionCount)
      if (!generatedQuestions || generatedQuestions.length === 0) {
        if (!bloqueoRef.current) {
          toast({ title: 'No se pudo generar el cuestionario', description: 'Intentá de nuevo.' })
        }
        if (useLoadingScreen) {
          setActiveView('dashboard')
        }
        return
      }

      if (action === 'realizar') {
        startQuiz(
          {
            subject: subject.id,
            subjectName: subject.name,
            topics: selectedTopics,
            mode: effectiveMode,
            questionCount: generatedQuestions.length,
            questionTypes: selectedQuestionTypes,
            pedagogyContext,
            classroomId,
          },
          generatedQuestions
        )
        return
      }

      const status = action === 'guardar' ? 'saved' : 'pending_share'
      const savedQuiz = await saveTeacherQuiz({ mode: effectiveMode, questions: generatedQuestions, status })

      if (action === 'guardar') {
        setTeacherSection('cuestionarios')
      }

      if (action === 'compartir') {
        setPendingSharedQuiz(savedQuiz)
        setShowShareDialog(true)
      }

      if (useLoadingScreen) {
        setActiveView('dashboard')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Error desconocido',
      })
      if (useLoadingScreen) {
        setActiveView('dashboard')
      }
    } finally {
      setIsLoading(false)
      setSelectedMode(null)
      setSelectedQuestionCount(null)
    }
  }

  const handleExportPendingShare = () => {
    if (!pendingSharedQuiz) {
      toast({ title: 'No hay cuestionario para exportar', description: 'Generá o seleccioná un cuestionario primero.' })
      return
    }

    try {
      setIsExportingMoodle(true)
      const fileName = exportQuizToMoodleGift(pendingSharedQuiz)
      toast({ title: 'Exportación lista', description: `Se descargó ${fileName}` })
      setShowShareDialog(false)
    } catch (error) {
      toast({
        title: 'No se pudo exportar',
        description: error instanceof Error ? error.message : 'Error desconocido al exportar a Moodle.',
      })
    } finally {
      setIsExportingMoodle(false)
    }
  }

  const selectedIds = new Set(selectedTopics.map(t => t.id))

  const toggleGroup = (topics: Topic[]) => {
    const allSelected = topics.every(t => selectedIds.has(t.id))
    topics.forEach((topic) => {
      const isSelected = selectedIds.has(topic.id)
      if (allSelected && isSelected) toggleTopic(topic.id, topic.name)
      if (!allSelected && !isSelected) toggleTopic(topic.id, topic.name)
    })
  }

  return (
    <div className="space-y-5 pb-44 md:pb-28 fade-in-50 slide-in-from-bottom-4 duration-300">
      {/* Subject Header Card */}
      <Card className={cn('overflow-hidden border-2', colors.borderLight)}>
        <div className={cn('p-4 text-texto-sobre-accion', colors.gradient)}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{subject.name}</h2>
              <p className="text-texto-sobre-accion/80 text-sm">{contar(subject.units.length, 'unidad', 'unidades')}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">{Math.round(progressPercentage)}%</div>
              <div className="text-texto-sobre-accion/80 text-xs">completado</div>
            </div>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2.5 mt-3 bg-superficie-tarjeta/30 [&>div]:bg-superficie-tarjeta"
          />
        </div>
      </Card>

      {/* Selected count */}
      {selectedTopics.length > 0 && (
        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-logrado-fondo text-logrado rounded-full text-sm font-semibold border-2 border-logrado">
            <Check className="w-4 h-4" />
            {selectedTopics.length} tema{selectedTopics.length !== 1 ? 's' : ''} seleccionado{selectedTopics.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Units List */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Elegir temas para el cuestionario</h3>
        <p className="text-sm text-muted-foreground">Elegí los temas que quieras incluir.</p>
      </div>

      <div className="space-y-6">
        {subject.units.map((unit, unitIndex) => {
          const groupedTopics = unit.topics.reduce<{ group: string; topics: Topic[] }[]>((acc, topic) => {
            const groupName = topic.group ?? ''
            const lastGroup = acc[acc.length - 1]

            if (!lastGroup || lastGroup.group !== groupName) {
              acc.push({ group: groupName, topics: [topic] })
            } else {
              lastGroup.topics.push(topic)
            }

            return acc
          }, [])

          const isExpanded = expandedUnits[unit.id] ?? false

          const toggleUnitExpanded = () => {
            setExpandedUnits(prev => ({
              ...prev,
              [unit.id]: !isExpanded
            }))
          }

          return (
            <div key={unit.id} className="space-y-3">
              {/* Unit Header */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(unit.topics)}
                  className={cn(
                    'flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors',
                    colors.bgLight,
                    'border-2',
                    colors.borderLight
                  )}
                >
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-texto-sobre-accion text-lg',
                    colors.bg
                  )}>
                    {unitIndex + 1}
                  </div>
                  <h3 className="font-bold text-foreground text-base">
                    Unidad {unitIndex + 1}: {unit.name.replace(/^Unidad\s+[IVX]+:\s*/i, '')}
                  </h3>
                </button>
                <button
                  type="button"
                  onClick={toggleUnitExpanded}
                  className={cn(
                    'h-12 w-12 rounded-xl border-2 flex items-center justify-center transition-colors',
                    colors.bgLight,
                    colors.borderLight,
                    'hover:border-muted-foreground/50'
                  )}
                  aria-label={isExpanded ? 'Ocultar temas' : 'Mostrar temas'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-3">
                  {groupedTopics.map((group) => {
                  const selectedCount = group.topics.filter(topic => selectedIds.has(topic.id)).length
                  const allSelected = selectedCount === group.topics.length
                  const someSelected = selectedCount > 0 && !allSelected
                    const groupKey = `${unit.id}:${group.group || group.topics[0].id}`
                    const isGroupExpanded = expandedGroups[groupKey] ?? true

                    const toggleGroupExpanded = () => {
                      setExpandedGroups(prev => ({
                        ...prev,
                        [groupKey]: !isGroupExpanded
                      }))
                    }

                  return (
                    <div key={group.group || group.topics[0].id} className="space-y-2">
                        {group.group && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.topics)}
                              className={cn(
                                'flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold',
                                allSelected && 'bg-logrado border-foreground text-foreground',
                                someSelected && !allSelected && 'bg-logrado-fondo border-logrado text-foreground',
                                !selectedCount && 'bg-superficie-tarjeta border-border text-muted-foreground'
                              )}
                            >
                              <span>{group.group}</span>
                              <span>{selectedCount}/{group.topics.length}</span>
                            </button>
                            <button
                              type="button"
                              onClick={toggleGroupExpanded}
                              className={cn(
                                'h-9 w-9 rounded-xl border-2 flex items-center justify-center transition-colors',
                                colors.bgLight,
                                colors.borderLight,
                                'hover:border-muted-foreground/50'
                              )}
                              aria-label={isGroupExpanded ? 'Ocultar temas' : 'Mostrar temas'}
                            >
                              {isGroupExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {isGroupExpanded && (
                          <div className="grid gap-2 pl-2">
                            {group.topics.map((topic) => {
                              const isSelected = selectedIds.has(topic.id)

                              return (
                                <button
                                  key={topic.id}
                                  onClick={() => toggleTopic(topic.id, topic.name)}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left',
                                    'border-2',
                                    isSelected
                                      ? 'bg-logrado border-foreground '
                                      : 'bg-superficie-tarjeta border-border hover:border-muted-foreground/50 hover:bg-muted/30'
                                  )}
                                >
                                  <div className={cn(
                                    'w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                    isSelected
                                      ? 'bg-foreground border-foreground'
                                      : 'border-muted-foreground/40 bg-superficie-tarjeta'
                                  )}>
                                    {isSelected && <Check className="w-4 h-4 text-texto-sobre-accion" strokeWidth={3} />}
                                  </div>
                                  <span className={cn(
                                    'flex-1 font-medium text-sm',
                                    isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'
                                  )}>
                                    {topic.name}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Floating Sticky Generar Cuestionario Bar. O13: en el celular va ENCIMA
          de la barra inferior de navegación (que lo tapaba entero): se corre lo
          que mide esa barra, la misma variable que usa el botón de reportar. */}
      <div className="fixed bottom-[calc(var(--alto-barra-inferior,0px)+env(safe-area-inset-bottom))] left-0 right-0 p-4 bg-background/80 border-t-2 border-border/80 z-30 transition-all md:bottom-0">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => setShowModeDialog(true)}
            disabled={isLoading || selectedTopics.length === 0}
            className={cn(
              'w-full h-16 text-lg font-bold gap-3 rounded-2xl transition-all duration-300',
              selectedTopics.length > 0
                ?' bg-[var(--algebra)] text-texto-sobre-accion hover:scale-[1.01] active:scale-[0.99] border-0'
                : 'opacity-45 pointer-events-none bg-muted text-muted-foreground border-2 border-border'
            )}
            size="lg"
          >
            <Play className="w-5 h-5 fill-current" />
            <span className="flex flex-col items-start leading-tight">
              <span>Generar cuestionario</span>
              <span className="text-xs font-medium opacity-90">
                {selectedTopics.length === 0
                  ? 'Elegí al menos 1 tema arriba para seguir'
                  : `${selectedTopics.length} tema${selectedTopics.length > 1 ? 's' : ''} seleccionado${selectedTopics.length > 1 ? 's' : ''}`}
              </span>
            </span>
          </Button>
        </div>
      </div>

      <QuizModeDialog
        open={showModeDialog}
        onOpenChange={setShowModeDialog}
        onSelectMode={handleStartQuiz}
        isLoading={isLoading}
        title="Empezar cuestionario"
        description="Elegí la cantidad de preguntas y el tipo de cuestionario."
        questionCountValue={questionCountValue}
        onQuestionCountValueChange={setQuestionCountValue}
        onDecreaseQuestionCount={() => adjustQuestionCount(-1)}
        onIncreaseQuestionCount={() => adjustQuestionCount(1)}
        isQuestionCountValid={isQuestionCountValid}
        minQuestionCount={MIN_QUESTION_COUNT}
        maxQuestionCount={MAX_QUESTION_COUNT}
        showQuestionTypeSelector
        questionTypes={selectedQuestionTypes}
        onQuestionTypesChange={(tipos) => {
          setTocoLosTipos(true)
          setSelectedQuestionTypes(tipos)
        }}
      />

      {userProfile?.role === 'DOCENTE' && (
        <>
          <DialogoDeLimite bloqueo={bloqueoPlan} onCerrar={() => setBloqueoPlan(null)} />
          <QuizActionDialog
            open={showActionDialog}
            onOpenChange={setShowActionDialog}
            onSelectAction={handleActionSelection}
            isLoading={isLoading}
          />
          <ShareQuizDialog
            open={showShareDialog}
            onOpenChange={setShowShareDialog}
            onExportMoodle={handleExportPendingShare}
            isExporting={isExportingMoodle}
            quiz={pendingSharedQuiz}
          />
        </>
      )}
    </div>
  )
}
