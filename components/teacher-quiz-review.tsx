'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LaTeXRenderer } from '@/components/latex-renderer'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { stableStringify } from '@/lib/stable-json'
import type { Question, TeacherQuiz } from '@/lib/types'

/**
 * Revisión y edición de un cuestionario guardado, pregunta por pregunta.
 *
 * ─── Por qué existe ─────────────────────────────────────────────────────────
 *
 * Hasta ahora "Previsualizar" reusaba el motor del cuestionario: para leer la
 * pregunta 12 había que contestar once. Eso sirve para probar la experiencia
 * del alumno y no sirve para revisar. Si de 20 preguntas hay 2 que no
 * convencen, las opciones eran asignar algo que no gusta o descartar las 20.
 *
 * ─── Lo que NO hace, y es a propósito ───────────────────────────────────────
 *
 * No guarda solo. Nada de autosave: un cuestionario asignado se sirve a los
 * alumnos por JOIN en vivo, así que un guardado que el docente no pidió puede
 * cambiarle el examen a alguien que lo está rindiendo. Guardar es siempre un
 * acto explícito, y el servidor además vuelve a chequearlo.
 */

interface ImpactAssignment {
  assignmentId: number
  classroomId: number
  classroomName: string
  studentsStarted: number
  attempts: number
}

interface QuizImpact {
  assignments: ImpactAssignment[]
  totalAttempts: number
  totalStudents: number
  requiresDecision: boolean
}

interface TeacherQuizReviewProps {
  quiz: TeacherQuiz
  onClose: () => void
  /** Se llama con el cuestionario que devolvió el servidor: puede ser una copia. */
  onSaved: (quiz: TeacherQuiz, info: { copiado: boolean; reasignadas: number }) => void
}

/** Etiqueta legible del tipo, para el badge de cada pregunta. */
const TIPO_LABEL: Record<Question['type'], string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero o falso',
  numeric: 'Numérica',
  short_answer: 'Respuesta corta',
}

function origenDe(question: Question): 'ai' | 'ai_regenerada' | 'editada' {
  return question.origin ?? 'ai'
}

export function TeacherQuizReview({ quiz, onClose, onSaved }: TeacherQuizReviewProps) {
  const { toast } = useToast()

  /**
   * Instantánea de lo último guardado, contra la que se compara para saber si
   * quedan cambios pendientes.
   *
   * Es ESTADO y no un ref: con un ref, después de guardar se actualiza
   * `.current` pero `questions` no cambia, así que el memo no se recalcula.
   *
   * Y se compara con `stableStringify`, no con `JSON.stringify`. Ese fue el
   * segundo intento de arreglar el mismo síntoma: Postgres reordena las claves
   * del `jsonb`, así que la instantánea que volvía del PATCH nunca coincidía
   * con el estado local aunque el dato fuera idéntico, y el cartel de "cambios
   * sin guardar" no se apagaba jamás. Ver lib/stable-json.ts.
   */
  const [guardadoComo, setGuardadoComo] = useState<string>(() => stableStringify(quiz.questions))
  const [questions, setQuestions] = useState<Question[]>(() => structuredClone(quiz.questions))
  const [editando, setEditando] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  /** Índice que se está regenerando, para el spinner de esa fila. */
  const [regenerando, setRegenerando] = useState<number | null>(null)
  /** La pregunta que volvió de la IA, esperando que el docente la acepte. */
  const [propuesta, setPropuesta] = useState<{ index: number; question: Question } | null>(null)
  /** Diálogo de motivo antes de pedir la regeneración. */
  const [pidiendoMotivo, setPidiendoMotivo] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')

  const [conflicto, setConflicto] = useState<QuizImpact | null>(null)
  const [salidaPendiente, setSalidaPendiente] = useState(false)

  const sucio = useMemo(() => stableStringify(questions) !== guardadoComo, [questions, guardadoComo])

  const editadas = useMemo(
    () => questions.filter((q) => origenDe(q) !== 'ai').length,
    [questions],
  )

  // ─── Guardas de salida ─────────────────────────────────────────────────────
  //
  // Con 20 preguntas editables es fácil perder trabajo. Dos guardas distintas
  // porque son dos salidas distintas: cerrar la pestaña la atrapa el navegador,
  // y volver atrás dentro de la app la atrapamos nosotros.
  useEffect(() => {
    if (!sucio) return

    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Los navegadores modernos ignoran el texto y muestran el suyo; lo que
      // importa es que preventDefault dispare el diálogo.
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [sucio])

  const intentarSalir = useCallback(() => {
    if (sucio) {
      setSalidaPendiente(true)
      return
    }
    onClose()
  }, [sucio, onClose])

  // ─── Edición ───────────────────────────────────────────────────────────────

  const actualizar = useCallback((index: number, cambios: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? // `origin: 'editada'` en cuanto se toca un campo. Una pregunta
            // regenerada que después se edita a mano queda como editada: lo
            // último que le pasó al texto es lo que describe de dónde salió.
            ({ ...q, ...cambios, origin: 'editada' } as Question)
          : q,
      ),
    )
  }, [])

  const eliminar = useCallback((index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
    setEditando(null)
  }, [])

  // ─── Regeneración ──────────────────────────────────────────────────────────

  const pedirRegeneracion = useCallback(
    async (index: number, nota: string) => {
      setPidiendoMotivo(null)
      setRegenerando(index)
      try {
        const res = await fetch(`/api/teacher/quizzes/${quiz.id}/regenerate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionIndex: index, rejectionNote: nota.trim() || undefined }),
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok || !data?.question) {
          toast({
            variant: 'destructive',
            title: 'No pudimos regenerar la pregunta',
            description: data?.error || `HTTP ${res.status}`,
          })
          return
        }

        // No se aplica sola: se muestra al lado de la vieja para que el docente
        // compare y decida. La ruta devuelve sin guardar justamente para esto.
        setPropuesta({ index, question: data.question as Question })
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'No pudimos regenerar la pregunta',
          description: err instanceof Error ? err.message : 'Error de red',
        })
      } finally {
        setRegenerando(null)
      }
    },
    [quiz.id, toast],
  )

  const aceptarPropuesta = useCallback(() => {
    if (!propuesta) return
    setQuestions((prev) => prev.map((q, i) => (i === propuesta.index ? propuesta.question : q)))
    setPropuesta(null)
    setMotivo('')
  }, [propuesta])

  // ─── Guardado ──────────────────────────────────────────────────────────────

  const guardar = useCallback(
    async (strategy: 'in_place' | 'copy') => {
      setGuardando(true)
      try {
        const res = await fetch(`/api/teacher/quizzes/${quiz.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions, strategy }),
        })
        const data = await res.json().catch(() => ({}))

        // 409 con `requiresDecision`: ya hay alumnos que rindieron. No es un
        // error — es la pregunta que el servidor devuelve en vez de pisar algo.
        if (res.status === 409 && data?.requiresDecision) {
          setConflicto(data.impact as QuizImpact)
          return
        }

        if (!res.ok || !data?.quiz) {
          toast({
            variant: 'destructive',
            title: 'No se pudo guardar',
            description: data?.error || `HTTP ${res.status}`,
          })
          return
        }

        const guardado = data.quiz as Record<string, unknown>
        const delServidor = (guardado.questions as Question[]) ?? questions
        const normalizado: TeacherQuiz = {
          ...quiz,
          id: Number(guardado.id),
          questionCount: Number(guardado.question_count),
          questions: delServidor,
        }

        // Se adopta lo que devolvió el servidor como estado local Y como
        // instantánea, del mismo valor. Antes sólo se movía la instantánea, y
        // como Postgres reordena las claves del `jsonb`, el baseline quedaba
        // con un orden y el estado local con otro: `sucio` no volvía a false
        // nunca, el cartel de "cambios sin guardar" no se apagaba y salir pedía
        // confirmación sobre un cuestionario ya guardado.
        //
        // La comparación además usa `stableStringify`, así que el orden de
        // claves deja de importar aunque en el futuro los dos valores no salgan
        // de la misma fuente.
        setQuestions(delServidor)
        setGuardadoComo(stableStringify(delServidor))
        setConflicto(null)
        onSaved(normalizado, {
          copiado: Boolean(data.copiado),
          reasignadas: Number(data.reasignadas ?? 0),
        })

        toast({
          title: data.copiado ? 'Guardado como copia' : 'Cuestionario guardado',
          description: data.copiado
            ? `El original quedó intacto con los intentos ya rendidos. ${data.reasignadas} asignación(es) ahora usan la versión nueva.`
            : `${normalizado.questions.length} preguntas.`,
        })
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'No se pudo guardar',
          description: err instanceof Error ? err.message : 'Error de red',
        })
      } finally {
        setGuardando(false)
      }
    },
    [quiz, questions, onSaved, toast],
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Barra fija: el estado de "sin guardar" tiene que estar siempre a la
          vista, no al final de una lista de 20 preguntas. */}
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-b bg-background/95 px-2 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={intentarSalir}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            {questions.length} preguntas
            {editadas > 0 && ` · ${editadas} revisada${editadas === 1 ? '' : 's'}`}
          </p>
        </div>

        {sucio ? (
          <Badge variant="outline" className="border-amber-500/50 text-amber-600">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Cambios sin guardar
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <Check className="mr-1 h-3 w-3" />
            Todo guardado
          </Badge>
        )}

        <Button size="sm" disabled={!sucio || guardando} onClick={() => guardar('in_place')}>
          {guardando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Guardar
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Borraste todas las preguntas. Volvé atrás para descartar, o guardá si es lo que querías.
        </p>
      )}

      <ol className="space-y-3">
        {questions.map((q, index) => {
          const origen = origenDe(q)
          const enEdicion = editando === index

          return (
            <li key={`${q.id}-${index}`}>
              <Card className={cn('space-y-3 p-4', enEdicion && 'border-primary')}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {TIPO_LABEL[q.type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{q.topicName}</span>
                      {origen === 'editada' && (
                        <Badge variant="outline" className="text-[10px]">
                          <Pencil className="mr-1 h-2.5 w-2.5" />
                          editada
                        </Badge>
                      )}
                      {origen === 'ai_regenerada' && (
                        <Badge variant="outline" className="text-[10px]">
                          <Sparkles className="mr-1 h-2.5 w-2.5" />
                          regenerada
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Con texto visible, no sólo el ícono. Un lápiz y un tacho
                      se adivinan; el de "regenerar" no — son flechas en
                      círculo, que en otras apps significa deshacer, recargar o
                      sincronizar. Son tres acciones y hay lugar, así que el
                      texto no cuesta nada. En pantallas chicas queda sólo el
                      ícono, y ahí el aria-label y el title siguen puestos. */}
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant={enEdicion ? 'default' : 'outline'}
                      onClick={() => setEditando(enEdicion ? null : index)}
                      title={enEdicion ? 'Terminar de editar esta pregunta' : 'Editar el texto de esta pregunta'}
                      aria-label={enEdicion ? 'Terminar edición' : 'Editar pregunta'}
                    >
                      {enEdicion ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      <span className="ml-1 hidden sm:inline">{enEdicion ? 'Listo' : 'Editar'}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={regenerando !== null}
                      onClick={() => {
                        setMotivo('')
                        setPidiendoMotivo(index)
                      }}
                      title="Pedirle a la IA otra pregunta sobre el mismo tema"
                      aria-label="Regenerar pregunta"
                    >
                      {regenerando === index ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">Regenerar</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => eliminar(index)}
                      title="Quitar esta pregunta del cuestionario"
                      aria-label="Eliminar pregunta"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="ml-1 hidden sm:inline">Quitar</span>
                    </Button>
                  </div>
                </div>

                {enEdicion ? (
                  <EditorDePregunta question={q} onChange={(cambios) => actualizar(index, cambios)} />
                ) : (
                  <VistaDePregunta question={q} />
                )}
              </Card>
            </li>
          )
        })}
      </ol>

      {/* ─── Motivo del rechazo (opcional) ─────────────────────────────────── */}
      <Dialog open={pidiendoMotivo !== null} onOpenChange={(open) => !open && setPidiendoMotivo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerar esta pregunta</DialogTitle>
            <DialogDescription>
              Si querés, contá qué no te convenció. Va al pedido para que la nueva no repita el
              problema — pero es opcional: podés regenerar sin dar motivo.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Por ejemplo: el enunciado es ambiguo, o dos opciones son correctas."
            rows={3}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPidiendoMotivo(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => pidiendoMotivo !== null && pedirRegeneracion(pidiendoMotivo, motivo)}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Regenerar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Propuesta: la nueva al lado de la vieja ───────────────────────── */}
      <Dialog open={propuesta !== null} onOpenChange={(open) => !open && setPropuesta(null)}>
        {/* Ancho de verdad en desktop: dos columnas con LaTeX necesitan
            lugar, y a max-w-3xl el texto se apilaba como en mobile. El
            max-height del base sigue actuando —no se toca acá— así que el
            diálogo scrollea igual cuando la pregunta es larga. */}
        <DialogContent className="w-[95vw] max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Pregunta nueva</DialogTitle>
            <DialogDescription>
              Todavía no se aplicó. Compará con la actual y decidí.
            </DialogDescription>
          </DialogHeader>

          {propuesta && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Actual</p>
                <Card className="p-3 opacity-70">
                  <VistaDePregunta question={questions[propuesta.index]} />
                </Card>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Propuesta</p>
                <Card className="border-primary p-3">
                  <VistaDePregunta question={propuesta.question} />
                </Card>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setPropuesta(null)}>
              <Undo2 className="mr-1 h-4 w-4" />
              Descartar y quedarme con la actual
            </Button>
            <Button
              variant="outline"
              disabled={regenerando !== null}
              onClick={() => {
                const index = propuesta?.index
                setPropuesta(null)
                if (index !== undefined) pedirRegeneracion(index, motivo)
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Pedir otra
            </Button>
            <Button onClick={aceptarPropuesta}>
              <Check className="mr-1 h-4 w-4" />
              Usar la nueva
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Conflicto: ya hay alumnos que rindieron ───────────────────────── */}
      <Dialog open={conflicto !== null} onOpenChange={(open) => !open && setConflicto(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Este cuestionario ya fue rendido</DialogTitle>
            <DialogDescription>
              {conflicto && (
                <>
                  <strong>
                    {conflicto.totalStudents} alumno{conflicto.totalStudents === 1 ? '' : 's'}
                  </strong>{' '}
                  ya lo rindieron, con {conflicto.totalAttempts} intento
                  {conflicto.totalAttempts === 1 ? '' : 's'} en total.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {conflicto && conflicto.assignments.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-muted/40 p-3 text-sm">
              {conflicto.assignments.map((a) => (
                <li key={a.assignmentId} className="flex justify-between gap-2">
                  <span className="truncate">{a.classroomName}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {a.studentsStarted} alumno{a.studentsStarted === 1 ? '' : 's'} · {a.attempts} intento
                    {a.attempts === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-sm text-muted-foreground">
            Guardar como copia deja el original intacto con los intentos ya rendidos, y hace que las
            aulas pasen a usar la versión corregida de acá en adelante. Las notas ya puestas no se
            mueven.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConflicto(null)}>
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => guardar('copy')}>
              {guardando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
              Guardar como copia
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Salir con cambios sin guardar ─────────────────────────────────── */}
      <Dialog open={salidaPendiente} onOpenChange={setSalidaPendiente}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tenés cambios sin guardar</DialogTitle>
            <DialogDescription>
              Si salís ahora se pierden las ediciones y las preguntas regeneradas que aceptaste.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setSalidaPendiente(false)}>
              Seguir editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSalidaPendiente(false)
                onClose()
              }}
            >
              <X className="mr-1 h-4 w-4" />
              Salir sin guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Vista de una pregunta ───────────────────────────────────────────────────

function VistaDePregunta({ question }: { question: Question }) {
  return (
    <div className="space-y-2 text-sm">
      <LaTeXRenderer content={question.question} className="font-medium" />

      {question.type === 'multiple_choice' && (
        <ul className="space-y-1">
          {question.options.map((opcion, i) => (
            <li
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md px-2 py-1',
                i === question.correctAnswer && 'bg-emerald-500/10 font-semibold',
              )}
            >
              <span className="shrink-0 text-xs text-muted-foreground">
                {String.fromCharCode(65 + i)}.
              </span>
              <LaTeXRenderer content={opcion} />
              {i === question.correctAnswer && <Check className="ml-auto h-4 w-4 shrink-0 text-emerald-600" />}
            </li>
          ))}
        </ul>
      )}

      {question.type === 'true_false' && (
        <p className="text-sm">
          Correcta: <strong>{question.correctAnswer ? 'Verdadero' : 'Falso'}</strong>
        </p>
      )}

      {question.type === 'numeric' && (
        <p className="text-sm">
          Correcta: <strong>{question.correctAnswer}</strong>
          {question.tolerance ? ` (± ${question.tolerance})` : ''}
        </p>
      )}

      {question.type === 'short_answer' && (
        <p className="text-sm">
          Acepta: <strong>{question.acceptedAnswers.join(' · ')}</strong>
        </p>
      )}

      {question.explanation && (
        <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          <LaTeXRenderer content={question.explanation} />
        </div>
      )}
    </div>
  )
}

// ─── Editor de una pregunta ──────────────────────────────────────────────────

function EditorDePregunta({
  question,
  onChange,
}: {
  question: Question
  onChange: (cambios: Partial<Question>) => void
}) {
  return (
    <div className="space-y-3">
      <Campo label="Enunciado">
        <Textarea
          value={question.question}
          rows={3}
          onChange={(e) => onChange({ question: e.target.value } as Partial<Question>)}
        />
      </Campo>

      {question.type === 'multiple_choice' && (
        <Campo label="Opciones — marcá la correcta">
          <div className="space-y-2">
            {question.options.map((opcion, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correcta-${question.id}`}
                  checked={question.correctAnswer === i}
                  onChange={() => onChange({ correctAnswer: i } as Partial<Question>)}
                  aria-label={`Marcar opción ${String.fromCharCode(65 + i)} como correcta`}
                />
                <Input
                  value={opcion}
                  onChange={(e) => {
                    const options = [...question.options]
                    options[i] = e.target.value
                    onChange({ options } as Partial<Question>)
                  }}
                />
              </div>
            ))}
          </div>
        </Campo>
      )}

      {question.type === 'true_false' && (
        <Campo label="Respuesta correcta">
          <div className="flex gap-2">
            {[true, false].map((valor) => (
              <Button
                key={String(valor)}
                type="button"
                size="sm"
                variant={question.correctAnswer === valor ? 'default' : 'outline'}
                onClick={() => onChange({ correctAnswer: valor } as Partial<Question>)}
              >
                {valor ? 'Verdadero' : 'Falso'}
              </Button>
            ))}
          </div>
        </Campo>
      )}

      {question.type === 'numeric' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Respuesta correcta">
            <Input
              // `text` y no `number`: en es-AR el input numérico del navegador
              // descarta la coma decimal. Es el mismo bug que ya se arregló en
              // el input del alumno (numeric-input.tsx).
              type="text"
              inputMode="decimal"
              value={String(question.correctAnswer)}
              onChange={(e) => {
                const parsed = Number(e.target.value.replace(',', '.'))
                if (!Number.isNaN(parsed)) onChange({ correctAnswer: parsed } as Partial<Question>)
              }}
            />
          </Campo>
          <Campo label="Tolerancia (opcional)">
            <Input
              type="text"
              inputMode="decimal"
              value={question.tolerance === undefined ? '' : String(question.tolerance)}
              onChange={(e) => {
                const raw = e.target.value.trim()
                if (raw === '') return onChange({ tolerance: undefined } as Partial<Question>)
                const parsed = Number(raw.replace(',', '.'))
                if (!Number.isNaN(parsed)) onChange({ tolerance: parsed } as Partial<Question>)
              }}
            />
          </Campo>
        </div>
      )}

      {question.type === 'short_answer' && (
        <Campo label="Respuestas aceptadas — una por línea">
          <Textarea
            rows={3}
            value={question.acceptedAnswers.join('\n')}
            onChange={(e) =>
              onChange({
                acceptedAnswers: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              } as Partial<Question>)
            }
          />
        </Campo>
      )}

      <Campo label="Explicación">
        <Textarea
          rows={2}
          value={question.explanation}
          onChange={(e) => onChange({ explanation: e.target.value } as Partial<Question>)}
        />
      </Campo>
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
