'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Boton } from '@/components/sistema/boton'
import { MIS_TAREAS_ALUMNO as T } from '@/lib/textos'
import { SubjectContent } from '@/components/subject-content'
import { useAppStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { ASSIGNMENT_STATE_LABEL, isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { CargaFallida } from '@/components/carga-fallida'
import { pedirJson } from '@/lib/pedir-json'
import type { AssignmentState, StudentClassroom, Subject } from '@/lib/types'

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

      toast({ title: 'Listo', description: `Ya estás en ${data.classroomName}.` })
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
          // El nivel es el del grupo, no el del perfil del alumno: es lo que
          // decide con qué registro se le explica un error.
          nivel: classroom.nivel ?? undefined,
          grado: classroom.grado ?? undefined,
          topics: assignment.selectedTopics ?? [],
          mode: assignment.mode,
          questionCount: assignment.questions.length,
          pedagogyContext: assignment.pedagogyContext,
          classroomId: classroom.id,
          assignmentId: assignment.id,
          // J5: el diagnóstico se rinde de corrido; la devolución, al final.
          devolucion: assignment.tipo === 'diagnostico' ? 'al_final' : 'inmediata',
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

  // Todas las tareas de todos los grupos en una sola lista: lo que hay para
  // hacer primero, y dentro de eso lo que vence antes.
  const tareas = classrooms
    .flatMap((classroom) => classroom.assignments.map((assignment) => ({ assignment, classroom })))
    .sort((a, b) => {
      const orden = (estado: AssignmentState) => (estado === 'disponible' ? 0 : estado === 'programada' ? 1 : 2)
      return (
        orden(a.assignment.state) - orden(b.assignment.state) ||
        String(a.assignment.dueAt ?? '9').localeCompare(String(b.assignment.dueAt ?? '9'))
      )
    })
  const primeraDisponible = tareas.find(({ assignment }) => assignment.state === 'disponible')?.assignment.id ?? null
  const esInvitado = Boolean(viewer?.isGuest)
  const tieneCuenta = status === 'authenticated'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titulo-l text-texto">{T.titulo}</h1>

      {isLoading && (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando /> {T.cargando}
        </p>
      )}

      {!isLoading && loadError && (
        <div className="rounded-lg border border-borde bg-superficie-tarjeta">
          <CargaFallida que={T.queCargamos} detalle={loadError} onReintentar={load} />
        </div>
      )}

      {!isLoading && !loadError && (
        <section aria-label={T.titulo} className="flex flex-col gap-3">
          {tareas.length === 0 ? (
            <div className="rounded-lg border border-borde bg-superficie-tarjeta p-6">
              <h2 className="titulo-m text-texto">{classrooms.length === 0 ? T.sinGrupo.titulo : T.sinTareas.titulo}</h2>
              <p className="cuerpo-s mt-1 max-w-prose text-texto-suave">
                {classrooms.length === 0 ? T.sinGrupo.detalle : T.sinTareas.detalle}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {tareas.map(({ assignment, classroom }) => {
                const disponible = assignment.state === 'disponible'
                const abriendo = startingAssignmentId === assignment.id
                return (
                  <li
                    key={assignment.id}
                    className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="cuerpo text-texto">{assignment.title}</h2>
                      <p className="nota text-texto-suave">
                        {[
                          classroom.subjectName,
                          classroom.teacherName,
                          assignment.dueAt ? T.hasta(formatDate(assignment.dueAt)) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="nota mt-1 text-texto-suave">
                        {[
                          disponible ? null : ASSIGNMENT_STATE_LABEL[assignment.state],
                          assignment.opensAt && assignment.state === 'programada' ? T.desde(formatDate(assignment.opensAt)) : null,
                          T.intentos(assignment.attemptsUsed, assignment.maxAttempts),
                          assignment.bestScore !== null ? T.mejorNota(Number(assignment.bestScore).toFixed(1)) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {/* Un solo azul: la primera tarea para hacer es la principal. */}
                    <Boton
                      variante={assignment.id === primeraDisponible ? 'principal' : 'secundario'}
                      className="shrink-0"
                      disabled={!disponible || abriendo}
                      onClick={() => handleStartAssignment(assignment.id, classroom)}
                    >
                      {abriendo && <Cargando />}
                      {assignment.attemptsUsed > 0 ? T.volverAHacer : T.empezar}
                    </Boton>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {/* Lo demás que puede hacer un alumno con cuenta. El invitado ve sólo su
          grupo: la práctica libre y el progreso necesitan cuenta. */}
      {tieneCuenta && !esInvitado && (
        <nav aria-label={T.accesos.etiqueta} className="grid gap-3 sm:grid-cols-2">
          {[
            { href: '/practicar', ...T.accesos.practicar },
            { href: '/history', ...T.accesos.progreso },
          ].map((acceso) => (
            <Link
              key={acceso.href}
              href={acceso.href}
              className="rounded-lg border border-borde bg-superficie-tarjeta p-4 transition-colors hover:border-borde-fuerte"
            >
              <span className="cuerpo block text-texto">{acceso.titulo}</span>
              <span className="nota block text-texto-suave">{acceso.detalle}</span>
            </Link>
          ))}
        </nav>
      )}

      {classrooms.length > 0 && (
        <section aria-labelledby="mis-grupos" className="flex flex-col gap-3">
          <h2 id="mis-grupos" className="titulo-m text-texto">
            {T.grupos.titulo}
          </h2>
          <ul className="flex flex-col gap-3">
            {classrooms.map((classroom) => {
              const abierto = activeId === classroom.id
              return (
                <li key={classroom.id} className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="nota text-texto-suave">{T.grupos.teInvito(classroom.teacherName)}</p>
                      <h3 className="cuerpo text-texto">{classroom.subjectName}</h3>
                      {classroom.status === 'closed' && <p className="nota text-texto-suave">{T.grupos.cerrado}</p>}
                    </div>
                    {!esInvitado && classroom.status !== 'closed' && (
                      <Boton
                        variante="secundario"
                        className="shrink-0"
                        aria-expanded={abierto}
                        onClick={() => setActiveId(abierto ? null : classroom.id)}
                      >
                        {abierto ? T.grupos.cerrarPractica : T.grupos.practicar}
                      </Boton>
                    )}
                  </div>

                  {esInvitado && <p className="nota mt-3 text-texto-suave">{T.grupos.practicaConCuenta}</p>}

                  {abierto && !esInvitado && (
                    <div className="mt-4 border-t border-borde pt-4">
                      <p className="cuerpo-s mb-3 text-texto-suave">{T.grupos.practicaDetalle}</p>
                      <SubjectContent subject={classroomToSubject(classroom)} classroomId={classroom.id} />
                    </div>
                  )}

                  {/* El panel del docente es nominal: se dice de frente. */}
                  <p className="nota mt-3 text-texto-suave">{T.grupos.queVe(classroom.teacherName)}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
        <label htmlFor="join-code" className="nota mb-2 block font-semibold text-texto-suave">
          {T.sumarme.etiqueta}
        </label>
        <div className="flex max-w-sm gap-2">
          <input
            id="join-code"
            placeholder={T.sumarme.ejemplo}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleJoin()
            }}
            autoComplete="off"
            maxLength={12}
            className="h-12 min-w-0 flex-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] uppercase tracking-[0.14em] text-texto placeholder:text-texto-suave placeholder:opacity-70"
          />
          <Boton variante="secundario" onClick={handleJoin} disabled={isJoining}>
            {isJoining && <Cargando />}
            {T.sumarme.boton}
          </Boton>
        </div>
      </section>
    </div>
  )
}
