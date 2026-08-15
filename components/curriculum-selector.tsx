'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  ChevronRight, Loader2,
  CheckSquare, Square, Minus, ArrowLeft, Settings2, Upload, FileText, GraduationCap,
} from 'lucide-react'
import { MathBackground } from '@/components/math-background'
import { NIVEL_OPTIONS, type Nivel } from '@/lib/nivel-options'
import { QuestionTypeSelector } from '@/components/question-type-selector'
import { DEFAULT_QUESTION_TYPES } from '@/lib/question-types'
import { cn } from '@/lib/utils'
import type { QuestionType } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type QuizMode = 'teorico' | 'practico' | 'mixto'

interface Eje {
  eje: string
  temas: string[]
}

interface SelectedTopicMap {
  // key: `${eje}||${tema}` → true
  [key: string]: boolean
}

export interface CurriculumSelection {
  nivel: Nivel
  grado: string
  materia: string
  /**
   * Carrera terciaria. Vacío en Primario y Secundario, que se organizan por
   * grado. En Superior distingue el programa de una carrera del de otra: sin
   * esto, "Matemática" de la tecnicatura en sistemas y "Matemática" de un
   * profesorado serían la misma materia para el selector.
   */
  carrera: string
  selectedTopics: { id: string; name: string; eje: string }[]
  mode: QuizMode
  questionCount: number
  difficulty: 'basico' | 'intermedio' | 'avanzado'
  questionTypes: QuestionType[]
}

interface CurriculumSelectorProps {
  onStartQuiz: (selection: CurriculumSelection) => void
  onCancel?: () => void
  /** Pre-seeds nivel/grado from the student's saved profile so returning
   *  students skip straight to the materia step instead of re-selecting
   *  nivel/grado every session. Omit (or pass null) to start at 'nivel' as before. */
  initialNivel?: Nivel | null
  initialGrado?: string | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CurriculumSelector({ onStartQuiz, onCancel, initialNivel, initialGrado }: CurriculumSelectorProps) {
  const { data: session } = useSession()
  const isDocente = session?.user?.role === 'DOCENTE'
  /**
   * El atajo de "volver directo a materia" vale para K-12, donde (nivel, grado)
   * identifican por completo el lugar del alumno en el currículum.
   *
   * En Superior NO alcanzan: falta la carrera, y saltear a 'materia' sin ella
   * consulta la API con `carrera IS NULL`, que en Superior no matchea ninguna
   * fila. El alumno cuyo perfil ya dice Superior/1er Año veía "No hay materias
   * cargadas para este nivel todavía" — justo el caso de los 31 alumnos que
   * motivaron esto. Por eso Superior arranca en su propio paso de carrera.
   */
  const isSuperiorPreseed = initialNivel === 'Superior'
  const hasPreseed = Boolean(initialNivel && initialGrado) && !isSuperiorPreseed

  // Step machine: nivel → grado → materia → topics → params
  //
  // Superior tiene dos caminos y se bifurca en 'superior-carrera':
  //   precargado: nivel → superior-carrera → grado → materia → topics → params
  //   propio    : nivel → superior-carrera → superior-form → topics → params
  // El segundo es el que existía antes de que hubiera currículos Superior
  // cargados, y se conserva para quien no tiene su carrera en la lista.
  //
  // When both initialNivel/initialGrado are provided, we start straight at 'materia'.
  type Step = 'nivel' | 'grado' | 'materia' | 'topics' | 'params' | 'superior-form' | 'superior-carrera'
  const [step, setStep] = useState<Step>(
    hasPreseed ? 'materia' : isSuperiorPreseed ? 'superior-carrera' : 'nivel'
  )

  const [nivel, setNivel] = useState<Nivel | null>(
    hasPreseed || isSuperiorPreseed ? initialNivel! : null
  )
  const [grades, setGrades] = useState<string[]>([])
  const [grado, setGrado] = useState<string>(hasPreseed ? initialGrado! : '')
  const [subjects, setSubjects] = useState<string[]>([])
  const [materia, setMateria] = useState<string>('')
  const [axes, setAxes] = useState<Eje[]>([])
  const [selected, setSelected] = useState<SelectedTopicMap>({})
  const [loadingData, setLoadingData] = useState(false)

  // Superior flow state. `carrera` la comparten los dos caminos: en el
  // precargado sale de la lista, en el propio la escribe el alumno.
  const [careers, setCareers] = useState<string[]>([])
  const [carrera, setCarrera] = useState('')
  /**
   * Cuál de los dos caminos de Superior se tomó. No se deduce de otro estado a
   * propósito: `materia` y `carrera` terminan con valor en ambos, así que
   * inferirlo daría una navegación hacia atrás que a veces acierta.
   */
  const [superiorPath, setSuperiorPath] = useState<'precargado' | 'propio' | null>(null)
  const [anioCarrera, setAnioCarrera] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedUnits, setParsedUnits] = useState<{ id: string; name: string; topics: { id: string; name: string }[] }[]>([])
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Quiz params
  const [mode, setMode] = useState<QuizMode>('mixto')
  const [questionCount, setQuestionCount] = useState(20)
  const [difficulty, setDifficulty] = useState<'basico' | 'intermedio' | 'avanzado'>('intermedio')
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(DEFAULT_QUESTION_TYPES)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  /**
   * `carrera` viaja como query param sólo cuando tiene valor. Ausente, la API
   * filtra por `carrera IS NULL`, que es lo correcto para Primario y Secundario
   * y lo que evita que una materia de una tecnicatura aparezca en 4to año.
   */
  const carreraParam = (c: string) => (c ? `&carrera=${encodeURIComponent(c)}` : '')

  const fetchCareers = async (n: Nivel) => {
    setLoadingData(true)
    try {
      const res = await fetch(`/api/curriculum/careers?nivel=${encodeURIComponent(n)}`)
      const data = await res.json()
      return (data.careers ?? []) as string[]
    } catch {
      // Sin lista de carreras el alumno todavía puede subir su programa; que
      // falle la consulta no puede dejarlo sin camino.
      return []
    } finally {
      setLoadingData(false)
    }
  }

  const fetchGrades = async (n: Nivel, c = '') => {
    setLoadingData(true)
    try {
      const res = await fetch(`/api/curriculum/grades?nivel=${encodeURIComponent(n)}${carreraParam(c)}`)
      const data = await res.json()
      setGrades(data.grades ?? [])
    } finally {
      setLoadingData(false)
    }
  }

  const fetchSubjects = async (n: Nivel, g: string, c = '') => {
    setLoadingData(true)
    try {
      const res = await fetch(
        `/api/curriculum/subjects?nivel=${encodeURIComponent(n)}&grado=${encodeURIComponent(g)}${carreraParam(c)}`
      )
      const data = await res.json()
      setSubjects(data.subjects ?? [])
    } finally {
      setLoadingData(false)
    }
  }

  const fetchTopics = async (n: Nivel, g: string, m: string, c = '') => {
    setLoadingData(true)
    try {
      const res = await fetch(
        `/api/curriculum/topics?nivel=${encodeURIComponent(n)}&grado=${encodeURIComponent(g)}&materia=${encodeURIComponent(m)}${carreraParam(c)}`
      )
      const data = await res.json()
      setAxes(data.axes ?? [])
      setSelected({})
    } finally {
      setLoadingData(false)
    }
  }

  // Pre-seeded return visit: skip straight to materia, fetching subjects
  // for the saved nivel/grado immediately instead of waiting for a click.
  // El alumno de Superior arranca en la carrera (ver `isSuperiorPreseed`), así
  // que lo que se precarga ahí es la lista de carreras, no la de materias.
  useEffect(() => {
    if (hasPreseed) {
      fetchSubjects(initialNivel!, initialGrado!)
      return
    }
    if (isSuperiorPreseed) {
      fetchCareers('Superior').then((list) => {
        setCareers(list)
        setSuperiorPath(list.length > 0 ? null : 'propio')
        if (list.length === 0) setStep('superior-form')
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Step handlers ──────────────────────────────────────────────────────────

  const handleNivel = async (n: Nivel) => {
    setNivel(n)
    setGrado('')
    setMateria('')
    setCarrera('')
    setAxes([])
    setSelected({})
    if (n === 'Superior') {
      const list = await fetchCareers(n)
      setCareers(list)
      setSuperiorPath(list.length > 0 ? null : 'propio')
      // Sin ninguna carrera cargada, el paso intermedio no ofrecería más que un
      // único botón: se saltea directo al flujo de subir el programa, que es
      // exactamente el comportamiento anterior a la migración 022.
      setStep(list.length > 0 ? 'superior-carrera' : 'superior-form')
    } else {
      fetchGrades(n)
      setStep('grado')
    }
  }

  /** Camino precargado: la carrera sale de `curriculum`, no la escribe el alumno. */
  const handleCarrera = (c: string) => {
    setSuperiorPath('precargado')
    setCarrera(c)
    setGrado('')
    setMateria('')
    setAxes([])
    setSelected({})
    fetchGrades('Superior', c)
    setStep('grado')
  }

  const handleGrado = (g: string) => {
    setGrado(g)
    setMateria('')
    setAxes([])
    setSelected({})
    fetchSubjects(nivel!, g, carrera)
    setStep('materia')
  }

  const handleMateria = (m: string) => {
    setMateria(m)
    setAxes([])
    setSelected({})
    fetchTopics(nivel!, grado, m, carrera)
    setStep('topics')
  }

  // ─── Superior custom flow ────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadedFile(file)
    setUploadError(null)
    setParsedUnits([])
    setUploadLoading(true)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/curriculum/parse-program', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al procesar el archivo')
      const units = data.units ?? []
      setParsedUnits(units)
      // Seed axes from parsed units so the topics step can show them
      setAxes(units.map((u: { name: string; topics: { name: string }[] }) => ({
        eje: u.name,
        temas: u.topics.map((t: { name: string }) => t.name),
      })))
      setSelected({})
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleSuperiorContinue = () => {
    if (!carrera.trim()) return
    setSuperiorPath('propio')
    setMateria(carrera)
    setGrado(anioCarrera || 'No especificado')
    setStep('topics')
  }

  // ─── Checkbox logic ─────────────────────────────────────────────────────────

  const topicKey = (eje: string, tema: string) => `${eje}||${tema}`

  const toggleTema = (eje: string, tema: string) => {
    const k = topicKey(eje, tema)
    setSelected((prev) => ({ ...prev, [k]: !prev[k] }))
  }

  const ejeState = (eje: Eje): 'all' | 'some' | 'none' => {
    const checked = eje.temas.filter((t) => selected[topicKey(eje.eje, t)])
    if (checked.length === 0) return 'none'
    if (checked.length === eje.temas.length) return 'all'
    return 'some'
  }

  const toggleEje = (eje: Eje) => {
    const state = ejeState(eje)
    const next = state === 'all' ? false : true
    setSelected((prev) => {
      const updated = { ...prev }
      for (const t of eje.temas) {
        updated[topicKey(eje.eje, t)] = next
      }
      return updated
    })
  }

  const selectedCount = Object.values(selected).filter(Boolean).length

  const buildTopicList = () => {
    const list: CurriculumSelection['selectedTopics'] = []
    for (const ax of axes) {
      for (const t of ax.temas) {
        if (selected[topicKey(ax.eje, t)]) {
          list.push({ id: `${ax.eje}-${t}`.toLowerCase().replace(/\s+/g, '-'), name: t, eje: ax.eje })
        }
      }
    }
    return list
  }

  const handleConfirmTopics = () => {
    if (selectedCount === 0) return
    setStep('params')
  }

  const handleStart = () => {
    onStartQuiz({
      nivel: nivel!,
      grado,
      materia,
      carrera,
      selectedTopics: buildTopicList(),
      mode,
      questionCount,
      difficulty,
      questionTypes,
    })
  }

  /**
   * Migas de los pasos finales. La carrera va acá y no en el nombre de la
   * materia: es lo que le confirma al alumno que "Matemática" es la de SU
   * carrera y no una materia suelta de nivel Superior.
   */
  const breadcrumb = [
    nivel,
    carrera || null,
    nivel === 'Primario' ? grado.replace(/Año/gi, 'Grado') : grado,
  ]
    .filter(Boolean)
    .join(' · ')

  // ─── Back navigation ─────────────────────────────────────────────────────────

  const goBack = () => {
    if (step === 'grado') {
      // En Superior el paso anterior a 'grado' es la carrera, no el nivel.
      setStep(nivel === 'Superior' ? 'superior-carrera' : 'nivel')
      setGrades([])
    }
    else if (step === 'materia') {
      setStep('grado')
      setSubjects([])
      // If we skipped straight to 'materia' via a pre-seeded nivel/grado, the
      // 'grado' step never fetched its list — fetch it now so going back works.
      if (grades.length === 0 && nivel) fetchGrades(nivel, carrera)
    }
    else if (step === 'superior-carrera') { setStep('nivel'); setCareers([]) }
    // Con carreras cargadas el paso anterior es la bifurcación; sin ellas se
    // llegó salteándola, así que volver tiene que llevar al nivel.
    else if (step === 'superior-form') { setStep(careers.length > 0 ? 'superior-carrera' : 'nivel') }
    // 'topics' vuelve a donde se eligieron los temas, que difiere según el
    // camino: la materia en el precargado, el formulario en el propio.
    else if (step === 'topics') {
      setStep(superiorPath === 'propio' ? 'superior-form' : 'materia')
      setAxes([])
      setSelected({})
    }
    else if (step === 'params') { setStep('topics') }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <MathBackground />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">

        {/* Back button */}
        {step !== 'nivel' ? (
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
        ) : (
          onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Dashboard
            </button>
          )
        )}

        {/* ── STEP: Nivel ─────────────────────────────────────────────────── */}
        {step === 'nivel' && (
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">¿Qué nivel querés trabajar?</h1>
            <p className="text-muted-foreground text-sm mb-8">Seleccioná el nivel educativo para comenzar.</p>

            <div className="grid gap-4">
              {NIVEL_OPTIONS.map(({ value, label, sub, Icon, color }) => (
                <button
                  key={value}
                  onClick={() => handleNivel(value)}
                  className="flex items-center gap-5 p-5 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-md transition-all duration-200 active:scale-95 text-left"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: Carrera (Superior) ────────────────────────────────────── */}
        {step === 'superior-carrera' && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Nivel Superior</p>
            <h1 className="text-2xl font-bold text-foreground mb-1">¿Qué carrera cursás?</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Elegí tu carrera para ver las materias de su plan de estudios.
            </p>

            {loadingData ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid gap-3">
                {careers.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCarrera(c)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all active:scale-95 text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <span className="flex-1 font-semibold text-sm text-foreground">{c}</span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}

            {/* Escape hatch: el flujo que existía antes de que hubiera carreras
                precargadas sigue disponible para quien no está en la lista. */}
            <button
              onClick={() => {
                setSuperiorPath('propio')
                setCarrera('')
                setStep('superior-form')
              }}
              className="mt-6 w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary transition-all"
            >
              <Upload className="w-4 h-4" />
              Mi carrera no está en la lista — subir mi programa
            </button>
          </div>
        )}

        {/* ── STEP: Grado ─────────────────────────────────────────────────── */}
        {step === 'grado' && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
              {nivel === 'Superior' && carrera ? `${nivel} · ${carrera}` : nivel}
            </p>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {nivel === 'Primario' ? '¿Qué grado?' : '¿Qué año?'}
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              {nivel === 'Primario' ? 'Elegí el grado para ver las materias disponibles.' : 'Elegí el año para ver las materias disponibles.'}
            </p>

            {loadingData ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : grades.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No hay contenidos cargados para este nivel todavía.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {grades.map((g) => (
                  <button
                    key={g}
                    onClick={() => handleGrado(g)}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 font-semibold text-sm text-foreground transition-all active:scale-95"
                  >
                    {nivel === 'Primario' ? g.replace(/Año/gi, 'Grado') : g}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Materia ────────────────────────────────────────────────── */}
        {step === 'materia' && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
              {breadcrumb}
            </p>
            <h1 className="text-2xl font-bold text-foreground mb-1">¿Qué materia?</h1>
            <p className="text-muted-foreground text-sm mb-8">Seleccioná la materia para ver los ejes y temas.</p>

            {loadingData ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : subjects.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No hay materias cargadas para este nivel todavía.</p>
            ) : (
              <div className="grid gap-3">
                {subjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleMateria(s)}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 font-semibold text-sm text-foreground transition-all active:scale-95"
                  >
                    {s}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Topics (Ejes + Temas checkboxes) ───────────────────────── */}
        {step === 'topics' && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
              {breadcrumb} · {materia}
            </p>
            <h1 className="text-2xl font-bold text-foreground mb-1">Seleccioná los temas</h1>
            <p className="text-muted-foreground text-sm mb-6">Elegí uno o más temas. Podés seleccionar ejes completos.</p>

            {loadingData ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : axes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">No hay temas cargados para esta materia todavía.</p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {axes.map((ax) => {
                    const state = ejeState(ax)
                    return (
                      <div key={ax.eje} className="border border-border rounded-xl overflow-hidden">
                        {/* Eje header */}
                        <button
                          onClick={() => toggleEje(ax)}
                          className="flex items-center gap-3 w-full px-4 py-3 bg-secondary/50 hover:bg-secondary transition-colors text-left"
                        >
                          <span className="flex-shrink-0 text-primary">
                            {state === 'all' ? (
                              <CheckSquare className="w-5 h-5" />
                            ) : state === 'some' ? (
                              <Minus className="w-5 h-5" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground" />
                            )}
                          </span>
                          <span className="font-semibold text-sm text-foreground flex-1">{ax.eje}</span>
                          <span className="text-xs text-muted-foreground">
                            {ax.temas.filter((t) => selected[topicKey(ax.eje, t)]).length}/{ax.temas.length}
                          </span>
                        </button>

                        {/* Temas */}
                        <div className="divide-y divide-border/50">
                          {ax.temas.map((tema) => {
                            const k = topicKey(ax.eje, tema)
                            const checked = !!selected[k]
                            return (
                              <button
                                key={k}
                                onClick={() => toggleTema(ax.eje, tema)}
                                className={cn(
                                  'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                                  checked ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-secondary/40'
                                )}
                              >
                                <span className="flex-shrink-0">
                                  {checked ? (
                                    <CheckSquare className="w-4 h-4 text-primary" />
                                  ) : (
                                    <Square className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </span>
                                <span className={cn('text-sm', checked ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                  {tema}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Sticky confirm bar */}
                <div className="sticky bottom-4 flex items-center justify-between gap-4 p-4 bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-lg">
                  <span className="text-sm text-muted-foreground">
                    {selectedCount === 0 ? 'Ningún tema seleccionado' : `${selectedCount} tema${selectedCount > 1 ? 's' : ''} seleccionado${selectedCount > 1 ? 's' : ''}`}
                  </span>
                  <button
                    onClick={handleConfirmTopics}
                    disabled={selectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                  >
                    Configurar cuestionario
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP: Superior custom form ────────────────────────────── */}
        {step === 'superior-form' && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Nivel Superior / Terciario</p>
            <h1 className="text-2xl font-bold text-foreground mb-1">Datos de la carrera</h1>
            <p className="text-muted-foreground text-sm mb-8">
              Ingresá la carrera y subí el programa de la materia en PDF o Word.
            </p>

            <div className="space-y-5 mb-6">
              {/* Carrera */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Nombre de la carrera <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={carrera}
                  onChange={(e) => setCarrera(e.target.value)}
                  placeholder="Ej: Ingeniería en Sistemas, Licenciatura en Enfermería..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>

              {/* Año */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Año de la carrera
                </label>
                <input
                  type="text"
                  value={anioCarrera}
                  onChange={(e) => setAnioCarrera(e.target.value)}
                  placeholder="Ej: 1er año, 3er año..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                />
              </div>

              {/* Programa (PDF/DOCX) */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Programa de la materia (PDF o Word)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadLoading}
                  className={cn(
                    'w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all',
                    uploadedFile && !uploadError
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {uploadLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Procesando con IA...</span></>
                  ) : uploadedFile && !uploadError ? (
                    <><FileText className="w-4 h-4" /><span className="text-sm font-medium">{uploadedFile.name}</span></>
                  ) : (
                    <><Upload className="w-4 h-4" /><span className="text-sm">Subir programa (PDF, DOCX, DOC)</span></>
                  )}
                </button>

                {uploadError && (
                  <p className="mt-2 text-xs text-destructive">{uploadError}</p>
                )}
                {parsedUnits.length > 0 && (
                  <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ {parsedUnits.length} unidades · {parsedUnits.reduce((s, u) => s + u.topics.length, 0)} temas detectados
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleSuperiorContinue}
              disabled={!carrera.trim() || (!!uploadedFile && uploadLoading)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {parsedUnits.length > 0 ? 'Seleccionar temas' : 'Continuar sin programa'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP: Params ─────────────────────────────────────────────────── */}
        {step === 'params' && (
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Settings2 className="w-5 h-5 text-primary" />
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Configuración</p>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Parámetros del cuestionario</h1>
            {nivel !== 'Superior' && (
              <p className="text-muted-foreground text-sm mb-8">
                {selectedCount} tema{selectedCount !== 1 ? 's' : ''} de <strong>{materia}</strong> · {nivel === 'Primario' ? grado.replace(/Año/gi, 'Grado') : grado} · {nivel}
              </p>
            )}

            <div className="space-y-6 mb-8">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">Tipo de cuestionario</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['teorico', 'practico', 'mixto'] as QuizMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        'p-3 rounded-xl border text-sm font-semibold capitalize transition-all',
                        mode === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cantidad */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">
                  Cantidad de preguntas: <span className="text-primary">{questionCount}</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 15, 20, 30, 40].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={cn(
                        'w-12 h-10 rounded-xl border text-sm font-bold transition-all',
                        questionCount === n
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dificultad */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">Dificultad</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['basico', 'intermedio', 'avanzado'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        'p-3 rounded-xl border text-sm font-semibold capitalize transition-all',
                        difficulty === d
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                      )}
                    >
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipos de pregunta */}
              <div>
                <label className="block text-sm font-semibold text-foreground mb-3">Tipos de pregunta</label>
                <QuestionTypeSelector value={questionTypes} onChange={setQuestionTypes} />
              </div>
            </div>

            {/* CTA diferenciado por rol */}
            <div className="space-y-3">
              {isDocente ? (
                <button
                  onClick={handleStart}
                  className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg hover:bg-primary/90 transition-all active:scale-95"
                >
                  Generar Cuestionario
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-lg hover:bg-primary/90 transition-all active:scale-95"
                >
                  Realizar Cuestionario
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
