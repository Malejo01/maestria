'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { NIVEL_OPTIONS } from '@/lib/nivel-options'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'
import { SUBJECT_ICON_OPTIONS } from '@/lib/subject-appearance'
import { SUBJECT_ICON_COMPONENTS } from '@/lib/subject-icons'
import { Boton } from '@/components/sistema/boton'
import { ProgramFileImport, type ProgramSourceMeta } from '@/components/program-file-import'
import { elegirGrado, ordenDePasos, pasoVecino, puedeLlegarA, type NivelSugerido, type PasoId } from '@/lib/wizard-temario'
import { WIZARD_TEMARIO } from '@/lib/textos'
import type {
  Nivel,
  PedagogyProfile,
  ProgramCreatedFrom,
  ProgramUnit,
  SubjectColorName,
  SubjectIconName,
  TeacherProgram,
} from '@/lib/types'

interface TeacherSubjectWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProgramCreated: (program: TeacherProgram) => void
  onProgramUpdated?: (program: TeacherProgram) => void
  programToEdit?: TeacherProgram | null
  initialPath?: 'import' | 'curriculum' | 'manual' | null
}

interface CurriculumAxis {
  eje: string
  temas: string[]
}

// Los pasos se identifican por su contenido (1 = nivel y año, 2 = materia,
// 3 = temario, 4 = cómo das la materia), no por su posición: el ORDEN en que
// aparecen depende de cómo se arma el temario. Ver lib/wizard-temario.ts.
type StepId = PasoId

const STEP_LABEL: Record<StepId, string> = WIZARD_TEMARIO.pasos

/**
 * The methodology used to ship prefilled with a generic sentence, so every
 * materia ended up telling the AI the same thing and no teacher ever noticed
 * the field. It is now asked for explicitly — see LEGACY_DEFAULT_METHODOLOGY.
 */
const DEFAULT_PEDAGOGY: PedagogyProfile = {
  level: '',
  degree: '',
  academicYear: '',
  complexity: 'Intermedia',
  assessmentStyle: 'mixto',
  methodology: '',
}

/**
 * Sentences that landed in `methodology` because something filled the field in,
 * not because a teacher wrote them: the old wizard default, and the stub the
 * quiz flow writes when it auto-creates a materia. Opening such a materia for
 * editing blanks the field so the teacher gets asked, instead of silently
 * confirming — and feeding the AI — a text they never chose.
 */
const AUTOFILLED_METHODOLOGIES = new Set([
  'práctica guiada con ejercicios resueltos paso a paso y consignas de dificultad creciente.',
  'generado desde currícula oficial',
  'generado desde curricula oficial',
])

/**
 * Qué le prometimos al docente en el tour de bienvenida, para repetírselo
 * mientras completa los pasos previos. El texto está en futuro a propósito:
 * describe lo que va a pasar en el paso 3, no lo que está pasando ahora.
 */

const COMPLEXITY_OPTIONS = ['Básica', 'Intermedia', 'Avanzada']

const ASSESSMENT_OPTIONS: { value: PedagogyProfile['assessmentStyle']; label: string }[] = [
  { value: 'teorico', label: 'Teórico' },
  { value: 'practico', label: 'Práctico' },
  { value: 'mixto', label: 'Mixto' },
]

function normalizeTopicKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Una lista que se pide al servidor y que depende de lo que el docente eligió
 * antes: los años dependen del nivel, las materias del nivel y el año, los ejes
 * de la materia. `url` en `null` significa "todavía no hay con qué pedirla".
 *
 * La respuesta se guarda JUNTO con la URL que la produjo, y sólo se expone si
 * esa URL sigue siendo la vigente. Eso resuelve dos cosas a la vez:
 *
 *  - Vaciar la lista deja de ser una escritura de estado. Antes cada uno de
 *    estos efectos empezaba con un `setGrades([])` sincrónico en la rama de
 *    guarda, que es exactamente lo que marca `react-hooks/set-state-in-effect`;
 *    ahora la lista vacía es una consecuencia de que la clave cambió.
 *  - Arregla un parpadeo real: al cambiar de nivel, los años del nivel anterior
 *    seguían en pantalla hasta que llegaba el fetch nuevo. Durante esos cientos
 *    de milisegundos el docente podía elegir un año que no existe para el nivel
 *    que acababa de elegir.
 */
function useCurriculumLookup<T>(url: string | null, field: string): { data: T[]; isLoading: boolean } {
  const [cache, setCache] = useState<{ url: string | null; data: T[] }>({ url: null, data: [] })

  useEffect(() => {
    if (!url) return

    let isMounted = true

    fetch(url)
      .then((res) => res.json())
      .then((json: unknown) => {
        if (!isMounted) return
        const value = (json as Record<string, unknown>)?.[field]
        setCache({ url, data: Array.isArray(value) ? (value as T[]) : [] })
      })
      .catch(() => {
        // Se cachea el fallo con su URL igual que un éxito vacío: si no, la
        // lista queda "cargando" para siempre y el paso no se puede completar.
        if (isMounted) setCache({ url, data: [] })
      })

    return () => {
      isMounted = false
    }
  }, [url, field])

  return {
    data: cache.url === url ? cache.data : [],
    isLoading: url !== null && cache.url !== url,
  }
}

export function TeacherSubjectWizard({
  open,
  onOpenChange,
  onProgramCreated,
  onProgramUpdated,
  programToEdit = null,
  initialPath = null,
}: TeacherSubjectWizardProps) {
  const { toast } = useToast()
  const isEditing = Boolean(programToEdit)

  // Generated ids must be unique against the ids the loaded materia ALREADY
  // carries. The counter used to restart at 0 on every open, so editing a
  // materia whose topics were saved as t-1, t-2… and then adding a topic
  // minted t-1 again: React reported "two children with the same key" and,
  // worse, could reconcile the wrong topic. Keeping the set of ids in play and
  // skipping over any collision makes that impossible by construction.
  const idCounter = useRef(0)
  const usedIds = useRef<Set<string>>(new Set())
  const nextId = useCallback((prefix: string) => {
    let candidate: string
    do {
      idCounter.current += 1
      candidate = `${prefix}-${idCounter.current}`
    } while (usedIds.current.has(candidate))
    usedIds.current.add(candidate)
    return candidate
  }, [])

  /**
   * Takes the units of a materia being edited and hands back the same units
   * with guaranteed-unique ids, re-minting only the ones that are missing or
   * already taken. This also repairs materias that were saved back when the
   * counter collided, so an existing duplicate does not survive the round trip.
   */
  const adoptUnits = useCallback((loaded: ProgramUnit[]): ProgramUnit[] => {
    const seen = new Set<string>()
    const claim = (id: string | undefined) => {
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    }

    // First pass claims every id that is free, so the second pass cannot mint
    // an id that a later unit or topic legitimately owns.
    const decided = loaded.map((unit) => ({
      unit,
      keepUnitId: claim(unit.id),
      keepTopicIds: (unit.topics ?? []).map((topic) => claim(topic.id)),
    }))

    usedIds.current = seen
    idCounter.current = 0

    return decided.map(({ unit, keepUnitId, keepTopicIds }) => ({
      ...unit,
      id: keepUnitId ? unit.id : nextId('u'),
      topics: (unit.topics ?? []).map((topic, index) => ({
        ...topic,
        id: keepTopicIds[index] ? topic.id : nextId('t'),
      })),
    }))
  }, [nextId])

  const [step, setStep] = useState<StepId>(1)
  const orden = useMemo(() => ordenDePasos(initialPath, isEditing), [initialPath, isEditing])
  /** Nivel y año que MaestrIA leyó del archivo. El docente lo confirma o lo cambia. */
  const [sugerido, setSugerido] = useState<NivelSugerido | null>(null)

  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [grado, setGrado] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [iconName, setIconName] = useState<SubjectIconName>('book-open')
  const [colorName, setColorName] = useState<SubjectColorName>('teal')
  const [units, setUnits] = useState<ProgramUnit[]>([])
  const [pedagogy, setPedagogy] = useState<PedagogyProfile>(DEFAULT_PEDAGOGY)
  const [sourceMeta, setSourceMeta] = useState<ProgramSourceMeta | null>(null)

  /**
   * Qué materia del diseño curricular se está mirando en el paso 3.
   *
   * `null` no es lo mismo que `''`: `null` significa "el docente todavía no
   * eligió, usá la coincidencia automática", y `''` significa "eligió no mirar
   * ninguna". Antes esa diferencia no existía y la cubría un efecto que hacía
   * `setBrowseMateria(match)` — un `setState` sincrónico dentro de un efecto,
   * que es estado derivado escrito a mano. Ahora la coincidencia se calcula
   * (ver `browseMateria` más abajo) y el estado guarda sólo la decisión humana.
   */
  const [browseMateriaChoice, setBrowseMateriaChoice] = useState<string | null>(null)
  const [collapsedAxes, setCollapsedAxes] = useState<string[]>([])
  const [topicSearch, setTopicSearch] = useState('')

  const [activeUnitId, setActiveUnitId] = useState<string | null>(null)
  const [customTopicDraft, setCustomTopicDraft] = useState<Record<string, string>>({})
  const [showFileImport, setShowFileImport] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // Two collapsible ways to grow "Tu temario": start open on curriculum since
  // most teachers begin from the official design, closed on custom since it's
  // only needed once they diverge from it.
  const [showCurriculumSection, setShowCurriculumSection] = useState(true)
  const [showCustomSection, setShowCustomSection] = useState(false)

  // ─── Load / reset when the dialog opens ────────────────────────────────────
  useEffect(() => {
    if (!open) return

    if (programToEdit) {
      setNivel(programToEdit.nivel ?? null)
      setGrado(programToEdit.grado ?? '')
      setSubjectName(programToEdit.subjectName)
      setIconName(programToEdit.iconName)
      setColorName(programToEdit.colorName)
      setUnits(adoptUnits(Array.isArray(programToEdit.units) ? programToEdit.units : []))
      const loadedPedagogy = { ...DEFAULT_PEDAGOGY, ...programToEdit.pedagogyProfile }
      if (AUTOFILLED_METHODOLOGIES.has(normalizeTopicKey(loadedPedagogy.methodology ?? ''))) {
        loadedPedagogy.methodology = ''
      }
      setPedagogy(loadedPedagogy)
      // Programs from before migration 014 have no nivel/grado: start on step 1
      // so the teacher fills the gap, otherwise jump straight to the topics.
      setStep(programToEdit.nivel && programToEdit.grado ? 3 : 1)
      // Editando: la materia guardada es una elección explícita, no una
      // coincidencia a adivinar.
      setBrowseMateriaChoice(programToEdit.subjectName)
    } else {
      setNivel(null)
      setGrado('')
      setSubjectName('')
      setIconName('book-open')
      setColorName('teal')
      usedIds.current = new Set()
      idCounter.current = 0
      setUnits([])
      setPedagogy(DEFAULT_PEDAGOGY)
      setStep(ordenDePasos(initialPath, false)[0])
      // `null`, no `''`: materia nueva, que la coincidencia automática vuelva a
      // correr en cuanto el docente escriba el nombre.
      setBrowseMateriaChoice(null)
    }

    setSourceMeta(null)
    setSugerido(null)
    setActiveUnitId(null)
    setCustomTopicDraft({})
    setTopicSearch('')
    setCollapsedAxes([])

    if (!programToEdit && initialPath === 'import') {
      setShowCurriculumSection(false)
      setShowCustomSection(true)
      setShowFileImport(true)
    } else if (!programToEdit && initialPath === 'manual') {
      setShowCurriculumSection(false)
      setShowCustomSection(true)
      setShowFileImport(false)
    } else {
      setShowCurriculumSection(true)
      setShowCustomSection(false)
      setShowFileImport(false)
    }
  }, [open, programToEdit, adoptUnits, initialPath])

  // ─── Curriculum lookups ────────────────────────────────────────────────────
  // Las tres son la misma forma: una URL que existe sólo cuando están todos sus
  // insumos, y una lista que se vacía sola cuando dejan de estar. Ver
  // `useCurriculumLookup`.
  const { data: grades, isLoading: isLoadingGrades } = useCurriculumLookup<string>(
    open && nivel ? `/api/curriculum/grades?nivel=${encodeURIComponent(nivel)}` : null,
    'grades'
  )

  const { data: curriculumSubjects } = useCurriculumLookup<string>(
    open && nivel && grado
      ? `/api/curriculum/subjects?nivel=${encodeURIComponent(nivel)}&grado=${encodeURIComponent(grado)}`
      : null,
    'subjects'
  )

  // Lo que se leyó del archivo se propone, nunca se impone: sólo llena lo que
  // el docente todavía no eligió.
  const recibirSugerencia = useCallback(
    (sugerencia: NivelSugerido | null) => {
      if (!sugerencia || isEditing) return
      setSugerido(sugerencia)
      setNivel((actual) => actual ?? sugerencia.nivel)
    },
    [isEditing],
  )

  useEffect(() => {
    if (!sugerido || grado || nivel !== sugerido.nivel || isLoadingGrades) return
    const elegido = elegirGrado(sugerido.grado, grades)
    if (elegido) setGrado(elegido)
    // `grado` se omite a propósito: si el docente lo borra, no se lo volvemos a poner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerido, nivel, grades, isLoadingGrades])

  // When the curriculum offers exactly the subject the teacher named, browse it
  // by default so step 3 opens with topics already on screen. Es un cálculo, no
  // un estado: depende sólo de la lista que volvió del servidor y del nombre que
  // escribió el docente.
  const browseMateria = useMemo(() => {
    if (browseMateriaChoice !== null) return browseMateriaChoice

    return (
      curriculumSubjects.find(
        (materia) => normalizeTopicKey(materia) === normalizeTopicKey(subjectName)
      ) ?? ''
    )
  }, [browseMateriaChoice, curriculumSubjects, subjectName])

  const { data: axes, isLoading: isLoadingAxes } = useCurriculumLookup<CurriculumAxis>(
    open && nivel && grado && browseMateria
      ? `/api/curriculum/topics?${new URLSearchParams({ nivel, grado, materia: browseMateria }).toString()}`
      : null,
    'axes'
  )

  // ─── Unit / topic editing ──────────────────────────────────────────────────
  const addedTopicKeys = useMemo(() => {
    const keys = new Set<string>()
    units.forEach((unit) => unit.topics.forEach((topic) => keys.add(normalizeTopicKey(topic.name))))
    return keys
  }, [units])

  const addCurriculumTopic = (temaName: string, eje: string) => {
    if (addedTopicKeys.has(normalizeTopicKey(temaName))) return

    const topic = { id: nextId('t'), name: temaName, origin: 'curriculum' as const, sourceEje: eje }

    // No units yet: the first pick creates the unit it lands in.
    if (units.length === 0) {
      const created: ProgramUnit = { id: nextId('u'), name: 'Unidad 1', topics: [topic] }
      setUnits([created])
      setActiveUnitId(created.id)
      return
    }

    const targetId = units.some((unit) => unit.id === activeUnitId) ? activeUnitId : units[0].id
    setUnits((prev) =>
      prev.map((unit) => (unit.id === targetId ? { ...unit, topics: [...unit.topics, topic] } : unit))
    )
  }

  const addAxisAsUnit = (axis: CurriculumAxis) => {
    const pending = axis.temas.filter((tema) => !addedTopicKeys.has(normalizeTopicKey(tema)))

    if (pending.length === 0) {
      toast({ title: 'Sin temas nuevos', description: `Ya agregaste todos los temas de "${axis.eje}".` })
      return
    }

    const created: ProgramUnit = {
      id: nextId('u'),
      name: axis.eje,
      topics: pending.map((tema) => ({
        id: nextId('t'),
        name: tema,
        origin: 'curriculum' as const,
        sourceEje: axis.eje,
      })),
    }

    setUnits((prev) => [...prev, created])
    setActiveUnitId(created.id)
  }

  const addEmptyUnit = () => {
    const created: ProgramUnit = { id: nextId('u'), name: '', topics: [] }
    setUnits((prev) => [...prev, created])
    setActiveUnitId(created.id)
  }

  const renameUnit = (unitId: string, name: string) => {
    setUnits((prev) => prev.map((unit) => (unit.id === unitId ? { ...unit, name } : unit)))
  }

  const removeUnit = (unitId: string) => {
    setUnits((prev) => prev.filter((unit) => unit.id !== unitId))
    setActiveUnitId((prev) => (prev === unitId ? null : prev))
  }

  const moveUnit = (unitId: string, direction: -1 | 1) => {
    setUnits((prev) => {
      const index = prev.findIndex((unit) => unit.id === unitId)
      const target = index + direction
      if (index < 0 || target < 0 || target >= prev.length) return prev

      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const removeTopic = (unitId: string, topicId: string) => {
    setUnits((prev) =>
      prev.map((unit) =>
        unit.id === unitId ? { ...unit, topics: unit.topics.filter((topic) => topic.id !== topicId) } : unit
      )
    )
  }

  const addCustomTopic = (unitId: string) => {
    const name = (customTopicDraft[unitId] ?? '').trim()
    if (!name) return

    if (addedTopicKeys.has(normalizeTopicKey(name))) {
      toast({ title: 'Tema repetido', description: `"${name}" ya está en tu temario.` })
      return
    }

    setUnits((prev) =>
      prev.map((unit) =>
        unit.id === unitId
          ? { ...unit, topics: [...unit.topics, { id: nextId('t'), name, origin: 'custom' as const }] }
          : unit
      )
    )
    setCustomTopicDraft((prev) => ({ ...prev, [unitId]: '' }))
  }

  /**
   * Units coming from a document are merged, never substituted: by the time a
   * teacher imports a file they may already have curated topics by hand.
   */
  const mergeSuggestedUnits = (suggested: ProgramUnit[], anchorUnitName?: string) => {
    const rekeyed = suggested.map((unit) => ({
      id: nextId('u'),
      name: unit.name,
      topics: unit.topics
        .filter((topic) => !addedTopicKeys.has(normalizeTopicKey(topic.name)))
        .map((topic) => ({ id: nextId('t'), name: topic.name, origin: 'custom' as const })),
    }))

    setUnits((prev) => {
      if (!anchorUnitName) return [...prev, ...rekeyed]

      const anchorIndex = prev.findIndex(
        (unit) => normalizeTopicKey(unit.name) === normalizeTopicKey(anchorUnitName)
      )
      if (anchorIndex < 0) return [...prev, ...rekeyed]

      return [...prev.slice(0, anchorIndex + 1), ...rekeyed, ...prev.slice(anchorIndex + 1)]
    })
  }

  // ─── Step validation ───────────────────────────────────────────────────────
  const stepBlockers: Record<StepId, string | null> = useMemo(() => {
    const cleanUnits = units.filter((unit) => unit.name.trim() && unit.topics.length > 0)

    return {
      1: !nivel ? 'Elegí un nivel.' : !grado.trim() ? 'Elegí el año o grado.' : null,
      2: !subjectName.trim() ? 'Escribí el nombre de la materia.' : null,
      3:
        cleanUnits.length === 0
          ? 'Armá al menos una unidad con nombre y un tema adentro.'
          : units.some((unit) => !unit.name.trim())
            ? 'Hay unidades sin nombre.'
            : units.some((unit) => unit.topics.length === 0)
              ? 'Hay unidades sin temas.'
              : null,
      4:
        nivel === 'Superior' && !pedagogy.degree.trim()
          ? 'Indicá la carrera.'
          : !pedagogy.complexity.trim()
            ? 'Elegí la complejidad.'
            : !pedagogy.methodology.trim()
              ? 'Contanos tu metodología de enseñanza: es lo que hace que los cuestionarios se parezcan a tus clases.'
              : null,
    }
  }, [nivel, grado, subjectName, units, pedagogy])

  const canReachStep = (target: StepId): boolean => puedeLlegarA(orden, stepBlockers, target)
  const anterior = pasoVecino(orden, step, -1)
  const siguiente = pasoVecino(orden, step, 1)

  const goToStep = (target: StepId) => {
    if (!canReachStep(target)) {
      toast({ title: 'Falta completar un paso', description: stepBlockers[step] ?? 'Revisá los pasos anteriores.' })
      return
    }
    setStep(target)
  }

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const blocker = ([1, 2, 3, 4] as StepId[]).map((id) => stepBlockers[id]).find(Boolean)
    if (blocker) {
      toast({ title: 'No se puede guardar todavía', description: blocker })
      return
    }

    setIsSaving(true)

    const cleanUnits: ProgramUnit[] = units
      .map((unit) => ({
        id: unit.id,
        name: unit.name.trim(),
        topics: unit.topics
          .map((topic) => ({ ...topic, name: topic.name.trim() }))
          .filter((topic) => topic.name.length > 0),
      }))
      .filter((unit) => unit.name.length > 0 && unit.topics.length > 0)

    const usesCurriculum = cleanUnits.some((unit) => unit.topics.some((topic) => topic.origin === 'curriculum'))
    const createdFrom: ProgramCreatedFrom = usesCurriculum ? 'curriculum' : sourceMeta ? 'upload' : 'manual'

    try {
      const response = await fetch(
        isEditing ? `/api/teacher/programs/${programToEdit?.id}` : '/api/teacher/programs',
        {
          method: isEditing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectName: subjectName.trim(),
            iconName,
            colorName,
            nivel,
            grado: grado.trim(),
            jurisdiccion: DEFAULT_JURISDICTION,
            createdFrom,
            pedagogyProfile: {
              ...pedagogy,
              level: nivel ?? pedagogy.level,
              academicYear: grado.trim() || pedagogy.academicYear,
            },
            units: cleanUnits,
            sourceFileName: sourceMeta?.sourceFileName ?? null,
            sourceMimeType: sourceMeta?.sourceMimeType ?? null,
            sourceFileSizeBytes: sourceMeta?.sourceFileSizeBytes ?? null,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) {
        const detailMessage = data?.details ? ` (${data.details})` : ''
        throw new Error(`${data.error || 'No se pudo guardar la materia'}${detailMessage}`)
      }

      const saved = data.program
      const normalizedProgram: TeacherProgram = {
        id: Number(saved.id),
        userId: saved.user_id,
        subjectName: saved.subject_name,
        iconName: saved.icon_name || iconName,
        colorName: saved.color_name || colorName,
        pedagogyProfile: saved.pedagogy_profile,
        units: saved.units,
        sourceFileName: saved.source_file_name ?? null,
        createdAt: saved.created_at,
        nivel: (saved.nivel ?? nivel) as Nivel | null,
        grado: saved.grado ?? grado.trim(),
        jurisdiccion: saved.jurisdiccion ?? DEFAULT_JURISDICTION,
        createdFrom: (saved.created_from ?? createdFrom) as ProgramCreatedFrom,
      }

      if (isEditing && onProgramUpdated) {
        onProgramUpdated(normalizedProgram)
      } else {
        onProgramCreated(normalizedProgram)
      }

      toast({
        title: isEditing ? 'Materia actualizada' : 'Materia creada',
        description: `${normalizedProgram.subjectName} · ${cleanUnits.length} unidades listas para generar cuestionarios.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({ title: 'Error al guardar', description: error instanceof Error ? error.message : 'Error desconocido' })
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────
  const SelectedIcon = SUBJECT_ICON_COMPONENTS[iconName]
  const topicCount = units.reduce((total, unit) => total + unit.topics.length, 0)

  const filteredAxes = useMemo(() => {
    const query = normalizeTopicKey(topicSearch)
    if (!query) return axes

    return axes
      .map((axis) => ({ ...axis, temas: axis.temas.filter((tema) => normalizeTopicKey(tema).includes(query)) }))
      .filter((axis) => axis.temas.length > 0 || normalizeTopicKey(axis.eje).includes(query))
  }, [axes, topicSearch])

  const renderStepOne = () => (
    <div className="space-y-5">
      {sugerido && nivel === sugerido.nivel && (
        <p className="cuerpo-s rounded-lg border border-accion-tenue-borde bg-accion-tenue p-3 text-texto">
          {WIZARD_TEMARIO.leidoDelArchivo}
        </p>
      )}
      <div className="space-y-2">
        <Label>Nivel educativo</Label>
        <div className="grid sm:grid-cols-3 gap-3">
          {NIVEL_OPTIONS.map((option) => {
            const isActive = nivel === option.value
            const Icon = option.Icon
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setNivel(option.value)
                  setGrado('')
                  setBrowseMateriaChoice(null)
                }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
              >
                <div className={`w-10 h-10 rounded-lg ${option.color} text-texto-sobre-accion flex items-center justify-center mb-2`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="font-semibold text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.sub}</p>
              </button>
            )
          })}
        </div>
      </div>

      {nivel && (
        <div className="space-y-2">
          <Label>Año / grado</Label>
          {isLoadingGrades && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Cargando className="w-4 h-4" /> Buscando años de {nivel}...
            </p>
          )}

          {!isLoadingGrades && grades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {grades.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={grado === option ? 'default' : 'outline'}
                  onClick={() => {
                    setGrado(option)
                    setBrowseMateriaChoice(null)
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {!isLoadingGrades && grades.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay años cargados en el plan oficial para este nivel. Escribilo a mano y
              después armá el temario con tus propios temas.
            </p>
          )}

          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">
              {grades.length > 0 ? 'O escribilo si no está en la lista' : 'Año o grado'}
            </Label>
            <Input
              placeholder="Ej: 3er Año"
              value={grado}
              onChange={(event) => setGrado(event.target.value)}
              className="max-w-xs"
            />
          </div>
        </div>
      )}
    </div>
  )

  const renderStepTwo = () => (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="wizard-subject-name">Nombre de la materia</Label>
        <Input
          id="wizard-subject-name"
          placeholder="Ej: Matemática"
          value={subjectName}
          onChange={(event) => setSubjectName(event.target.value)}
        />

        {curriculumSubjects.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground">
              Materias del plan oficial para {nivel} · {grado}. Elegí una para partir de su temario.
            </p>
            <div className="flex flex-wrap gap-2">
              {curriculumSubjects.map((materia) => (
                <Button
                  key={materia}
                  type="button"
                  size="sm"
                  variant={normalizeTopicKey(subjectName) === normalizeTopicKey(materia) ? 'default' : 'outline'}
                  className="max-w-full"
                  title={materia}
                  onClick={() => {
                    setSubjectName(materia)
                    setBrowseMateriaChoice(materia)
                  }}
                >
                  {/* Names like "Espacio Institucional de Tutoría y Espacios
                      de Definición Institucional" are longer than the card:
                      Button is whitespace-nowrap, so without min-w-0 + truncate
                      the chip spills past the border instead of shrinking. */}
                  <span className="min-w-0 truncate">{materia}</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ícono</Label>
          <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
            <div className="w-8 h-8 rounded-md border flex items-center justify-center bg-muted">
              <SelectedIcon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">{iconName}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SUBJECT_ICON_OPTIONS.map((icon) => {
              const Icon = SUBJECT_ICON_COMPONENTS[icon]
              return (
                <Button
                  key={icon}
                  type="button"
                  variant={iconName === icon ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setIconName(icon)}
                  className="h-10 px-2"
                  title={icon}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              )
            })}
          </div>
        </div>

        {/* El color por materia se fue: el sistema usa un solo azul. */}
      </div>
    </div>
  )

  const renderCurriculumSection = () => (
    <Card className="p-4 space-y-3">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setShowCurriculumSection((prev) => !prev)}
      >
        {showCurriculumSection ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Elegir del plan oficial de la provincia</h3>
          <p className="text-xs text-muted-foreground truncate">
            {nivel} · {grado} · {DEFAULT_JURISDICTION}
          </p>
        </div>
      </button>

      {showCurriculumSection && (
        <div className="space-y-3">
          {curriculumSubjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {curriculumSubjects.map((materia) => (
                <Button
                  key={materia}
                  type="button"
                  size="sm"
                  variant={browseMateria === materia ? 'default' : 'outline'}
                  className="h-7 text-xs max-w-full"
                  title={materia}
                  onClick={() => setBrowseMateriaChoice(materia)}
                >
                  <span className="min-w-0 truncate">{materia}</span>
                </Button>
              ))}
            </div>
          )}

          {curriculumSubjects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay materias cargadas para {nivel} · {grado}. Podés armar el temario con tus propios temas en
              &quot;Agregar temas personalizados&quot; o importarlo desde un archivo.
            </p>
          )}

          {browseMateria && (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tema..."
                value={topicSearch}
                onChange={(event) => setTopicSearch(event.target.value)}
                className="pl-8 h-9"
              />
            </div>
          )}

          <div className="overflow-y-auto space-y-2 max-h-[40vh] pr-1">
            {isLoadingAxes && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Cargando className="w-4 h-4" /> Cargando temas...
              </p>
            )}

            {!isLoadingAxes && browseMateria && filteredAxes.length === 0 && (
              <p className="text-sm text-muted-foreground">No se encontraron temas para esa búsqueda.</p>
            )}

            {!isLoadingAxes &&
              filteredAxes.map((axis) => {
                const isCollapsed = collapsedAxes.includes(axis.eje)
                const pendingCount = axis.temas.filter((tema) => !addedTopicKeys.has(normalizeTopicKey(tema))).length

                return (
                  <div key={axis.eje} className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1 bg-muted/50 px-2 py-1.5">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                        onClick={() =>
                          setCollapsedAxes((prev) =>
                            prev.includes(axis.eje) ? prev.filter((item) => item !== axis.eje) : [...prev, axis.eje]
                          )
                        }
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        )}
                        <span className="text-xs font-semibold truncate">{axis.eje}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">({axis.temas.length})</span>
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] px-2 shrink-0"
                        onClick={() => addAxisAsUnit(axis)}
                        disabled={pendingCount === 0}
                        title={`Crear una unidad con todos los temas de ${axis.eje}`}
                        aria-label={`Crear una unidad con todos los temas de ${axis.eje}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Todo el eje
                      </Button>
                    </div>

                    {!isCollapsed && (
                      <ul className="divide-y">
                        {axis.temas.map((tema) => {
                          const isAdded = addedTopicKeys.has(normalizeTopicKey(tema))
                          return (
                            <li key={tema} className="flex items-center gap-2 px-2 py-1.5">
                              <span className={`text-xs flex-1 ${isAdded ? 'text-muted-foreground line-through' : ''}`}>
                                {tema}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant={isAdded ? 'ghost' : 'outline'}
                                className="h-7 px-2 shrink-0"
                                disabled={isAdded}
                                onClick={() => addCurriculumTopic(tema, axis.eje)}
                                aria-label={isAdded ? `${tema} ya está en tu temario` : `Agregar ${tema}`}
                              >
                                {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </Card>
  )

  const renderCustomTopicsSection = () => (
    <Card className="p-4 space-y-3">
      <button
        type="button"
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setShowCustomSection((prev) => !prev)}
      >
        {showCustomSection ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Agregar temas personalizados</h3>
          <p className="text-xs text-muted-foreground">Creá una unidad a mano o importá un archivo</p>
        </div>
      </button>

      {showCustomSection && (
        <div className="space-y-3">
          <Button type="button" size="sm" variant="secondary" onClick={addEmptyUnit}>
            <Plus className="w-4 h-4 mr-1" />
            Unidad nueva
          </Button>

          <div className="border-t pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowFileImport((prev) => !prev)}>
              <Upload className="w-4 h-4 mr-2" />
              {showFileImport ? 'Ocultar importación desde archivo' : 'Importar desde un archivo (PDF, Word)'}
            </Button>
            {showFileImport && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground pb-2">
                  Las unidades que encuentre la IA se agregan a tu temario, no lo reemplazan.
                </p>
                <ProgramFileImport
                  onUnitsSuggested={mergeSuggestedUnits}
                  onSourceMetaChange={setSourceMeta}
                  onNivelSugerido={recibirSugerencia}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )

  const renderUnitsPanel = () => (
    <Card className="p-4 space-y-3">
      <div>
        <h3 className="font-semibold text-sm">Tu temario</h3>
        <p className="text-xs text-muted-foreground">
          {units.length} unidades · {topicCount} temas
        </p>
      </div>

      {units.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no armaste unidades. Abrí &quot;Elegir del plan oficial de la provincia&quot; o &quot;Agregar temas
          personalizados&quot; para empezar.
        </p>
      )}

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {units.map((unit, unitIndex) => {
          const isActive = activeUnitId === unit.id || (!activeUnitId && unitIndex === 0)

          return (
            <div
              key={unit.id}
              className={`rounded-lg border-2 p-2.5 space-y-2 transition-colors ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
              onClick={() => setActiveUnitId(unit.id)}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{unitIndex + 1}.</span>
                <Input
                  placeholder="Nombre de la unidad"
                  value={unit.name}
                  onChange={(event) => renameUnit(unit.id, event.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-7 shrink-0"
                  onClick={(event) => {
                    event.stopPropagation()
                    moveUnit(unit.id, -1)
                  }}
                  disabled={unitIndex === 0}
                  aria-label="Subir unidad"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-7 shrink-0"
                  onClick={(event) => {
                    event.stopPropagation()
                    moveUnit(unit.id, 1)
                  }}
                  disabled={unitIndex === units.length - 1}
                  aria-label="Bajar unidad"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-7 shrink-0 text-destructive"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeUnit(unit.id)
                  }}
                  aria-label="Eliminar unidad"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {unit.topics.length === 0 && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  {isActive ? 'Los temas que agregues caen en esta unidad.' : 'Sin temas.'}
                </p>
              )}

              <ul className="space-y-1 pl-6">
                {unit.topics.map((topic) => (
                  <li key={topic.id} className="flex items-start gap-1.5">
                    {/* min-w-0 lets the name wrap instead of pushing the badge
                        and the delete button past the right edge of the card. */}
                    <span className="text-xs flex-1 min-w-0 break-words">{topic.name}</span>
                    {topic.origin === 'curriculum' ? (
                      <Badge variant="secondary" className="h-5 text-[10px] px-1.5 shrink-0" title={topic.sourceEje}>
                        Currículum
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 shrink-0">
                        Propio
                      </Badge>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeTopic(unit.id, topic.id)}
                      aria-label={`Quitar ${topic.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1.5 pl-6">
                <Input
                  placeholder="Escribí un tema propio"
                  value={customTopicDraft[unit.id] ?? ''}
                  onChange={(event) => setCustomTopicDraft((prev) => ({ ...prev, [unit.id]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addCustomTopic(unit.id)
                    }
                  }}
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => addCustomTopic(unit.id)}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )

  const renderStepFour = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estos datos no los ve el alumno: orientan a la IA cuando genera los cuestionarios de la materia.
      </p>

      {nivel === 'Superior' && (
        <div className="space-y-1">
          <Label>Carrera</Label>
          <Input
            placeholder="Ej: Profesorado en Matemática"
            value={pedagogy.degree}
            onChange={(event) => setPedagogy((prev) => ({ ...prev, degree: event.target.value }))}
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Complejidad</Label>
          <div className="grid grid-cols-3 gap-2">
            {COMPLEXITY_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPedagogy((prev) => ({ ...prev, complexity: option }))}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                  pedagogy.complexity === option
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Enfoque</Label>
          <div className="grid grid-cols-3 gap-2">
            {ASSESSMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPedagogy((prev) => ({ ...prev, assessmentStyle: option.value }))}
                className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                  pedagogy.assessmentStyle === option.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="wizard-methodology">Tu metodología de enseñanza</Label>
        <p className="text-xs text-muted-foreground">
          Contanos cómo te gusta enseñar esta materia. Lo tenemos en cuenta al generar los
          cuestionarios, así se parecen a tus clases y no a un examen genérico.
        </p>
        <Textarea
          id="wizard-methodology"
          rows={3}
          value={pedagogy.methodology}
          placeholder="Ej: Arranco con un problema de la vida real, resolvemos juntos un ejemplo en el pizarrón y recién después practican solos con dificultad creciente."
          onChange={(event) => setPedagogy((prev) => ({ ...prev, methodology: event.target.value }))}
        />
      </div>

      <Card className="p-4 bg-muted/40 space-y-1">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Resumen
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>{subjectName}</strong> · {nivel} · {grado}
        </p>
        <p className="text-sm text-muted-foreground">
          {units.length} unidades y {topicCount} temas.
        </p>
      </Card>
    </div>
  )

  const currentBlocker = stepBlockers[step]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="titulo-m text-texto">
            {isEditing ? WIZARD_TEMARIO.tituloEditar : WIZARD_TEMARIO.tituloCrear}
          </DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{WIZARD_TEMARIO.detalle}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-wrap items-center gap-2 pb-1">
          {orden.map((id, index) => {
            const isCurrent = step === id
            const isDone = orden.indexOf(step) > index && !stepBlockers[id]

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goToStep(id)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`nota flex min-h-11 items-center gap-2 rounded-md border px-3 font-semibold transition-colors ${
                    isCurrent
                      ? 'border-texto bg-superficie-tarjeta text-texto'
                      : isDone
                        ? 'border-logrado-fondo bg-logrado-fondo text-logrado'
                        : 'border-borde text-texto-suave hover:border-borde-fuerte'
                  }`}
                >
                  <span aria-hidden="true">{isDone ? <Check className="w-3.5 h-3.5" /> : index + 1}</span>
                  {STEP_LABEL[id]}
                  {isDone && <span className="sr-only">: {WIZARD_TEMARIO.pasoListo}</span>}
                </button>
              </li>
            )
          })}
        </ol>

        <div className="py-1">
          {step === 1 && renderStepOne()}
          {step === 2 && renderStepTwo()}
          {step === 3 && (
            <div className="space-y-4">
              {renderUnitsPanel()}
              <div className="space-y-3">
                {/* El plan oficial se filtra por nivel y año. Si todavía no se
                    eligieron (subiendo un archivo van después), no se ofrece. */}
                {nivel && grado ? renderCurriculumSection() : null}
                {renderCustomTopicsSection()}
              </div>
            </div>
          )}
          {step === 4 && renderStepFour()}
        </div>

        {currentBlocker && <p className="cuerpo-s text-flojo">{currentBlocker}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-borde pt-3">
          <Boton
            variante="secundario"
            onClick={() => (anterior === null ? onOpenChange(false) : setStep(anterior))}
          >
            {anterior === null ? WIZARD_TEMARIO.cancelar : WIZARD_TEMARIO.atras}
          </Boton>

          {siguiente !== null ? (
            <Boton onClick={() => goToStep(siguiente)} disabled={Boolean(currentBlocker)}>
              {WIZARD_TEMARIO.continuar}
            </Boton>
          ) : (
            <Boton onClick={handleSave} disabled={isSaving || Boolean(currentBlocker)}>
              {isSaving ? <Cargando /> : null}
              {isEditing ? WIZARD_TEMARIO.guardar : WIZARD_TEMARIO.crear}
            </Boton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
