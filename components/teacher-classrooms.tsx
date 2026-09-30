'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  Copy,
  Download,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react'
import { SUBJECT_COLOR_CLASS } from '@/lib/subject-appearance'
import { guestCapStatus } from '@/lib/classrooms'
import { cn } from '@/lib/utils'
import { SUBJECT_ICON_COMPONENTS } from '@/lib/subject-icons'
import { ClassroomStudentDialog } from '@/components/classroom-student-dialog'
import { AccuracyBar, formatDateTime, formatPercent, formatScore } from '@/components/classroom-report-parts'
import type { SubjectColorName, SubjectIconName, TeacherProgram } from '@/lib/types'

interface ClassroomRow {
  id: number
  teacher_program_id: number
  name: string
  join_code: string
  status: 'open' | 'closed'
  created_at: string
  subject_name: string
  nivel: string | null
  grado: string | null
  icon_name: SubjectIconName
  color_name: SubjectColorName
  member_count: number
  assignment_count: number
  /** Invitados creados en las últimas 24 h en esta aula; ver lib/classroom-guest-cap.ts. */
  new_guests_today: number
  guest_join_limit: number
}

interface WeakTopic {
  topicName: string
  correct: number
  total: number
  accuracy: number
}

interface ReportStudent {
  memberId: number
  userId: string
  displayName: string
  isVerified: boolean
  joinedAt: string
  attemptCount: number
  averageScore: number | null
  bestScore: number | null
  passedCount: number
  lastAttemptAt: string | null
  weakTopics: WeakTopic[]
}

interface ReportTopic extends WeakTopic {
  studentCount: number
}

interface ReportAssignment {
  id: number
  title: string
  questionCount: number
  opensAt: string | null
  dueAt: string | null
  maxAttempts: number | null
  submittedCount: number
  pendingCount: number
  attemptCount: number
  averageScore: number | null
}

interface ReportSummary {
  studentCount: number
  inactiveCount: number
  totalAttempts: number
  groupAverage: number | null
  weakTopicCount: number
}

interface TeacherClassroomsProps {
  programs: TeacherProgram[]
}

/**
 * Excel in es-AR splits on semicolons, and without a BOM it mangles the
 * accents — both matter because this file goes straight into a gradebook.
 */
function downloadCsv(fileName: string, rows: string[][]) {
  const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`
  const content = '﻿' + rows.map((row) => row.map(escape).join(';')).join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function TeacherClassrooms({ programs }: TeacherClassroomsProps) {
  const { toast } = useToast()

  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)

  const [students, setStudents] = useState<ReportStudent[]>([])
  const [topics, setTopics] = useState<ReportTopic[]>([])
  const [assignments, setAssignments] = useState<ReportAssignment[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProgramId, setNewProgramId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [copiedField, setCopiedField] = useState<'code' | 'link' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ClassroomRow | null>(null)
  const [copySourceId, setCopySourceId] = useState<string>('')
  const [openStudent, setOpenStudent] = useState<ReportStudent | null>(null)

  const activeClassroom = useMemo(
    () => classrooms.find((classroom) => classroom.id === activeId) ?? null,
    [classrooms, activeId]
  )

  const loadClassrooms = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/teacher/classrooms')
      const data = await response.json()
      setClassrooms(Array.isArray(data.classrooms) ? data.classrooms : [])
    } catch {
      setClassrooms([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadClassrooms()
  }, [loadClassrooms])

  const loadReport = useCallback(async (classroomId: number) => {
    setIsLoadingReport(true)
    try {
      const response = await fetch(`/api/teacher/classrooms/${classroomId}/report`)
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo abrir el aula')

      setStudents(Array.isArray(data.students) ? data.students : [])
      setTopics(Array.isArray(data.topics) ? data.topics : [])
      setAssignments(Array.isArray(data.assignments) ? data.assignments : [])
      setSummary(data.summary ?? null)
    } catch {
      setStudents([])
      setTopics([])
      setAssignments([])
      setSummary(null)
    } finally {
      setIsLoadingReport(false)
    }
  }, [])

  useEffect(() => {
    if (activeId) loadReport(activeId)
  }, [activeId, loadReport])

  const joinUrl = (code: string) =>
    typeof window === 'undefined' ? `/aula/${code}` : `${window.location.origin}/aula/${code}`

  const copyToClipboard = async (value: string, field: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1800)
    } catch {
      toast({ title: 'No se pudo copiar', description: value })
    }
  }

  const handleCreate = async () => {
    if (!newProgramId) {
      toast({ title: 'Elegí una materia', description: 'El aula entrega el temario de una materia.' })
      return
    }
    if (!newName.trim()) {
      toast({ title: 'Falta el nombre', description: 'Por ejemplo "3° A turno mañana".' })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/teacher/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherProgramId: newProgramId, name: newName.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo crear el aula')

      toast({ title: 'Aula creada', description: `Código ${data.classroom.join_code}. Compartilo con tus alumnos.` })
      setShowCreate(false)
      setNewName('')
      setNewProgramId(null)
      await loadClassrooms()
      setActiveId(Number(data.classroom.id))
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    } finally {
      setIsCreating(false)
    }
  }

  const patchClassroom = async (classroomId: number, payload: Record<string, unknown>, successMessage: string) => {
    try {
      const response = await fetch(`/api/teacher/classrooms/${classroomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudo actualizar el aula')

      toast({ title: successMessage })
      await loadClassrooms()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return

    try {
      const response = await fetch(`/api/teacher/classrooms/${pendingDelete.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('No se pudo eliminar el aula')

      toast({ title: 'Aula eliminada' })
      setPendingDelete(null)
      setActiveId(null)
      await loadClassrooms()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }

  const refreshActive = async () => {
    if (!activeId) return
    await loadReport(activeId)
    await loadClassrooms()
  }

  const handleRemoveMember = async (memberId: number) => {
    if (!activeId) return

    try {
      const response = await fetch(`/api/teacher/classrooms/${activeId}/members/${memberId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('No se pudo quitar al alumno')
      await refreshActive()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }

  const handleCopyMembers = async () => {
    if (!activeId || !copySourceId) return

    try {
      const response = await fetch(`/api/teacher/classrooms/${activeId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceClassroomId: Number(copySourceId) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'No se pudieron copiar los alumnos')

      toast({ title: 'Alumnos copiados', description: `${data.copied} alumnos ahora también están en esta aula.` })
      setCopySourceId('')
      await refreshActive()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!activeId) return

    try {
      const response = await fetch(`/api/teacher/classrooms/${activeId}/assignments/${assignmentId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('No se pudo quitar la asignación')
      await refreshActive()
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Error desconocido' })
    }
  }

  const handleExportCsv = () => {
    if (!activeClassroom) return

    const rows: string[][] = [
      ['Alumno', 'Verificado', 'Cuestionarios', 'Promedio', 'Mejor nota', 'Aprobados', 'Última actividad', 'Temas flojos'],
      ...students.map((student) => [
        student.displayName,
        student.isVerified ? 'Sí' : 'No',
        String(student.attemptCount),
        student.averageScore === null ? '' : student.averageScore.toFixed(1).replace('.', ','),
        student.bestScore === null ? '' : student.bestScore.toFixed(1).replace('.', ','),
        String(student.passedCount),
        student.lastAttemptAt ? formatDateTime(student.lastAttemptAt) : '',
        student.weakTopics.map((topic) => `${topic.topicName} (${formatPercent(topic.accuracy)})`).join(' | '),
      ]),
    ]

    const safeName = activeClassroom.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    downloadCsv(`notas-${safeName}.csv`, rows)
    toast({ title: 'Notas descargadas', description: 'El archivo se abre en Excel o Google Sheets.' })
  }

  // ─── Detail view ───────────────────────────────────────────────────────────
  if (activeClassroom) {
    const Icon = SUBJECT_ICON_COMPONENTS[activeClassroom.icon_name] ?? SUBJECT_ICON_COMPONENTS['book-open']
    const chipClass = SUBJECT_COLOR_CLASS[activeClassroom.color_name]?.chip ?? 'bg-teal-500'
    const otherClassrooms = classrooms.filter((classroom) => classroom.id !== activeClassroom.id)

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a mis aulas
        </Button>

        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${chipClass} text-white flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{activeClassroom.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {activeClassroom.subject_name}
                  {activeClassroom.nivel ? ` · ${activeClassroom.nivel}` : ''}
                  {activeClassroom.grado ? ` · ${activeClassroom.grado}` : ''}
                </p>
              </div>
            </div>

            <Badge variant={activeClassroom.status === 'open' ? 'secondary' : 'outline'}>
              {activeClassroom.status === 'open' ? 'Abierta' : 'Cerrada'}
            </Badge>
          </div>

          <div className="rounded-xl border-2 border-dashed p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <KeyRound className="w-5 h-5 text-primary shrink-0" />
              <span className="text-3xl font-black tracking-[0.3em] font-mono">{activeClassroom.join_code}</span>
              <Button size="sm" variant="outline" onClick={() => copyToClipboard(activeClassroom.join_code, 'code')}>
                {copiedField === 'code' ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copiedField === 'code' ? 'Copiado' : 'Copiar código'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(joinUrl(activeClassroom.join_code), 'link')}
              >
                {copiedField === 'link' ? <Check className="w-4 h-4 mr-1" /> : <Link2 className="w-4 h-4 mr-1" />}
                {copiedField === 'link' ? 'Copiado' : 'Copiar enlace'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tus alumnos entran en <span className="font-mono">{joinUrl(activeClassroom.join_code)}</span> con cuenta de
              Google o como invitados.
            </p>

            <GuestCapNotice
              newGuests={activeClassroom.new_guests_today}
              limit={activeClassroom.guest_join_limit}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patchClassroom(activeClassroom.id, { regenerateCode: true }, 'Código regenerado: el anterior dejó de servir')
                }
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Regenerar código
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  patchClassroom(
                    activeClassroom.id,
                    { status: activeClassroom.status === 'open' ? 'closed' : 'open' },
                    activeClassroom.status === 'open' ? 'Aula cerrada' : 'Aula reabierta'
                  )
                }
              >
                {activeClassroom.status === 'open' ? 'Cerrar aula' : 'Reabrir aula'}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setPendingDelete(activeClassroom)}>
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar aula
              </Button>
            </div>
          </div>
        </Card>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-2xl font-black">{summary.studentCount}</p>
              <p className="text-xs text-muted-foreground">alumnos</p>
            </Card>
            <Card className="p-3">
              <p className="text-2xl font-black">{formatScore(summary.groupAverage)}</p>
              <p className="text-xs text-muted-foreground">promedio del grupo</p>
            </Card>
            <Card className="p-3">
              <p className="text-2xl font-black">{summary.totalAttempts}</p>
              <p className="text-xs text-muted-foreground">cuestionarios resueltos</p>
            </Card>
            <Card className={`p-3 ${summary.inactiveCount > 0 ? 'border-amber-300 bg-amber-50/60' : ''}`}>
              <p className="text-2xl font-black">{summary.inactiveCount}</p>
              <p className="text-xs text-muted-foreground">sin actividad</p>
            </Card>
          </div>
        )}

        {isLoadingReport && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando seguimiento...
          </p>
        )}

        <Tabs defaultValue="alumnos">
          <TabsList>
            <TabsTrigger value="alumnos">Alumnos ({students.length})</TabsTrigger>
            <TabsTrigger value="temas">Temas ({topics.length})</TabsTrigger>
            <TabsTrigger value="cuestionarios">Cuestionarios ({assignments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="alumnos">
            <Card className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Seguimiento por alumno
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                  {otherClassrooms.length > 0 && (
                    <>
                      <select
                        className="border rounded-md px-2 py-1.5 bg-background text-sm"
                        value={copySourceId}
                        onChange={(event) => setCopySourceId(event.target.value)}
                        aria-label="Copiar alumnos desde otra aula"
                      >
                        <option value="">Copiar alumnos de...</option>
                        {otherClassrooms.map((classroom) => (
                          <option key={classroom.id} value={classroom.id}>
                            {classroom.name} ({classroom.member_count})
                          </option>
                        ))}
                      </select>
                      <Button size="sm" variant="outline" disabled={!copySourceId} onClick={handleCopyMembers}>
                        Copiar
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" disabled={students.length === 0} onClick={handleExportCsv}>
                    <Download className="w-4 h-4 mr-1" />
                    Descargar notas
                  </Button>
                </div>
              </div>

              {!isLoadingReport && students.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Todavía no entró nadie. Compartí el código {activeClassroom.join_code} en clase.
                </p>
              )}

              {students.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                        <th className="py-2 pr-3">Alumno</th>
                        <th className="py-2 pr-3">Resueltos</th>
                        <th className="py-2 pr-3">Promedio</th>
                        <th className="py-2 pr-3">Mejor</th>
                        <th className="py-2 pr-3">Temas flojos</th>
                        <th className="py-2 pr-3">Última actividad</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.memberId} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-3">
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-left hover:underline"
                              onClick={() => setOpenStudent(student)}
                            >
                              <span className="font-medium">{student.displayName}</span>
                              {student.isVerified ? (
                                <BadgeCheck className="w-4 h-4 text-emerald-600" aria-label="Cuenta verificada" />
                              ) : (
                                <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                                  sin verificar
                                </Badge>
                              )}
                            </button>
                          </td>
                          <td className="py-2 pr-3">{student.attemptCount}</td>
                          <td className="py-2 pr-3 font-semibold">{formatScore(student.averageScore)}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{formatScore(student.bestScore)}</td>
                          <td className="py-2 pr-3">
                            {student.weakTopics.length === 0 ? (
                              <span className="text-muted-foreground text-xs">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {student.weakTopics.map((topic) => (
                                  <Badge
                                    key={topic.topicName}
                                    variant="outline"
                                    className="max-w-[220px] text-[10px] font-normal border-red-200 bg-red-50 text-red-800"
                                    title={`${topic.correct} de ${topic.total} correctas`}
                                  >
                                    <span className="truncate">{topic.topicName}</span>
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                            {formatDateTime(student.lastAttemptAt)}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMember(student.memberId)}
                              aria-label={`Quitar a ${student.displayName}`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Tocá el nombre para ver la ficha completa. Los marcados “sin verificar” entraron como invitados:
                escribieron su nombre sin iniciar sesión.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="temas">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Target className="w-4 h-4" />
                Cómo le fue al grupo por tema
              </h3>

              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay respuestas suficientes. Aparecen acá los temas con al menos 3 respuestas del grupo.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topics.map((topic) => (
                    <li key={topic.topicName} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm min-w-0 break-words">{topic.topicName}</span>
                        <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                          {topic.correct}/{topic.total} · {topic.studentCount}{' '}
                          {topic.studentCount === 1 ? 'alumno' : 'alumnos'}
                        </span>
                      </div>
                      <AccuracyBar accuracy={topic.accuracy} />
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-xs text-muted-foreground">
                Ordenados de peor a mejor. Por debajo del 60% conviene volver sobre el tema en clase.
              </p>
            </Card>
          </TabsContent>

          <TabsContent value="cuestionarios">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarClock className="w-4 h-4" />
                Cuestionarios asignados
              </h3>

              {assignments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Todavía no asignaste ninguno. Andá a “Mis cuestionarios” y usá “Asignar a un aula”.
                </p>
              )}

              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                {assignments.map((assignment) => (
                  <Card key={assignment.id} className="p-3 space-y-2 border self-start">
                    <div>
                      <p className="font-semibold text-sm break-words">{assignment.title}</p>
                      <p className="text-xs text-muted-foreground">{assignment.questionCount} preguntas</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="secondary">{assignment.submittedCount} entregaron</Badge>
                      {assignment.pendingCount > 0 && (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          {assignment.pendingCount} pendientes
                        </Badge>
                      )}
                    </div>

                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li>Promedio del curso (mejor intento): {formatScore(assignment.averageScore)}</li>
                      <li>Desde: {formatDateTime(assignment.opensAt)}</li>
                      <li>Hasta: {formatDateTime(assignment.dueAt)}</li>
                      <li>Intentos: {assignment.maxAttempts ?? 'sin límite'} · {assignment.attemptCount} realizados</li>
                    </ul>

                    <Button size="sm" variant="ghost" onClick={() => handleRemoveAssignment(assignment.id)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Quitar del aula
                    </Button>
                  </Card>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <ClassroomStudentDialog
          classroomId={activeClassroom.id}
          student={openStudent}
          onOpenChange={(open) => !open && setOpenStudent(null)}
        />

        <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar el aula “{pendingDelete?.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borran el código, la lista de alumnos y las asignaciones. Los cuestionarios que ya resolvieron
                quedan en su historial. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={handleDelete}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ─── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Mis aulas</h2>
            <p className="text-sm text-muted-foreground">
              Cada aula entrega una materia. Repartí su código y tus alumnos practican ese temario.
            </p>
          </div>
          <Button onClick={() => setShowCreate((prev) => !prev)} className="rounded-xl font-bold">
            <Plus className="w-4 h-4 mr-2" />
            Crear aula
          </Button>
        </div>

        {showCreate && (
          <Card className="p-4 space-y-3 border-dashed">
            <div className="space-y-1">
              <Label className="text-xs">Materia</Label>
              {programs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Primero creá una materia en “Mis materias”.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {programs.map((program) => (
                    <Button
                      key={program.id}
                      type="button"
                      size="sm"
                      variant={newProgramId === program.id ? 'default' : 'outline'}
                      onClick={() => setNewProgramId(program.id)}
                    >
                      {program.subjectName}
                      {program.grado ? <span className="ml-1.5 text-[11px] opacity-70">{program.grado}</span> : null}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Nombre del aula</Label>
              <Input
                placeholder="Ej: 3° A turno mañana"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="max-w-sm"
              />
            </div>

            <Button onClick={handleCreate} disabled={isCreating || programs.length === 0}>
              {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear aula y generar código
            </Button>
          </Card>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando tus aulas...
          </p>
        )}

        {!isLoading && classrooms.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no creaste ninguna aula.</p>
        )}

        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {classrooms.map((classroom) => {
            const Icon = SUBJECT_ICON_COMPONENTS[classroom.icon_name] ?? SUBJECT_ICON_COMPONENTS['book-open']
            const chipClass = SUBJECT_COLOR_CLASS[classroom.color_name]?.chip ?? 'bg-teal-500'

            return (
              <Card
                key={classroom.id}
                className="p-4 space-y-2 border-2 cursor-pointer hover:border-primary/40 transition-colors self-start"
                onClick={() => setActiveId(classroom.id)}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-9 h-9 rounded-lg ${chipClass} text-white flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm leading-snug break-words">{classroom.name}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {classroom.subject_name}
                      {classroom.grado ? ` · ${classroom.grado}` : ''}
                    </p>
                  </div>
                </div>

                <p className="font-mono text-lg font-bold tracking-[0.2em]">{classroom.join_code}</p>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{classroom.member_count} alumnos</span>
                  <span>·</span>
                  <span>{classroom.assignment_count} asignados</span>
                  {classroom.status === 'closed' && <Badge variant="outline">Cerrada</Badge>}
                </div>
              </Card>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/**
 * Aviso de tope de invitados nuevos. Sin esto, cuando el aula llega al tope el
 * docente sólo se entera por un alumno que dice "no me deja entrar", que es
 * otra vez un corte disfrazado de "no anda". Aparece al 75% para dar tiempo a
 * que el resto entre con Google antes de que alguien quede afuera.
 */
function GuestCapNotice({ newGuests, limit }: { newGuests: number; limit: number }) {
  const status = guestCapStatus(newGuests, limit)
  if (status === 'ok') return null

  const reached = status === 'reached'

  return (
    <div
      role={reached ? 'alert' : 'status'}
      className={cn(
        'flex gap-2 rounded-lg border p-3 text-xs leading-relaxed',
        reached
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-semibold">
          {reached
            ? `Tu aula llegó al tope de ${limit} ingresos sin cuenta en 24 h.`
            : `Tu aula lleva ${newGuests} de ${limit} ingresos sin cuenta permitidos en 24 h.`}
        </p>
        <p>
          {reached
            ? 'Los que intenten entrar sin cuenta ahora ven un aviso y no pueden sumarse; con cuenta de Google entran igual. '
            : 'Al llegar al tope, los próximos sin cuenta no van a poder entrar. '}
          Si son tus alumnos, pediles que ingresen con Google. Si no reconocés a los que entraron, el código puede
          haberse filtrado: regeneralo. Regenerar corta la filtración, pero el cupo se va liberando a medida que
          pasan las 24 h de cada ingreso.
        </p>
      </div>
    </div>
  )
}
