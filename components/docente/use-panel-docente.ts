'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { SECCION_DOCENTE_POR_DEFECTO, esSeccionDocente, type SeccionDocente } from '@/lib/navegacion'
import { teacherProgramToSubject } from '@/lib/teacher-programs'
import { X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { exportQuizToMoodleGift } from '@/lib/moodle-export'
import { parseCreatedFrom, parseNivel } from '@/lib/teacher-programs'
import type { TeacherProgram, TeacherQuiz } from '@/lib/types'
import { configDeTarea, tareaDesdeFila } from '@/lib/tarea-docente'

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

export const ASSESSMENT_STYLE_LABELS: Record<string, string> = {
  teorico: 'Teórico',
  practico: 'Práctico',
  mixto: 'Mixto',
}

/**
 * En qué pestañas de la barra puede estar a la vista cada sección del store.
 * "Armar tarea" ('crear') se abre desde Mis tareas y también desde la tarjeta
 * de una materia, sin cambiar de pestaña.
 */
const PESTANAS_DE: Record<'materias' | 'crear' | 'cuestionarios' | 'aulas', SeccionDocente[]> = {
  aulas: ['alumnos'],
  materias: ['materias'],
  cuestionarios: ['tareas'],
  crear: ['tareas', 'materias'],
}

/**
 * El estado y los datos del panel del docente: materias, tareas guardadas,
 * la materia elegida, los filtros y los diálogos abiertos.
 *
 * Es la orquestación que antes vivía mezclada con la presentación en
 * app/(app)/teacher/page.tsx (994 líneas). Se movió tal cual, sin cambiar
 * lógica; la presentación quedó en mis-materias.tsx y mis-tareas.tsx, que
 * reciben lo que devuelve este hook.
 *
 * Los tres comparten un solo estado a propósito: la materia elegida en
 * "Mis materias" es la que usa "Armar tarea", y decide qué tareas guardadas
 * se piden al servidor.
 */
export function usePanelDocente() {
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
  const { data: session, status } = useSession()
  const isSignedIn = status === 'authenticated'
  const { toast } = useToast()
  const router = useRouter()

  // El rol sale del perfil cuando ya llegó, y mientras tanto de la sesión.
  // Antes era sólo el perfil, así que las materias y las tareas no se
  // empezaban a pedir hasta que terminara OTRO pedido (/api/user/profile): un
  // viaje de ida y vuelta entero de pantalla vacía. El proxy ya no deja llegar
  // acá a un alumno, y si el perfil dice otra cosa cuando llega, gana el perfil.
  const isTeacher = (userProfile?.role ?? session?.user?.role) === 'DOCENTE'

  // La sección la manda la URL (?seccion=), que es lo que marcan las pestañas
  // de la barra: Mis alumnos / Mis materias / Mis tareas. Sin parámetro, la
  // pantalla de inicio del docente es Mis alumnos.
  const parametros = useSearchParams()
  const seccionDeLaUrl = parametros.get('seccion')
  // `?seccion=tareas&armar=1` abre directo el armado de una tarea nueva.
  const armarDesdeLaUrl = parametros.get('armar') === '1'
  // `?agregar=1` abre el diálogo de agregar alumno (el botón "+ Alumno" de la barra).
  const agregarDesdeLaUrl = parametros.get('agregar') === '1'
  // `&materia=<id>` deja elegida la materia al armar una tarea para un alumno.
  const materiaDesdeLaUrl = Number(parametros.get('materia')) || null
  const [agregarAlumno, setAgregarAlumno] = useState(false)
  const [gruposAbiertos, setGruposAbiertos] = useState(false)
  useEffect(() => {
    if (agregarDesdeLaUrl) setAgregarAlumno(true)
  }, [agregarDesdeLaUrl])
  /** La pestaña que marca la barra. Se sabe desde el primer render: sale de la URL. */
  const seccionDeLaBarra: SeccionDocente = esSeccionDocente(seccionDeLaUrl) ? seccionDeLaUrl : SECCION_DOCENTE_POR_DEFECTO
  /**
   * Falso mientras la sección del store no corresponde a la pestaña de la URL.
   * El store arranca en 'materias': sin esto, entrar a Mis alumnos dibujaba un
   * instante Mis materias. Se deduce en vez de guardarse: no hay un "ya
   * sincronizó" que pueda quedar marcado de más.
   */
  const seccionLista = PESTANAS_DE[teacherSection].includes(seccionDeLaBarra)
  useEffect(() => {
    setTeacherSection(
      seccionDeLaBarra === 'alumnos'
        ? 'aulas'
        : seccionDeLaBarra === 'materias'
          ? 'materias'
          : armarDesdeLaUrl
            ? 'crear'
            : 'cuestionarios',
    )
  }, [seccionDeLaBarra, armarDesdeLaUrl, setTeacherSection])

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
  /** Cuestionario abierto en la vista de revisión, o null. */
  const [revisandoQuiz, setRevisandoQuiz] = useState<TeacherQuiz | null>(null)
  const [exportingQuizId, setExportingQuizId] = useState<number | null>(null)
  // Saved quizzes can be published to an aula at any time, not only right
  // after generating them.
  const [sharingQuiz, setSharingQuiz] = useState<TeacherQuiz | null>(null)
  /** Sube cuando algo cambió fuera de este estado (se mandó una tarea): la tarjeta de primeros pasos relee. */
  const [version, setVersion] = useState(0)
  /**
   * Falso hasta que la primera lectura de tareas terminó. Sin esto, la lista
   * vacía inicial se dibuja como "todavía no armaste ninguna tarea" durante el
   * instante de carga: un estado que todavía no se sabe, mostrado como un hecho.
   */
  const [tareasLeidas, setTareasLeidas] = useState(false)
  /** Lo mismo para las materias: falso hasta que terminó la primera lectura, haya salido bien o mal. */
  const [materiasLeidas, setMateriasLeidas] = useState(false)


  // Non-teachers shouldn't land here directly
  useEffect(() => {
    if (isSignedIn && userProfile && !isTeacher) {
      router.replace('/')
    }
  }, [isSignedIn, userProfile, isTeacher, router])

  // Los caminos para armar el temario ya no se abren solos en la primera
  // visita: los abre el docente desde el primer hito del onboarding
  // (components/docente/hitos-onboarding.tsx). `teacher_tour_seen_at` se sigue
  // estampando al cerrarlos — ver `dismissOnboarding`.

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
      } finally {
        if (isMounted) setMateriasLeidas(true)
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
    if (!materiaDesdeLaUrl) return
    const materia = teacherSubjects.find((subject) => subject.programId === materiaDesdeLaUrl)
    if (materia) setActiveSubject(materia.id)
  }, [materiaDesdeLaUrl, teacherSubjects])

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
          const normalizedQuizzes = (Array.isArray(savedData.quizzes) ? savedData.quizzes : []).map((quiz: any) => tareaDesdeFila(quiz as Record<string, unknown>))
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
      } finally {
        if (isMounted) setTareasLeidas(true)
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

  // L1: la misma configuración que usan la ficha y el diálogo del diagnóstico.
  const handleRunQuiz = (quiz: TeacherQuiz) => {
    startQuiz(configDeTarea(quiz), quiz.questions)
  }

  const handlePreviewQuiz = (quiz: TeacherQuiz) => {
    startQuizPreview(configDeTarea(quiz), quiz.questions)
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

  return {
    isSignedIn,
    router,
    isTeacher,
    sesionCargando: status === 'loading',
    seccionDeLaBarra,
    seccionLista,
    materiasLeidas,
    parametros,
    seccionDeLaUrl,
    armarDesdeLaUrl,
    agregarDesdeLaUrl,
    materiaDesdeLaUrl,
    dismissOnboarding,
    teacherSubjects,
    selectedSubject,
    handleSubjectChange,
    activeTeacherProgram,
    handleDeleteActiveProgram,
    handleDeleteQuiz,
    handleRunQuiz,
    handlePreviewQuiz,
    handleExportQuiz,
    agregarAlumno,
    setAgregarAlumno,
    gruposAbiertos,
    setGruposAbiertos,
    activeSubject,
    setActiveSubject,
    showCreateWizard,
    setShowCreateWizard,
    showEditWizard,
    setShowEditWizard,
    showOnboardingModal,
    setShowOnboardingModal,
    initialWizardPath,
    setInitialWizardPath,
    showDeleteDialog,
    setShowDeleteDialog,
    showDetailDialog,
    setShowDetailDialog,
    showOnlyMySubjects,
    setShowOnlyMySubjects,
    showFilters,
    setShowFilters,
    quizSubjectFilter,
    setQuizSubjectFilter,
    performedQuizzes,
    setPerformedQuizzes,
    expandedQuizId,
    setExpandedQuizId,
    revisandoQuiz,
    setRevisandoQuiz,
    exportingQuizId,
    setExportingQuizId,
    sharingQuiz,
    setSharingQuiz,
    version,
    setVersion,
    tareasLeidas,
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
    status,
    toast,
  }
}

export type PanelDocente = ReturnType<typeof usePanelDocente>
