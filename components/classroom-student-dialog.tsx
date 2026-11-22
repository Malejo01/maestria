'use client'

import { Cargando } from '@/components/sistema/cargando'


import { useEffect, useState } from 'react'
import { Boton } from '@/components/sistema/boton'
import { pedirJson } from '@/lib/pedir-json'
import { A_REFORZAR, PRACTICA_EXTRA, FICHA_A_REFORZAR } from '@/lib/textos'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BadgeCheck, Lightbulb, Target } from 'lucide-react'
import { AccuracyBar, formatDateTime, formatScore } from '@/components/classroom-report-parts'

interface StudentAttempt {
  /** P4: salió de "Practicar otra vez" de una tarea. */
  practicaExtra?: boolean
  id: number
  mode: string
  score: number | null
  passed: boolean
  totalQuestions: number
  correctAnswers: number
  attemptNumber: number | null
  completedAt: string
  assignmentTitle: string | null
}

interface StudentTopic {
  topicName: string
  total: number
  correct: number
  accuracy: number
}

interface StudentTip {
  id: number
  topicName: string
  misconceptionType: string
  tip: string
  resolved: boolean
}

interface ClassroomStudentDialogProps {
  classroomId: number
  student: { userId: string; displayName: string; isVerified: boolean } | null
  onOpenChange: (open: boolean) => void
}

/**
 * One student's file inside an aula: what they did, where they fail, and the
 * tips the AI already gave them. Everything shown here is scoped to this aula
 * (see the API) — the teacher never sees the student's activity elsewhere.
 */
export function ClassroomStudentDialog({ classroomId, student, onOpenChange }: ClassroomStudentDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [attempts, setAttempts] = useState<StudentAttempt[]>([])
  const [topics, setTopics] = useState<StudentTopic[]>([])
  const [tips, setTips] = useState<StudentTip[]>([])
  // P7: "A reforzar" con la misma función que Mi progreso del alumno.
  const [aReforzar, setAReforzar] = useState<{ topic: string; topicName: string; count: number }[]>([])
  const [practicasExtra, setPracticasExtra] = useState<{ cantidad: number; promedio: number | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // O2: el docente marca un tema como superado (o lo devuelve a reforzar).
  const [marcando, setMarcando] = useState<number | null>(null)

  async function marcar(tip: StudentTip, superado: boolean) {
    if (!student) return
    setMarcando(tip.id)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${classroomId}/students/${encodeURIComponent(student.userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ misconceptionId: tip.id, superado }),
    })
    setMarcando(null)
    if ('error' in respuesta) {
      setError(respuesta.error)
      return
    }
    setTips((prev) => prev.map((t) => (t.id === tip.id ? { ...t, resolved: superado } : t)))
  }

  useEffect(() => {
    if (!student) return

    let isMounted = true
    setIsLoading(true)
    setError(null)

    fetch(`/api/teacher/classrooms/${classroomId}/students/${encodeURIComponent(student.userId)}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json() }))
      .then(({ ok, data }) => {
        if (!isMounted) return
        if (!ok) {
          setError(data?.error || 'No se pudo abrir la ficha')
          return
        }
        setAttempts(Array.isArray(data.attempts) ? data.attempts : [])
        setTopics(Array.isArray(data.topics) ? data.topics : [])
        setTips(Array.isArray(data.tips) ? data.tips : [])
        setAReforzar(Array.isArray(data.aReforzar) ? data.aReforzar : [])
        setPracticasExtra(data.practicasExtra && Number(data.practicasExtra.cantidad) > 0 ? data.practicasExtra : null)
      })
      .catch(() => {
        if (isMounted) setError('No se pudo abrir la ficha')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [classroomId, student])

  return (
    <Dialog open={Boolean(student)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            {student?.displayName}
            {student?.isVerified ? (
              <BadgeCheck className="w-4 h-4 text-logrado" aria-label="Cuenta verificada" />
            ) : (
              <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                sin verificar
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Actividad de este alumno dentro del grupo.</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Cargando className="w-4 h-4" /> Cargando ficha...
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && !error && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                Precisión por tema
              </h3>

              {topics.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no respondió preguntas en este grupo.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topics.map((topic) => (
                    <li key={topic.topicName} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 break-words">{topic.topicName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {topic.correct}/{topic.total}
                        </span>
                      </div>
                      <AccuracyBar accuracy={topic.accuracy} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {aReforzar.length > 0 && (
              <Card className="p-4 space-y-2" data-a-reforzar="">
                <h3 className="font-semibold text-sm">{FICHA_A_REFORZAR.titulo(aReforzar.length)}</h3>
                <ul className="flex flex-wrap gap-2">
                  {aReforzar.map((t) => (
                    <li key={t.topic} className="nota rounded-full bg-flojo-fondo px-3 py-1 text-texto">
                      {t.topicName}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card className="p-4 space-y-2">
              <h3 className="font-semibold text-sm">Cuestionarios resueltos ({attempts.length})</h3>
              {/* P4: las prácticas extra de sus tareas, aparte: no cambian la nota de la tarea. */}
              {practicasExtra && (
                <p className="nota text-texto-suave">{PRACTICA_EXTRA.resumen(practicasExtra.cantidad, practicasExtra.promedio)}</p>
              )}

              {attempts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no resolvió ninguno.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                        <th className="py-2 pr-3">Cuestionario</th>
                        <th className="py-2 pr-3">Nota</th>
                        <th className="py-2 pr-3">Aciertos</th>
                        <th className="py-2">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((attempt) => (
                        <tr key={attempt.id} className="border-b last:border-0">
                          <td className="py-2 pr-3">
                            <span className="break-words">{attempt.practicaExtra ? PRACTICA_EXTRA.etiqueta : attempt.assignmentTitle ?? 'Práctica libre'}</span>
                            {attempt.attemptNumber ? (
                              <span className="text-xs text-muted-foreground"> · intento {attempt.attemptNumber}</span>
                            ) : null}
                          </td>
                          <td className={`py-2 pr-3 font-semibold ${attempt.passed ? 'text-logrado' : 'text-destructive'}`}>
                            {formatScore(attempt.score)}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {attempt.correctAnswers}/{attempt.totalQuestions}
                          </td>
                          <td className="py-2 text-muted-foreground">{formatDateTime(attempt.completedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {tips.length > 0 && (
              <Card className="p-4 space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  Errores detectados por la IA
                </h3>
                <ul className="space-y-2">
                  {tips.map((tip, index) => (
                    <li key={tip.id ?? index} className="text-sm border-l-2 pl-3 py-0.5">
                      <p className="font-medium">
                        {tip.topicName}
                        <span className="text-xs text-muted-foreground font-normal"> · {tip.misconceptionType}</span>
                        {tip.resolved && <span className="text-xs font-semibold text-logrado"> · {A_REFORZAR.superado}</span>}
                      </p>
                      <p className="text-muted-foreground leading-snug">{tip.tip}</p>
                      {typeof tip.id === 'number' && (
                        <Boton
                          variante="secundario"
                          className="mt-1 min-h-8 px-2 text-xs"
                          disabled={marcando === tip.id}
                          onClick={() => void marcar(tip, !tip.resolved)}
                        >
                          {tip.resolved ? A_REFORZAR.volverAReforzar : A_REFORZAR.marcarSuperado}
                        </Boton>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
