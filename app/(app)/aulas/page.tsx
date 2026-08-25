'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SubjectContent } from '@/components/subject-content'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { ASSIGNMENT_STATE_LABEL, isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { SUBJECT_COLOR_CLASS } from '@/lib/subject-appearance'
import { SUBJECT_ICON_COMPONENTS } from '@/lib/subject-icons'
import { CalendarClock, KeyRound, Loader2, LogIn, PlayCircle, Users } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { pedirJson } from '@/lib/pedir-json'
import type { AssignmentState, StudentClassroom, Subject, SubjectColorName, SubjectIconName } from '@/lib/types'

const STATE_BADGE_VARIANT: Record<AssignmentState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  disponible: 'default',
  programada: 'secondary',
  vencida: 'destructive',
  sin_intentos: 'outline',
  cerrada: 'outline',
}

function formatDate(value: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

/** The aula's temario as a Subject, so SubjectContent can drive free practice. */
function classroomToSubject(classroom: StudentClassroom): Subject {
  return {
    id: `classroom-${classroom.id}`,
    name: classroom.subjectName,
    icon: classroom.iconName,
    color: classroom.colorName,
    progress: 0,
    source: 'teacher',
    programId: classroom.teacherProgramId,
    pedagogyProfile: classroom.pedagogyProfile,
    units: (classroom.units ?? []).map((unit) => ({
      id: unit.id,
      name: unit.name,
      topics: unit.topics.map((topic) => ({ id: topic.id, name: topic.name, completed: false })),
    })),
  }
}

export default function MisAulasPage() {
  const { status } = useSession()
  const { toast } = useToast()
  const { startQuiz, setActiveView } = useAppStore()

  const [classrooms, setClassrooms] = useState<StudentClassroom[]>([])
  const [viewer, setViewer] = useState<{ isGuest: boolean; displayName: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [startingAssignmentId, setStartingAssignmentId] = useState<number | null>(null)
  const hasClaimedRef = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    // "Falló la consulta" y "no estás en ninguna aula" tienen que verse
    // distintos: el catch viejo pintaba el 500 como lista vacía (§6a).
    const res = await pedirJson<{
      classrooms?: StudentClassroom[]
      viewer?: { isGuest: boolean; displayName: string } | null
    }>('/api/student/classrooms')
    if ('error' in res) {
      setClassrooms([])
      setLoadError(res.error)
    } else {
      const list: StudentClassroom[] = Array.isArray(res.data.classrooms) ? res.data.classrooms : []
      setClassrooms(list)
      setViewer(res.data.viewer ?? null)
      setActiveId((current) => current ?? (list.length === 1 ? list[0].id : null))
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /**
   * A student who practised as a guest and then signed in arrives here with
   * both identities. Claiming once on mount folds the guest's attempts and
   * memberships into the account; it no-ops when there's no guest cookie.
   */
  useEffect(() => {
    if (status !== 'authenticated' || hasClaimedRef.current) return
    hasClaimedRef.current = true

    fetch('/api/student/guest/claim', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (!data?.claimed) return
        toast({
          title: 'Progreso recuperado',
          description: 'Lo que practicaste como invitado quedó en tu cuenta.',
        })
        load()
      })
      .catch(() => {
        // Nothing to recover is the normal case; never bother the student.
      })
  }, [status, toast, load])

  const activeClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === activeId) ?? null,
    [classrooms, activeId]
  )

  const handleJoin = async () => {
    const code = normalizeJoinCode(joinCode)
    if (!isValidJoinCode(code)) {
      toast({ title: 'Código incompleto', description: 'Tiene que tener 6 caracteres.' })
      return
    }

    setIsJoining(true)
    try {
      const response = await fetch('/api/classrooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await response.json()

      if (!response.ok) {
        // A brand-new guest needs to give a name; that flow lives on the join page.
        if (data?.needsName) {
          window.location.href = `/aula/${code}`
          return
        }
        throw new Error(data?.error || 'No pudimos sumarte al aula')
      }

      toast({ title: '¡Listo!', description: `Ya estás en ${data.classroomName}.` })
      setJoinCode('')
      await load()
      setActiveId(Number(data.classroomId))
    } catch (error) {
      toast({ title: 'No pudimos sumarte', description: error instanceof Error ? error.message : 'Error desconocido' })
    } finally {
      setIsJoining(false)
    }
  }

  const handleStartAssignment = async (assignmentId: number, classroom: StudentClassroom) => {
    setStartingAssignmentId(assignmentId)

    try {
      const response = await fetch(`/api/student/assignments/${assignmentId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo abrir el cuestionario')
      }

      const assignment = data.assignment
      startQuiz(
        {
          subject: `classroom-${classroom.id}`,
          subjectName: assignment.subjectName || classroom.subjectName,
          topics: assignment.selectedTopics ?? [],
          mode: assignment.mode,
          questionCount: assignment.questions.length,
          pedagogyContext: assignment.pedagogyContext,
          classroomId: classroom.id,
          assignmentId: assignment.id,
        },
        assignment.questions
      )
      setActiveView('quiz')
    } catch (error) {
      toast({ title: 'No se pudo abrir', description: error instanceof Error ? error.message : 'Error desconocido' })
      // The state may have changed since the page loaded (deadline passed,
      // attempts spent) — refresh so the badge tells the truth.
      load()
    } finally {
      setStartingAssignmentId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Mis aulas</h1>
          <p className="text-sm text-muted-foreground">
            Practicá el temario que armó tu docente y resolvé lo que te asignó.
          </p>
        </div>
      </div>

      {viewer?.isGuest && (
        <Card className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 space-y-2">
          <p className="text-sm font-semibold text-amber-900">
            Estás entrando como invitado{viewer.displayName ? `, ${viewer.displayName}` : ''}.
          </p>
          <p className="text-sm text-amber-800">
            Creá tu cuenta para practicar sin límite diario y para que tu docente te vea como alumno verificado. Todo
            lo que hiciste hasta ahora se transfiere solo.
          </p>
          <Button size="sm" onClick={() => signIn('google', { callbackUrl: '/aulas' })}>
            <LogIn className="w-4 h-4 mr-2" />
            Crear mi cuenta con Google
          </Button>
        </Card>
      )}

      <Card className="p-4 rounded-2xl space-y-2">
        <label htmlFor="join-code" className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="w-4 h-4" />
          Entrar a un aula nueva
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="join-code"
            placeholder="Código de 6 caracteres"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleJoin()
            }}
            className="max-w-[220px] font-mono tracking-[0.2em] uppercase"
            maxLength={12}
          />
          <Button onClick={handleJoin} disabled={isJoining}>
            {isJoining ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Entrar
          </Button>
        </div>
      </Card>

      {isLoading && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando tus aulas...
        </p>
      )}

      {!isLoading && loadError && (
        <Card className="rounded-2xl">
          <CargaFallida que="tus aulas" detalle={loadError} onReintentar={load} />
        </Card>
      )}

      {!isLoading && !loadError && classrooms.length === 0 && (
        <Card className="p-6 rounded-2xl text-center space-y-2">
          <p className="font-semibold">Todavía no estás en ninguna aula</p>
          <p className="text-sm text-muted-foreground">
            Pedile el código a tu docente y escribilo arriba.
          </p>
        </Card>
      )}

      {classrooms.length > 0 && (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {classrooms.map((classroom) => {
            const Icon = SUBJECT_ICON_COMPONENTS[classroom.iconName as SubjectIconName] ?? SUBJECT_ICON_COMPONENTS['book-open']
            const chipClass = SUBJECT_COLOR_CLASS[classroom.colorName as SubjectColorName]?.chip ?? 'bg-teal-500'
            const pending = classroom.assignments.filter((assignment) => assignment.state === 'disponible').length
            const isActive = activeId === classroom.id

            return (
              <Card
                key={classroom.id}
                className={`p-4 space-y-2 border-2 cursor-pointer transition-colors self-start ${isActive ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                onClick={() => setActiveId(classroom.id)}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-9 h-9 rounded-lg ${chipClass} text-white flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug break-words">{classroom.subjectName}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {classroom.name} · {classroom.teacherName}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {classroom.status === 'closed' ? (
                    <Badge variant="outline">Cerrada</Badge>
                  ) : pending > 0 ? (
                    <Badge>{pending} para resolver</Badge>
                  ) : (
                    <span className="text-muted-foreground">Práctica libre</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {activeClassroom && (
        <div className="space-y-4">
          <Card className="p-4 rounded-2xl space-y-3">
            <h2 className="font-bold flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Cuestionarios de {activeClassroom.subjectName}
            </h2>

            {activeClassroom.assignments.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tu docente todavía no asignó ninguno. Mientras tanto podés practicar el temario acá abajo.
              </p>
            )}

            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
              {activeClassroom.assignments.map((assignment) => (
                <Card key={assignment.id} className="p-3 space-y-2 border self-start">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm break-words">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {assignment.mode} · {assignment.questionCount} preguntas
                      </p>
                    </div>
                    <Badge variant={STATE_BADGE_VARIANT[assignment.state]} className="shrink-0">
                      {ASSIGNMENT_STATE_LABEL[assignment.state]}
                    </Badge>
                  </div>

                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {assignment.opensAt && <li>Abre: {formatDate(assignment.opensAt)}</li>}
                    {assignment.dueAt && <li>Entrega hasta: {formatDate(assignment.dueAt)}</li>}
                    <li>
                      Intentos: {assignment.attemptsUsed}
                      {assignment.maxAttempts ? ` de ${assignment.maxAttempts}` : ' (sin límite)'}
                    </li>
                    {assignment.bestScore !== null && <li>Tu mejor nota: {Number(assignment.bestScore).toFixed(1)}</li>}
                  </ul>

                  <Button
                    size="sm"
                    className="w-full"
                    disabled={assignment.state !== 'disponible' || startingAssignmentId === assignment.id}
                    onClick={() => handleStartAssignment(assignment.id, activeClassroom)}
                  >
                    {startingAssignmentId === assignment.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <PlayCircle className="w-4 h-4 mr-2" />
                    )}
                    {assignment.attemptsUsed > 0 ? 'Volver a intentar' : 'Resolver'}
                  </Button>
                </Card>
              ))}
            </div>
          </Card>

          <Card className="p-4 rounded-2xl space-y-3">
            <div>
              <h2 className="font-bold">Practicá el temario</h2>
              <p className="text-sm text-muted-foreground">
                Elegí los temas que quieras y la IA te arma un cuestionario con el programa de tu docente.
              </p>
            </div>
            <SubjectContent subject={classroomToSubject(activeClassroom)} classroomId={activeClassroom.id} />
          </Card>

          {/* The teacher's panel is nominal, so say so plainly instead of
              letting students discover it. */}
          <p className="text-xs text-muted-foreground px-1">
            {activeClassroom.teacherName} ve tu nombre, las notas de lo que resolvés en esta aula y los temas donde te
            equivocás. Lo que practicás fuera del aula es sólo tuyo.
          </p>
        </div>
      )}
    </div>
  )
}
