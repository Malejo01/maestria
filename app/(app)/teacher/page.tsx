'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { SubjectContent } from '@/components/subject-content'
import { teacherProgramToSubject } from '@/lib/teacher-programs'
import { SUBJECT_COLOR_CLASS } from '@/lib/subject-appearance'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  BookOpen,
  Plus,
  Filter,
  Pencil,
  Trash2,
  PlayCircle,
  Eye,
  X,
  Download,
  GraduationCap,
  AlertTriangle,
  Users,
  FilePlus,
  Sparkles,
  ChevronRight,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { TeacherSubjectWizard } from '@/components/teacher-subject-wizard'
import { TeacherOnboardingModal } from '@/components/teacher-onboarding-modal'
import { TeacherClassrooms } from '@/components/teacher-classrooms'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import { SUBJECT_ICON_COMPONENTS } from '@/lib/subject-icons'
import { useToast } from '@/hooks/use-toast'
import { exportQuizToMoodleGift } from '@/lib/moodle-export'
import { parseCreatedFrom, parseNivel } from '@/lib/teacher-programs'
import type { TeacherProgram, TeacherQuiz } from '@/lib/types'

type TeacherProgramApiShape = TeacherProgram & {
  user_id?: string
  subject_name?: string
  icon_name?: TeacherProgram['iconName']
  color_name?: TeacherProgram['colorName']
  pedagogy_profile?: TeacherProgram['pedagogyProfile']
  source_file_name?: string | null
  created_at?: string
  created_from?: TeacherProgram['createdFrom']
}

function normalizeTeacherProgram(program: TeacherProgramApiShape): TeacherProgram {
  return {
    id: Number(program.id),
    userId: program.userId ?? program.user_id ?? '',
    subjectName: program.subjectName ?? program.subject_name ?? 'Materia docente',
    iconName: program.iconName ?? program.icon_name ?? 'book-open',
    colorName: program.colorName ?? program.color_name ?? 'teal',
    pedagogyProfile: program.pedagogyProfile ?? program.pedagogy_profile ?? {
      level: 'No especificado',
      degree: 'No especificado',
      academicYear: 'No especificado',
      complexity: 'No especificado',
      assessmentStyle: 'mixto',
      methodology: 'No especificado',
    },
    units: Array.isArray(program.units) ? program.units : [],
    sourceFileName: program.sourceFileName ?? program.source_file_name ?? null,
    createdAt: program.createdAt ?? program.created_at ?? new Date().toISOString(),
    nivel: parseNivel(program.nivel),
    grado: program.grado ? String(program.grado) : null,
    jurisdiccion: program.jurisdiccion ? String(program.jurisdiccion) : null,
    createdFrom: parseCreatedFrom(program.createdFrom ?? program.created_from),
  }
}

function normalizeTeacherQuiz(quiz: Record<string, unknown>): TeacherQuiz {
  const rawMode = quiz.mode
  const normalizedMode = rawMode === 'practico' ? 'practico' : rawMode === 'mixto' ? 'mixto' : 'teorico'

  return {
    id: Number(quiz.id),
    userId: String(quiz.user_id || ''),
    teacherProgramId: Number(quiz.teacher_program_id || 0),
    title: String(quiz.title || 'Cuestionario docente'),
    subjectName: String(quiz.subject_name || ''),
    mode: normalizedMode,
    status: quiz.status === 'pending_share' ? 'pending_share' : 'saved',
    selectedTopics: Array.isArray(quiz.selected_topics) ? (quiz.selected_topics as { id: string; name: string }[]) : [],
    questionCount: Number(quiz.question_count || 0),
    questions: Array.isArray(quiz.questions) ? (quiz.questions as TeacherQuiz['questions']) : [],
    pedagogyContext: quiz.pedagogy_context ? String(quiz.pedagogy_context) : undefined,
    createdAt: String(quiz.created_at || new Date().toISOString()),
    updatedAt: String(quiz.updated_at || new Date().toISOString()),
  }
}

const ASSESSMENT_STYLE_LABELS: Record<string, string> = {
  teorico: 'Teórico',
  practico: 'Práctico',
  mixto: 'Mixto',
}

export default function TeacherPage() {
  const {
    userProfile,
    teacherPrograms,
    teacherQuizzes,
    teacherProgramFilters,
    teacherSection,
    setSelectedSubject,
    setTeacherPrograms,
    addTeacherProgram,
    updateTeacherProgram,
    removeTeacherProgram,
    setTeacherQuizzes,
    removeTeacherQuiz,
    setTeacherProgramFilters,
    setTeacherSection,
    startQuiz,
    startQuizPreview,
  } = useAppStore()
  const { status } = useSession()
  const isSignedIn = status === 'authenticated'
  const { toast } = useToast()
  const router = useRouter()

  const isTeacher = userProfile?.role === 'DOCENTE'

  const [activeSubject, setActiveSubject] = useState<string | null>(null)
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [showEditWizard, setShowEditWizard] = useState(false)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [initialWizardPath, setInitialWizardPath] = useState<'import' | 'curriculum' | 'manual' | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showOnlyMySubjects, setShowOnlyMySubjects] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [quizSubjectFilter, setQuizSubjectFilter] = useState<string>('all')
  const [performedQuizzes, setPerformedQuizzes] = useState<Record<string, unknown>[]>([])
  const [expandedQuizId, setExpandedQuizId] = useState<number | null>(null)
  const [exportingQuizId, setExportingQuizId] = useState<number | null>(null)
  // Saved quizzes can be published to an aula at any time, not only right
  // after generating them.
  const [sharingQuiz, setSharingQuiz] = useState<TeacherQuiz | null>(null)


  // Non-teachers shouldn't land here directly
  useEffect(() => {
    if (isSignedIn && userProfile && !isTeacher) {
      router.replace('/')
    }
  }, [isSignedIn, userProfile, isTeacher, router])

  // El "ya lo vio" vive en `users.teacher_tour_seen_at` (migración 020), no en
  // localStorage: es por cuenta y no por navegador, y se estampa recién cuando
  // el docente CIERRA el tour — ver `dismissOnboarding`. Marcarlo al abrir,
  // como se hacía antes, hacía que una recarga a destiempo se lo comiera para
  // siempre.
  useEffect(() => {
    if (!isSignedIn || !isTeacher) return

    let isMounted = true

    fetch('/api/teacher/tour')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // `data === null` es un error de red o un 5xx: se trata como "ya lo
        // vio". Molestar con el tour a alguien que ya lo completó es peor que
        // no mostrárselo a alguien nuevo, que igual encuentra los tres caminos
        // dentro del wizard.
        if (isMounted && data && !data.seenAt) setShowOnboardingModal(true)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [isSignedIn, isTeacher])

  /**
   * Cierra el tour y lo da por visto. Se llama tanto si el docente elige un
   * camino como si sale por "Explorar por mi cuenta" o con la X: en los tres
   * casos vio las pantallas, que es lo que la marca representa.
   */
  const dismissOnboarding = useCallback(() => {
    setShowOnboardingModal(false)
    // Fire-and-forget: si falla, el tour vuelve en la próxima visita. Es el
    // fallo barato, y no vale trabar la UI con un await ni un spinner.
    fetch('/api/teacher/tour', { method: 'POST' }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isSignedIn || !isTeacher) {
      setTeacherPrograms([])
      return
    }

    let isMounted = true

    const loadPrograms = async () => {
      try {
        const query = new URLSearchParams()
        if (teacherProgramFilters.name) query.set('name', teacherProgramFilters.name)
        if (teacherProgramFilters.level) query.set('level', teacherProgramFilters.level)
        if (teacherProgramFilters.degree) query.set('degree', teacherProgramFilters.degree)
        if (teacherProgramFilters.createdAfter) query.set('createdAfter', teacherProgramFilters.createdAfter)

        const response = await fetch(`/api/teacher/programs?${query.toString()}`)
        const data = await response.json()

        if (!response.ok || !isMounted) {
          return
        }

        const normalizedPrograms = (Array.isArray(data.programs) ? data.programs : [])
          .map((program: any) => normalizeTeacherProgram(program as TeacherProgramApiShape))

        setTeacherPrograms(normalizedPrograms)
      } catch {
        if (isMounted) {
          setTeacherPrograms([])
        }
      }
    }

    loadPrograms()

    return () => {
      isMounted = false
    }
  }, [isSignedIn, isTeacher, teacherProgramFilters.name, teacherProgramFilters.level, teacherProgramFilters.degree, teacherProgramFilters.createdAfter, setTeacherPrograms])

  const teacherSubjects = useMemo(
    () => teacherPrograms.map((program) => teacherProgramToSubject(program)),
    [teacherPrograms]
  )

  const selectedSubject = teacherSubjects.find((subject) => subject.id === activeSubject)

  useEffect(() => {
    if (!isSignedIn || !isTeacher) return

    let isMounted = true

    const loadData = async () => {
      try {
        const quizzesQuery = new URLSearchParams()
        if (teacherProgramFilters.mode) quizzesQuery.set('mode', teacherProgramFilters.mode)
        if (teacherProgramFilters.createdAfter) quizzesQuery.set('createdAfter', teacherProgramFilters.createdAfter)

        if (teacherSection !== 'cuestionarios' && selectedSubject?.programId) {
          quizzesQuery.set('programId', String(selectedSubject.programId))
        } else if (teacherSection === 'cuestionarios' && quizSubjectFilter.startsWith('teacher-')) {
          quizzesQuery.set('programId', quizSubjectFilter.replace('teacher-', ''))
        }

        const historyQuery = new URLSearchParams()
        if (teacherProgramFilters.mode) historyQuery.set('mode', teacherProgramFilters.mode)
        if (teacherProgramFilters.createdAfter) historyQuery.set('createdAfter', teacherProgramFilters.createdAfter)

        if (teacherSection !== 'cuestionarios' && selectedSubject?.programId) {
          historyQuery.set('subject', selectedSubject.name)
        } else if (teacherSection === 'cuestionarios' && quizSubjectFilter !== 'all') {
          if (quizSubjectFilter.startsWith('teacher-')) {
            const teacherProgramId = Number(quizSubjectFilter.replace('teacher-', ''))
            const filteredProgram = teacherPrograms.find((program) => program.id === teacherProgramId)
            if (filteredProgram) {
              historyQuery.set('subject', filteredProgram.subjectName)
            }
          }
        }

        const [savedRes, historyRes] = await Promise.all([
          fetch(`/api/teacher/quizzes?${quizzesQuery.toString()}`),
          fetch(`/api/quiz/history?${historyQuery.toString()}`),
        ])

        const savedData = await savedRes.json()
        const historyData = await historyRes.json()

        if (!isMounted) return

        if (savedRes.ok) {
          const normalizedQuizzes = (Array.isArray(savedData.quizzes) ? savedData.quizzes : []).map((quiz: any) => normalizeTeacherQuiz(quiz as Record<string, unknown>))
          setTeacherQuizzes(normalizedQuizzes)
        } else {
          setTeacherQuizzes([])
        }

        if (historyRes.ok) {
          setPerformedQuizzes(Array.isArray(historyData.attempts) ? historyData.attempts : [])
        } else {
          setPerformedQuizzes([])
        }
      } catch {
        if (isMounted) {
          setTeacherQuizzes([])
          setPerformedQuizzes([])
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [isSignedIn, isTeacher, teacherSection, quizSubjectFilter, selectedSubject?.programId, selectedSubject?.name, teacherProgramFilters.mode, teacherProgramFilters.createdAfter, teacherPrograms, setTeacherQuizzes])

  useEffect(() => {
    if (quizSubjectFilter === 'all' || !quizSubjectFilter.startsWith('teacher-')) return
    const teacherProgramId = Number(quizSubjectFilter.replace('teacher-', ''))
    if (!teacherPrograms.some((program) => program.id === teacherProgramId)) {
      setQuizSubjectFilter('all')
    }
  }, [quizSubjectFilter, teacherPrograms])

  const handleSubjectChange = (subjectId: string | null) => {
    setActiveSubject(subjectId)
    setSelectedSubject(subjectId)
    setExpandedQuizId(null)
  }



  /**
   * `showCreateQuizAction` is on inside "Mis materias": starting a quiz used to
   * mean jumping to a separate section and picking the materia all over again,
   * so the action now lives on the materia itself.
   */
  const renderTeacherProgramCard = (program: TeacherProgram, { showCreateQuizAction = false } = {}) => {
    const subjectId = `teacher-${program.id}`
    const isSelected = activeSubject === subjectId
    const Icon = SUBJECT_ICON_COMPONENTS[program.iconName] ?? BookOpen
    const chipClass = SUBJECT_COLOR_CLASS[program.colorName]?.chip ?? 'bg-teal-500'
    // Programs created before the wizard have no nivel/grado — stage 2 needs
    // both to match a classroom, so nudge the teacher to fill them in.
    const needsLevelData = !program.nivel || !program.grado

    return (
      <Card
        key={program.id}
        className={`relative w-full p-4 pt-6 min-h-[170px] border-2 cursor-pointer transition-all ${isSelected ? 'border-primary shadow-md bg-primary/5' : 'border-border hover:border-primary/40'}`}
        onClick={() => handleSubjectChange(subjectId)}
        onDoubleClick={() => {
          handleSubjectChange(subjectId)
          setShowDetailDialog(true)
        }}
      >
        <button
          type="button"
          className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center hover:bg-muted"
          onClick={(event) => {
            event.stopPropagation()
            handleSubjectChange(subjectId)
            setShowEditWizard(true)
          }}
          aria-label="Editar materia"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-600 text-white border-2 border-red-600 flex items-center justify-center hover:bg-red-700"
          onClick={(event) => {
            event.stopPropagation()
            handleSubjectChange(subjectId)
            setShowDeleteDialog(true)
          }}
          aria-label="Eliminar materia"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <div className={`w-11 h-11 rounded-xl ${chipClass} text-white flex items-center justify-center shadow-sm`}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="font-semibold leading-snug whitespace-normal break-words text-sm sm:text-[15px] w-full px-1">
            {program.subjectName}
          </p>
          {needsLevelData ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100"
              onClick={(event) => {
                event.stopPropagation()
                handleSubjectChange(subjectId)
                setShowEditWizard(true)
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              Completá nivel y año
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {program.nivel} · {program.grado}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{program.units.length} unidades</p>

          {showCreateQuizAction && (
            <Button
              size="sm"
              className="mt-1 w-full rounded-xl font-bold text-xs"
              onClick={(event) => {
                event.stopPropagation()
                handleSubjectChange(subjectId)
                setTeacherSection('crear')
              }}
            >
              <FilePlus className="w-3.5 h-3.5 mr-1.5" />
              Crear cuestionario
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const activeTeacherProgram = useMemo(
    () => teacherPrograms.find((program) => `teacher-${program.id}` === activeSubject) ?? null,
    [teacherPrograms, activeSubject]
  )

  const handleDeleteActiveProgram = async () => {
    if (!activeTeacherProgram) return

    try {
      const response = await fetch(`/api/teacher/programs/${activeTeacherProgram.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        return
      }

      removeTeacherProgram(activeTeacherProgram.id)
      setShowDeleteDialog(false)
      setActiveSubject(null)
      setSelectedSubject(null)
    } catch {
      // noop
    }
  }

  const handleDeleteQuiz = async (quizId: number) => {
    try {
      const response = await fetch(`/api/teacher/quizzes/${quizId}`, { method: 'DELETE' })
      if (!response.ok) return
      removeTeacherQuiz(quizId)
    } catch {
      // noop
    }
  }

  const handleRunQuiz = (quiz: TeacherQuiz) => {
    startQuiz(
      {
        subject: `teacher-${quiz.teacherProgramId}`,
        subjectName: quiz.subjectName,
        topics: quiz.selectedTopics,
        mode: quiz.mode,
        questionCount: quiz.questionCount,
        pedagogyContext: quiz.pedagogyContext,
      },
      quiz.questions
    )
  }

  const handlePreviewQuiz = (quiz: TeacherQuiz) => {
    startQuizPreview(
      {
        subject: `teacher-${quiz.teacherProgramId}`,
        subjectName: quiz.subjectName,
        topics: quiz.selectedTopics,
        mode: quiz.mode,
        questionCount: quiz.questionCount,
        pedagogyContext: quiz.pedagogyContext,
      },
      quiz.questions
    )
  }

  const handleExportQuiz = (quiz: TeacherQuiz) => {
    try {
      setExportingQuizId(quiz.id)
      const fileName = exportQuizToMoodleGift(quiz)
      toast({ title: 'Exportacion lista', description: `Se descargo ${fileName}` })
    } catch (error) {
      toast({
        title: 'No se pudo exportar',
        description: error instanceof Error ? error.message : 'Error desconocido al exportar a Moodle.',
      })
    } finally {
      setExportingQuizId(null)
    }
  }

  if (isSignedIn && userProfile && !isTeacher) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Panel Docente</h1>
          <p className="text-sm text-muted-foreground">Gestioná tus materias, programas y cuestionarios.</p>
        </div>
      </div>

      <Card className="p-3 rounded-2xl border border-border/60 bg-card/75 backdrop-blur-md shadow-[0_6px_30px_rgba(23,23,23,0.06)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            className={`min-w-0 h-11 px-2 sm:px-3 rounded-xl justify-center sm:justify-start shadow-sm ${teacherSection === 'materias' ? 'bg-[var(--algebra-light)] text-[var(--algebra)] border-[var(--algebra)]/40 hover:bg-[var(--algebra-light)]' : 'bg-white/70 border-border/70 hover:bg-[var(--algebra-light)]/70 hover:text-[var(--algebra)]'}`}
            variant="outline"
            onClick={() => setTeacherSection('materias')}
          >
            <Eye className="w-4 h-4 mr-2" />
            <span className="text-[11px] sm:text-xs md:text-sm leading-tight text-center sm:text-left whitespace-normal">Mis materias</span>
          </Button>
          <Button
            className={`min-w-0 h-11 px-2 sm:px-3 rounded-xl justify-center sm:justify-start shadow-sm ${teacherSection === 'crear' ? 'bg-[var(--analysis-light)] text-[var(--analysis)] border-[var(--analysis)]/40 hover:bg-[var(--analysis-light)]' : 'bg-white/70 border-border/70 hover:bg-[var(--analysis-light)]/70 hover:text-[var(--analysis)]'}`}
            variant="outline"
            onClick={() => setTeacherSection('crear')}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            <span className="text-[11px] sm:text-xs md:text-sm leading-tight text-center sm:text-left whitespace-normal">Crear cuestionario</span>
          </Button>
          <Button
            className={`min-w-0 h-11 px-2 sm:px-3 rounded-xl justify-center sm:justify-start shadow-sm ${teacherSection === 'cuestionarios' ? 'bg-[var(--probability-light)] text-[var(--probability)] border-[var(--probability)]/40 hover:bg-[var(--probability-light)]' : 'bg-white/70 border-border/70 hover:bg-[var(--probability-light)]/70 hover:text-[var(--probability)]'}`}
            variant="outline"
            onClick={() => setTeacherSection('cuestionarios')}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            <span className="text-[11px] sm:text-xs md:text-sm leading-tight text-center sm:text-left whitespace-normal">Mis cuestionarios</span>
          </Button>
          <Button
            className={`min-w-0 h-11 px-2 sm:px-3 rounded-xl justify-center sm:justify-start shadow-sm ${teacherSection === 'aulas' ? 'bg-primary/10 text-primary border-primary/40 hover:bg-primary/10' : 'bg-white/70 border-border/70 hover:bg-primary/5 hover:text-primary'}`}
            variant="outline"
            onClick={() => setTeacherSection('aulas')}
          >
            <Users className="w-4 h-4 mr-2" />
            <span className="text-[11px] sm:text-xs md:text-sm leading-tight text-center sm:text-left whitespace-normal">Mis aulas</span>
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        {teacherSection === 'materias' && (
          <Card className="p-4 rounded-2xl border border-border/60 bg-card/75 backdrop-blur-md shadow-[0_6px_30px_rgba(23,23,23,0.06)] space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowCreateWizard(true)} className="rounded-xl font-bold">
                <Plus className="w-4 h-4 mr-2" />
                Crear materia
              </Button>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-3">
                <Button
                  variant={showOnlyMySubjects ? 'default' : 'outline'}
                  onClick={() => setShowOnlyMySubjects((prev) => !prev)}
                >
                  Mostrar solo mis materias
                </Button>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por nombre"
                    value={teacherProgramFilters.name}
                    onChange={(event) => setTeacherProgramFilters({ name: event.target.value })}
                  />
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por nivel"
                    value={teacherProgramFilters.level}
                    onChange={(event) => setTeacherProgramFilters({ level: event.target.value })}
                  />
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por carrera"
                    value={teacherProgramFilters.degree}
                    onChange={(event) => setTeacherProgramFilters({ degree: event.target.value })}
                  />
                  <select
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    value={teacherProgramFilters.mode}
                    onChange={(event) => setTeacherProgramFilters({ mode: event.target.value as '' | 'teorico' | 'practico' | 'mixto' })}
                  >
                    <option value="">Modo (todos)</option>
                    <option value="teorico">Teorico</option>
                    <option value="practico">Practico</option>
                    <option value="mixto">Mixto</option>
                  </select>
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm sm:col-span-2"
                    type="date"
                    value={teacherProgramFilters.createdAfter}
                    onChange={(event) => setTeacherProgramFilters({ createdAfter: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mis materias</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowOnboardingModal(true)} className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Ayuda para crear
                </Button>
              </div>
              {teacherPrograms.length === 0 && (
                <p className="text-sm text-muted-foreground">Todavia no cargaste materias propias.</p>
              )}
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                {teacherPrograms.map((program) => renderTeacherProgramCard(program, { showCreateQuizAction: true }))}
              </div>
            </div>
          </Card>
        )}

        {teacherSection === 'crear' && (
          <Card className="p-4 rounded-2xl border border-border/60 bg-card/75 backdrop-blur-md shadow-[0_6px_30px_rgba(23,23,23,0.06)] space-y-4">
            {/* Arriving from a materia's own "Crear cuestionario" button means
                the materia is already picked — showing the picker again would
                be the extra step this was meant to remove. */}
            {!selectedSubject && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Selecciona una materia</h2>
                <p className="text-sm text-muted-foreground">Elige una de tus materias para comenzar a crear el cuestionario.</p>

                {teacherPrograms.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Todavia no cargaste materias propias.</p>
                    <Button onClick={() => setShowCreateWizard(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear materia
                    </Button>
                  </div>
                )}

                {teacherPrograms.length > 0 && (
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                    {teacherPrograms.map((program) => renderTeacherProgramCard(program))}
                  </div>
                )}
              </div>
            )}

            {selectedSubject && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate">Cuestionario de {selectedSubject.name}</h2>
                    <p className="text-sm text-muted-foreground">Elegí los temas que va a cubrir.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => handleSubjectChange(null)}
                  >
                    Cambiar materia
                  </Button>
                </div>
                <SubjectContent subject={selectedSubject} />
              </div>
            )}
          </Card>
        )}

        {teacherSection === 'aulas' && (
          <div className="space-y-4">
            {/* El diagnóstico del 10/08 no se tomó dentro de un aula, así que
                no aparece en el seguimiento de ninguna. El acceso vive acá
                porque es lo más cerca que está de "mis alumnos". */}
            <Link href="/teacher/diagnostico" className="block">
              <Card className="p-4 rounded-2xl border border-border/60 bg-card/75 hover:border-primary/50 transition-colors flex items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    Diagnóstico del 10 de agosto
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Qué nivelar antes de avanzar, por unidad y con los pisos de azar a la vista
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Card>
            </Link>

            <TeacherClassrooms programs={teacherPrograms} />
          </div>
        )}

        {teacherSection === 'cuestionarios' && (
          <Card className="p-4 rounded-2xl border border-border/60 bg-card/75 backdrop-blur-md shadow-[0_6px_30px_rgba(23,23,23,0.06)] space-y-3">
            <div className="space-y-2">
              <h2 className="font-bold">Mis cuestionarios</h2>
              <p className="text-sm text-muted-foreground">Se muestran todos tus cuestionarios. Usa el filtro para ver una materia puntual.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={quizSubjectFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuizSubjectFilter('all')}
                >
                  Todas las materias
                </Button>
                {teacherPrograms.map((program) => (
                  <Button
                    key={program.id}
                    variant={quizSubjectFilter === `teacher-${program.id}` ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQuizSubjectFilter(`teacher-${program.id}`)}
                  >
                    {program.subjectName}
                  </Button>
                ))}
              </div>
            </div>

            <Tabs defaultValue="guardados">
              <TabsList>
                <TabsTrigger value="guardados">Guardados ({teacherQuizzes.length})</TabsTrigger>
                <TabsTrigger value="realizados">Realizados ({performedQuizzes.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="guardados" className="space-y-2">
                {teacherQuizzes.length === 0 && <p className="text-sm text-muted-foreground">No hay cuestionarios guardados para este filtro.</p>}
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                  {teacherQuizzes.map((quiz) => (
                    <Card key={quiz.id} className="p-3 border self-start">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {quiz.subjectName} | {quiz.mode} | {quiz.questionCount} preguntas | {quiz.status === 'pending_share' ? 'PENDIENTE_COMPARTIR' : 'GUARDADO'}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedQuizId((prev) => (prev === quiz.id ? null : quiz.id))}>
                            <Eye className="w-4 h-4 mr-1" />
                            Ver detalle
                          </Button>
                        </div>

                        {expandedQuizId === quiz.id && (
                          <div className="space-y-1 text-sm bg-muted/40 rounded-md p-2">
                            <p><strong>Temas:</strong> {quiz.selectedTopics.map((topic) => topic.name).join(', ') || 'Sin temas'}</p>
                            <p><strong>Creado:</strong> {new Date(quiz.createdAt).toLocaleString('es-AR')}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handlePreviewQuiz(quiz)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Previsualizar
                          </Button>
                          <Button size="sm" onClick={() => handleRunQuiz(quiz)}>
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Realizar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={exportingQuizId === quiz.id}
                            onClick={() => handleExportQuiz(quiz)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            {exportingQuizId === quiz.id ? 'Exportando...' : 'Exportar Moodle'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSharingQuiz(quiz)}>
                            <Users className="w-4 h-4 mr-1" />
                            Asignar a un aula
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteQuiz(quiz.id)}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="realizados" className="space-y-2">
                {performedQuizzes.length === 0 && <p className="text-sm text-muted-foreground">No hay cuestionarios realizados para este filtro.</p>}
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {performedQuizzes.map((attempt) => (
                    <Card key={String(attempt.id)} className="p-3 border">
                      <p className="font-semibold">{String(attempt.subject)}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(attempt.mode)} | Nota: {String(attempt.score)} | Fecha: {new Date(String(attempt.completed_at)).toLocaleString('es-AR')}
                      </p>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        )}
      </div>

      <TeacherSubjectWizard
        open={showCreateWizard}
        onOpenChange={(open) => {
          setShowCreateWizard(open)
          if (!open) setInitialWizardPath(null)
        }}
        onProgramCreated={addTeacherProgram}
        initialPath={initialWizardPath}
      />

      <TeacherSubjectWizard
        open={showEditWizard}
        onOpenChange={setShowEditWizard}
        onProgramCreated={addTeacherProgram}
        onProgramUpdated={(program) => updateTeacherProgram(program.id, program)}
        programToEdit={activeTeacherProgram}
      />

      <ShareQuizDialog
        open={Boolean(sharingQuiz)}
        onOpenChange={(open) => !open && setSharingQuiz(null)}
        quiz={sharingQuiz}
        onExportMoodle={() => sharingQuiz && handleExportQuiz(sharingQuiz)}
        isExporting={exportingQuizId === sharingQuiz?.id}
        onGoToClassrooms={() => {
          setSharingQuiz(null)
          setTeacherSection('aulas')
        }}
      />

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeTeacherProgram && (
            <>
              <DialogHeader>
                <DialogTitle>{activeTeacherProgram.subjectName}</DialogTitle>
                <DialogDescription>
                  {activeTeacherProgram.nivel ?? 'Sin nivel'} · {activeTeacherProgram.grado ?? 'Sin año'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Complejidad</p>
                    <p className="font-semibold">{activeTeacherProgram.pedagogyProfile.complexity || 'No especificado'}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Enfoque</p>
                    <p className="font-semibold">
                      {ASSESSMENT_STYLE_LABELS[activeTeacherProgram.pedagogyProfile.assessmentStyle] ||
                        activeTeacherProgram.pedagogyProfile.assessmentStyle ||
                        'No especificado'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Unidades</p>
                    <p className="font-semibold">{activeTeacherProgram.units.length} unidades</p>
                  </div>
                </div>

                {activeTeacherProgram.pedagogyProfile.methodology && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Metodología de enseñanza</p>
                    <p className="text-sm">{activeTeacherProgram.pedagogyProfile.methodology}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Temario completo</p>
                  {activeTeacherProgram.units.map((unit, index) => (
                    <div key={unit.id} className="rounded-xl border p-3 space-y-2">
                      <p className="font-semibold text-sm">
                        {index + 1}. {unit.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unit.topics.map((topic) => (
                          <Badge key={topic.id} variant={topic.origin === 'curriculum' ? 'secondary' : 'outline'} className="text-xs">
                            {topic.name}
                          </Badge>
                        ))}
                        {unit.topics.length === 0 && (
                          <p className="text-xs text-muted-foreground">Sin temas.</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeTeacherProgram.units.length === 0 && (
                    <p className="text-sm text-muted-foreground">Esta materia todavía no tiene unidades cargadas.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false)
                    setShowEditWizard(true)
                  }}
                >
                  Editar materia
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta seguro que desea eliminar esta materia?</AlertDialogTitle>
            <AlertDialogDescription>
              Una vez realizada esta accion no puede volverse atras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDeleteActiveProgram}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeacherOnboardingModal
        open={showOnboardingModal}
        onOpenChange={(next) => {
          if (next) setShowOnboardingModal(true)
          else dismissOnboarding()
        }}
        onSelectPath={(path) => {
          dismissOnboarding()
          setInitialWizardPath(path)
          setShowCreateWizard(true)
        }}
      />
    </div>
  )
}
