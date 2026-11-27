'use client'

import { cantidadDeHuecos, correctaEnTexto, ETIQUETA_DE_TIPO } from '@/lib/tipos-moodle'
import { calculadaValida, instanciarCalculada } from '@/lib/calculada'
import { ENSAYO, TIPOS_MOODLE_TEXTOS } from '@/lib/textos'
import { limpiarRubrica, MAXIMO_CRITERIOS, MINIMO_CRITERIOS, rubricaValida } from '@/lib/ensayo'
import { Cargando } from '@/components/sistema/cargando'
import { GraficoFuncion } from '@/components/grafico-funcion'


import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ListChecks,
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
import { comaDecimal, formatearNumero, respuestaCorrectaNumerica } from '@/lib/numeros'
import { leerRespuesta, type Fraccion } from '@/lib/fraccion'
import type { Question, TeacherQuiz } from '@/lib/types'
import { leerBloqueo, type CuerpoDeBloqueo } from '@/lib/planes'
import { DialogoDeLimite } from '@/components/docente/pantalla-de-limite'
import { CORREGIR_TIPOS, TECLADO_MATEMATICO, TIPO_INCOHERENTE } from '@/lib/textos'
import { problemaDeTipo } from '@/lib/validar-tipo-de-pregunta'
import { contarMarcadas } from '@/lib/corregir-tipos'
import { CorregirTiposDialog } from '@/components/docente/corregir-tipos-dialog'
import { ValorarPregunta } from '@/components/docente/valorar-pregunta'
import { pedirJson } from '@/lib/pedir-json'
import type { Motivo, Valoracion } from '@/lib/valoraciones'
import { VALORACIONES, REVISA_Y_APROBA } from '@/lib/textos'
import { alternarAprobada, aprobarTodas, claveDePregunta, contarRevisadas, necesitaRevision, textoDelContador } from '@/lib/revisa-y-aproba'

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
  /**
   * AB7: «Aprobar todas y mandar». Con cambios sin guardar, primero guarda (y
   * si el servidor pide decidir por intentos ya hechos, no manda). Sin esto,
   * el botón no aparece.
   */
  onAprobarYMandar?: (quiz: TeacherQuiz) => void
}

/** Etiqueta legible del tipo, para el badge de cada pregunta. */
const TIPO_LABEL: Record<Question['type'], string> = ETIQUETA_DE_TIPO

function origenDe(question: Question): 'ai' | 'ai_regenerada' | 'editada' {
  return question.origin ?? 'ai'
}

export function TeacherQuizReview({ quiz, onClose, onSaved, onAprobarYMandar }: TeacherQuizReviewProps) {
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
  /** AB7: las preguntas que el docente aprobó en esta revisión (lib/revisa-y-aproba.ts). */
  const [aprobadas, setAprobadas] = useState<Set<string>>(() => new Set())

  /** Índice que se está regenerando, para el spinner de esa fila. */
  const [regenerando, setRegenerando] = useState<number | null>(null)
  /** La pregunta que volvió de la IA, esperando que el docente la acepte. */
  const [propuesta, setPropuesta] = useState<{ index: number; question: Question } | null>(null)
  /** Diálogo de motivo antes de pedir la regeneración. */
  const [pidiendoMotivo, setPidiendoMotivo] = useState<number | null>(null)
  const [motivo, setMotivo] = useState('')
  /** Un 402 del plan (vencido o tope del gratis): la pantalla de límite. */
  const [bloqueoPlan, setBloqueoPlan] = useState<CuerpoDeBloqueo | null>(null)

  const [conflicto, setConflicto] = useState<QuizImpact | null>(null)
  /** N2: el diálogo de corregir en lote lo marcado. */
  const [corrigiendo, setCorrigiendo] = useState(false)
  const marcadas = useMemo(() => contarMarcadas(questions), [questions])

  // O8: el pulgar del docente en cada pregunta (lo guardado, por índice).
  const [valoraciones, setValoraciones] = useState<Map<number, Valoracion>>(new Map())
  useEffect(() => {
    let vigente = true
    void pedirJson<{ valoraciones: Valoracion[] }>(`/api/teacher/quizzes/${quiz.id}/valoraciones`).then((r) => {
      if (vigente && !('error' in r) && Array.isArray(r.data?.valoraciones)) {
        setValoraciones(new Map(r.data.valoraciones.map((v) => [v.indice, v])))
      }
    })
    return () => {
      vigente = false
    }
  }, [quiz.id])

  const valorar = useCallback(
    async (indice: number, valor: 1 | -1, motivo: Motivo | null) => {
      const r = await pedirJson(`/api/teacher/quizzes/${quiz.id}/valoraciones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indice, valor, motivo }),
      })
      if ('error' in r) {
        toast({ variant: 'destructive', title: VALORACIONES.noSeGuardo, description: r.error })
        return false
      }
      setValoraciones((prev) => new Map(prev).set(indice, { indice, valor, motivo }))
      if (valor === -1) toast({ title: VALORACIONES.guardada })
      return true
    },
    [quiz.id, toast],
  )

  const sacarValoracion = useCallback(
    async (indice: number) => {
      const r = await pedirJson(`/api/teacher/quizzes/${quiz.id}/valoraciones?indice=${indice}`, { method: 'DELETE' })
      if ('error' in r) return false
      setValoraciones((prev) => {
        const sig = new Map(prev)
        sig.delete(indice)
        return sig
      })
      return true
    },
    [quiz.id],
  )
  const [salidaPendiente, setSalidaPendiente] = useState(false)

  const sucio = useMemo(() => stableStringify(questions) !== guardadoComo, [questions, guardadoComo])

  const editadas = useMemo(
    () => questions.filter((q) => origenDe(q) !== 'ai').length,
    [questions],
  )
  const revisadas = contarRevisadas(questions, aprobadas)

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
    async (index: number, nota: string, convertirA?: 'multiple_choice') => {
      setPidiendoMotivo(null)
      setRegenerando(index)
      try {
        const res = await fetch(`/api/teacher/quizzes/${quiz.id}/regenerate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // M2: `convertirA` arma la MISMA consigna como opción múltiple.
          body: JSON.stringify({ questionIndex: index, rejectionNote: nota.trim() || undefined, convertirA }),
        })
        const data = await res.json().catch(() => ({}))

        const frenado = res.status === 402 ? leerBloqueo(data) : null
        if (frenado) {
          setBloqueoPlan(frenado)
          return
        }

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
    async (strategy: 'in_place' | 'copy', status?: 'saved'): Promise<TeacherQuiz | null> => {
      setGuardando(true)
      try {
        const res = await fetch(`/api/teacher/quizzes/${quiz.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          // AC2: aprobar todas deja la tarea aprobada (`saved`): ya se puede mandar.
          body: JSON.stringify(status ? { questions, strategy, status } : { questions, strategy }),
        })
        const data = await res.json().catch(() => ({}))

        // 409 con `requiresDecision`: ya hay alumnos que rindieron. No es un
        // error — es la pregunta que el servidor devuelve en vez de pisar algo.
        if (res.status === 409 && data?.requiresDecision) {
          setConflicto(data.impact as QuizImpact)
          return null
        }

        if (!res.ok || !data?.quiz) {
          toast({
            variant: 'destructive',
            title: 'No se pudo guardar',
            description: data?.error || `HTTP ${res.status}`,
          })
          return null
        }

        const guardado = data.quiz as Record<string, unknown>
        const delServidor = (guardado.questions as Question[]) ?? questions
        const normalizado: TeacherQuiz = {
          ...quiz,
          status: (guardado.status as TeacherQuiz['status']) ?? quiz.status,
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
        return normalizado
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'No se pudo guardar',
          description: err instanceof Error ? err.message : 'Error de red',
        })
        return null
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
      <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-2 border-b bg-background/95 px-2 py-3">
        <Button variant="ghost" size="sm" onClick={intentarSalir}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver
        </Button>

        <div className="min-w-0 flex-1">
          {/* AB7: el paso se llama «Revisá y aprobá»: nada le llega al alumno sin tu OK. */}
          <p className="etiqueta uppercase text-texto-suave">{REVISA_Y_APROBA.titulo}</p>
          <p className="truncate text-sm font-semibold">{quiz.title}</p>
          <p className="text-xs text-muted-foreground">
            <span data-contador-revisadas>{textoDelContador(revisadas, questions.length)}</span>
            {editadas > 0 && ` · ${REVISA_Y_APROBA.editadas(editadas)}`}
          </p>
        </div>

        {sucio ? (
          <Badge variant="outline" className="border-flojo/50 text-flojo">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Cambios sin guardar
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <Check className="mr-1 h-3 w-3" />
            Todo guardado
          </Badge>
        )}

        <Button size="sm" variant={onAprobarYMandar ? 'outline' : 'default'} disabled={!sucio || guardando} onClick={() => guardar('in_place')}>
          {guardando ? <Cargando className="mr-1 h-4 w-4" /> : <Save className="mr-1 h-4 w-4" />}
          Guardar
        </Button>

        {onAprobarYMandar && (
          <Button
            size="sm"
            disabled={guardando || questions.length === 0}
            onClick={async () => {
              setAprobadas(aprobarTodas(questions))
              // Con cambios sin guardar, primero se guardan: lo que se manda es lo que se ve.
              // AC2: y si la tarea estaba sin aprobar, queda aprobada.
              const listo = sucio || necesitaRevision(quiz) ? await guardar('in_place', 'saved') : { ...quiz, questions }
              if (listo) onAprobarYMandar(listo)
            }}
          >
            <Check className="mr-1 h-4 w-4" />
            {REVISA_Y_APROBA.aprobarTodasYMandar}
          </Button>
        )}
      </div>

      {/* N2: lo marcado, de una vez y con antes → después. Lo aplicado queda
          en pantalla sin guardar: Guardar sigue siendo el único camino de
          escritura (y respeta los intentos ya hechos). */}
      {marcadas > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-flojo/50 p-3">
          <AlertTriangle className="h-4 w-4 text-flojo" aria-hidden="true" />
          <p className="flex-1 text-sm">{CORREGIR_TIPOS.resumen(marcadas)}</p>
          <Button size="sm" variant="outline" onClick={() => setCorrigiendo(true)}>
            {CORREGIR_TIPOS.boton(marcadas)}
          </Button>
        </div>
      )}
      <CorregirTiposDialog
        quizId={quiz.id}
        preguntas={questions}
        abierto={corrigiendo}
        onOpenChange={setCorrigiendo}
        alBloquear={setBloqueoPlan}
        alAplicar={(nuevas, cambios) => {
          setQuestions(nuevas)
          toast({ title: CORREGIR_TIPOS.aplicado(cambios), description: CORREGIR_TIPOS.aplicadoSinGuardar })
        }}
      />

      {questions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Borraste todas las preguntas. Volvé atrás para descartar, o guardá si es lo que querías.
        </p>
      )}

      <ol className="space-y-3">
        {questions.map((q, index) => {
          const origen = origenDe(q)
          const enEdicion = editando === index
          // M2: la consigna no encaja con su tipo (lib/validar-tipo-de-pregunta.ts).
          const problema = problemaDeTipo(q)

          const clave = claveDePregunta(q, index)
          const aprobada = aprobadas.has(clave)

          return (
            <li key={`${q.id}-${index}`}>
              <Card className={cn('space-y-3 p-4', enEdicion && 'border-primary', aprobada && !enEdicion && 'border-logrado')}>
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
                    {/* AB7: aprobar en un clic. */}
                    <Button
                      size="sm"
                      variant={aprobada ? 'default' : 'outline'}
                      aria-pressed={aprobada}
                      onClick={() => setAprobadas((actuales) => alternarAprobada(actuales, clave))}
                      title={aprobada ? REVISA_Y_APROBA.desaprobar : REVISA_Y_APROBA.aprobarTitulo}
                      aria-label={REVISA_Y_APROBA.aprobarEtiqueta(index + 1)}
                    >
                      <Check className="h-4 w-4" />
                      <span className="ml-1 hidden sm:inline">{aprobada ? REVISA_Y_APROBA.aprobada : REVISA_Y_APROBA.aprobar}</span>
                    </Button>
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
                        <Cargando className="h-4 w-4" />
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

                {problema && !enEdicion && (
                  <div
                    role="note"
                    className="flex flex-col gap-2 rounded-md border border-flojo/40 bg-flojo-fondo p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-texto">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-flojo" aria-hidden="true" />
                        {TIPO_INCOHERENTE.aviso}
                      </p>
                      <p className="text-xs text-texto-suave">{TIPO_INCOHERENTE.detalle[problema]}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {q.type !== 'multiple_choice' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={regenerando !== null}
                          onClick={() => pedirRegeneracion(index, '', 'multiple_choice')}
                        >
                          {regenerando === index ? <Cargando className="mr-1 h-4 w-4" /> : <ListChecks className="mr-1 h-4 w-4" />}
                          {regenerando === index ? TIPO_INCOHERENTE.convirtiendo : TIPO_INCOHERENTE.pasarAOpcionMultiple}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setEditando(index)}>
                        <Pencil className="mr-1 h-4 w-4" />
                        {TIPO_INCOHERENTE.editar}
                      </Button>
                    </div>
                  </div>
                )}

                {enEdicion ? (
                  <EditorDePregunta question={q} onChange={(cambios) => actualizar(index, cambios)} />
                ) : (
                  <VistaDePregunta question={q} />
                )}

                <ValorarPregunta
                  valoracion={valoraciones.get(index) ?? null}
                  deshabilitado={sucio}
                  titleDeshabilitado={VALORACIONES.guardaPrimero}
                  alValorar={(valor, motivo) => valorar(index, valor, motivo)}
                  alSacar={() => sacarValoracion(index)}
                />
              </Card>
            </li>
          )
        })}
      </ol>

      <DialogoDeLimite bloqueo={bloqueoPlan} onCerrar={() => setBloqueoPlan(null)} />

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
            Guardar como copia deja el original intacto con los intentos ya rendidos, y hace que los
            grupos pasen a usar la versión corregida de acá en adelante. Las notas ya puestas no se
            mueven.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConflicto(null)}>
              Cancelar
            </Button>
            <Button disabled={guardando} onClick={() => guardar('copy')}>
              {guardando ? <Cargando className="mr-1 h-4 w-4" /> : <Save className="mr-1 h-4 w-4" />}
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
      {question.grafico && <GraficoFuncion grafico={question.grafico} alto={180} />}

      {question.type === 'multiple_choice' && (
        <ul className="space-y-1">
          {question.options.map((opcion, i) => (
            <li
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md px-2 py-1',
                i === question.correctAnswer && 'bg-logrado/10 font-semibold',
              )}
            >
              <span className="shrink-0 text-xs text-muted-foreground">
                {String.fromCharCode(65 + i)}.
              </span>
              <LaTeXRenderer content={opcion} />
              {i === question.correctAnswer && <Check className="ml-auto h-4 w-4 shrink-0 text-logrado" />}
            </li>
          ))}
        </ul>
      )}

      {question.type === 'multiple_response' && (
        <ul className="space-y-1">
          {question.options.map((opcion, i) => (
            <li
              key={i}
              className={cn('flex items-start gap-2 rounded-md px-2 py-1', question.correctAnswers.includes(i) && 'bg-logrado/10 font-semibold')}
            >
              <span className="shrink-0 text-xs text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
              <LaTeXRenderer content={opcion} />
              {question.correctAnswers.includes(i) && <Check className="ml-auto h-4 w-4 shrink-0 text-logrado" />}
            </li>
          ))}
        </ul>
      )}

      {question.type === 'matching' && (
        <ul className="space-y-1">
          {question.pairs.map((par, i) => (
            <li key={i} className="flex flex-wrap items-start gap-2 rounded-md bg-logrado/10 px-2 py-1">
              <LaTeXRenderer content={par.left} />
              <span aria-hidden="true">→</span>
              <strong>{par.right}</strong>
            </li>
          ))}
          {(question.distractors ?? []).length > 0 && (
            <li className="px-2 text-xs text-muted-foreground">
              {TIPOS_MOODLE_TEXTOS.emparejamiento.distractores}: {(question.distractors ?? []).join(' · ')}
            </li>
          )}
        </ul>
      )}

      {question.type === 'ordering' && (
        <ol className="list-decimal space-y-1 pl-6">
          {question.items.map((item, i) => (
            <li key={i}>
              <LaTeXRenderer content={item} />
            </li>
          ))}
        </ol>
      )}

      {question.type === 'calculated' && (
        <div className="space-y-1 text-sm">
          <p>
            {TIPOS_MOODLE_TEXTOS.calculada.correcta}: <strong>{correctaEnTexto(question)}</strong> ({TIPOS_MOODLE_TEXTOS.calculada.tolerancia(question.tolerance)})
          </p>
          <p className="px-2 text-xs text-muted-foreground">
            {TIPOS_MOODLE_TEXTOS.calculada.plantilla}: {question.plantilla} · {TIPOS_MOODLE_TEXTOS.calculada.formula}: <code>{question.formula}</code> ·{' '}
            {question.variables.map((v) => `{${v.name}} ${v.min}–${v.max}`).join(' · ')}
          </p>
        </div>
      )}

      {question.type === 'missing_word' && (
        <div className="space-y-1">
          <p className="rounded-md bg-logrado/10 px-2 py-1">{correctaEnTexto(question)}</p>
          <p className="px-2 text-xs text-muted-foreground">{question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' · ')}</p>
        </div>
      )}

      {(question.type === 'gapselect' || question.type === 'ddwtos') && (
        <div className="space-y-1">
          <p className="rounded-md bg-logrado/10 px-2 py-1">{correctaEnTexto(question)}</p>
          {question.choices.length > cantidadDeHuecos(question.text) && (
            <p className="px-2 text-xs text-muted-foreground">
              {TIPOS_MOODLE_TEXTOS.emparejamiento.distractores}: {question.choices.slice(cantidadDeHuecos(question.text)).join(' · ')}
            </p>
          )}
        </div>
      )}

      {question.type === 'true_false' && (
        <p className="text-sm">
          Correcta: <strong>{question.correctAnswer ? 'Verdadero' : 'Falso'}</strong>
        </p>
      )}

      {question.type === 'numeric' && (
        <p className="text-sm">
          Correcta: <strong><LaTeXRenderer content={respuestaCorrectaNumerica(question)} /></strong>
          {question.exigeIrreducible ? ' (sólo la fracción irreducible)' : ''}
        </p>
      )}

      {question.type === 'essay' && (
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{ENSAYO.rubrica.titulo}</p>
          <ul className="list-disc space-y-0.5 pl-6">
            {question.rubrica.map((c, i) => (
              <li key={i}>{c.criterio}</li>
            ))}
          </ul>
        </div>
      )}

      {question.type === 'short_answer' && (
        <p className="text-sm">
          Acepta: <strong>{comaDecimal(question.acceptedAnswers.join(' · '))}</strong>
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

      {question.type === 'multiple_response' && (
        <Campo label={TIPOS_MOODLE_TEXTOS.variasCorrectas.editor}>
          <div className="space-y-2">
            {question.options.map((opcion, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 accent-accion"
                  checked={question.correctAnswers.includes(i)}
                  onChange={(e) => {
                    const correctAnswers = e.target.checked
                      ? [...question.correctAnswers, i].sort((a, b) => a - b)
                      : question.correctAnswers.filter((x) => x !== i)
                    onChange({ correctAnswers } as Partial<Question>)
                  }}
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

      {question.type === 'matching' && (
        <>
          <Campo label={TIPOS_MOODLE_TEXTOS.emparejamiento.editor}>
            <div className="space-y-2">
              {question.pairs.map((par, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    value={par.left}
                    aria-label={TIPOS_MOODLE_TEXTOS.emparejamiento.izquierda(i + 1)}
                    onChange={(e) => {
                      const pairs = question.pairs.map((p, j) => (j === i ? { ...p, left: e.target.value } : p))
                      onChange({ pairs } as Partial<Question>)
                    }}
                  />
                  <span aria-hidden="true">→</span>
                  <Input
                    value={par.right}
                    aria-label={TIPOS_MOODLE_TEXTOS.emparejamiento.derecha(i + 1)}
                    onChange={(e) => {
                      const pairs = question.pairs.map((p, j) => (j === i ? { ...p, right: e.target.value } : p))
                      onChange({ pairs } as Partial<Question>)
                    }}
                  />
                </div>
              ))}
            </div>
          </Campo>
          <Campo label={TIPOS_MOODLE_TEXTOS.emparejamiento.distractoresEditor}>
            <Textarea
              rows={2}
              value={(question.distractors ?? []).join('\n')}
              onChange={(e) => onChange({ distractors: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } as Partial<Question>)}
            />
          </Campo>
        </>
      )}

      {question.type === 'ordering' && (
        <Campo label={TIPOS_MOODLE_TEXTOS.ordenamiento.editor}>
          <Textarea
            rows={5}
            value={question.items.join('\n')}
            onChange={(e) => onChange({ items: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } as Partial<Question>)}
          />
        </Campo>
      )}

      {question.type === 'calculated' && <EditorDeCalculada question={question} onChange={onChange} />}

      {question.type === 'essay' && <EditorDeRubrica question={question} onChange={onChange} />}

      {question.type === 'missing_word' && (
        <>
          <Campo label={TIPOS_MOODLE_TEXTOS.palabraFaltante.editorTexto}>
            <Textarea rows={2} value={question.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Question>)} />
          </Campo>
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
        </>
      )}

      {(question.type === 'gapselect' || question.type === 'ddwtos') && (
        <>
          <Campo label={TIPOS_MOODLE_TEXTOS.huecos.editorTexto}>
            <Textarea rows={4} value={question.text} onChange={(e) => onChange({ text: e.target.value } as Partial<Question>)} />
          </Campo>
          <Campo label={TIPOS_MOODLE_TEXTOS.huecos.editorPalabras}>
            <Textarea
              rows={5}
              value={question.choices.join('\n')}
              onChange={(e) => onChange({ choices: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) } as Partial<Question>)}
            />
          </Campo>
        </>
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
          <Campo label="Respuesta correcta (número o fracción: 3/4)">
            <CampoNumerico
              valor={question.correctAnswer}
              fraccion={question.fraccion}
              onValor={(valor, _vacio, fraccion) => {
                // K2: escribir una fracción la guarda como fracción; un decimal la saca.
                if (valor !== null) onChange({ correctAnswer: valor, fraccion: fraccion ?? undefined } as Partial<Question>)
              }}
            />
          </Campo>
          <Campo label="Tolerancia (opcional)">
            <CampoNumerico
              valor={question.tolerance ?? null}
              onValor={(valor, vacio) => {
                if (vacio) return onChange({ tolerance: undefined } as Partial<Question>)
                if (valor !== null) onChange({ tolerance: valor } as Partial<Question>)
              }}
            />
          </Campo>
          {question.fraccion && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={question.exigeIrreducible === true}
                onChange={(e) => onChange({ exigeIrreducible: e.target.checked } as Partial<Question>)}
                className="size-5 shrink-0 accent-accion"
              />
              Sólo vale la fracción irreducible
            </label>
          )}
          {/* L3: la respuesta es el producto de primos; la correcta sigue siendo el número. */}
          {!question.fraccion && Number.isInteger(question.correctAnswer) && question.correctAnswer > 1 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={question.forma === 'factorizacion'}
                onChange={(e) => onChange({ forma: e.target.checked ? 'factorizacion' : undefined } as Partial<Question>)}
                className="size-5 shrink-0 accent-accion"
              />
              {TECLADO_MATEMATICO.editor.factorizacion}
            </label>
          )}
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

/**
 * Ronda T · F7 — Editar una calculada: la plantilla, la fórmula y el rango de
 * cada comodín. Cada cambio que cierra (lib/calculada.ts) vuelve a sortear los
 * valores y recalcula la correcta; uno que no cierra se muestra, sin tocar la
 * pregunta guardada hasta que se arregle.
 */
/**
 * W5: la rúbrica del ensayo, un criterio por renglón (de 3 a 5). La IA puede
 * proponerlos a partir de la consigna; el docente los edita igual.
 */
function EditorDeRubrica({
  question,
  onChange,
}: {
  question: Extract<Question, { type: 'essay' }>
  onChange: (cambios: Partial<Question>) => void
}) {
  const [texto, setTexto] = useState(question.rubrica.map((c) => c.criterio).join('\n'))
  const [estado, setEstado] = useState<'quieto' | 'proponiendo' | 'error'>('quieto')
  const criterios = limpiarRubrica(texto.split('\n'))
  const fueraDeRango = criterios.length < MINIMO_CRITERIOS || criterios.length > MAXIMO_CRITERIOS

  function aplicar(nuevo: string) {
    setTexto(nuevo)
    const rubrica = limpiarRubrica(nuevo.split('\n'))
    if (rubricaValida(rubrica)) onChange({ rubrica } as Partial<Question>)
  }

  async function proponer() {
    setEstado('proponiendo')
    const r = await pedirJson<{ rubrica: { criterio: string }[] }>('/api/teacher/ensayos/rubrica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consigna: question.question, guia: question.explanation, materia: question.topicName }),
    })
    if ('error' in r) return setEstado('error')
    setEstado('quieto')
    aplicar(r.data.rubrica.map((c) => c.criterio).join('\n'))
  }

  return (
    <div className="space-y-2">
      <Campo label={ENSAYO.rubrica.titulo}>
        <Textarea rows={5} value={texto} onChange={(e) => aplicar(e.target.value)} aria-describedby={`rubrica-ayuda-${question.id}`} />
      </Campo>
      <p id={`rubrica-ayuda-${question.id}`} className="text-xs text-muted-foreground">
        {fueraDeRango ? ENSAYO.rubrica.faltan : ENSAYO.rubrica.ayuda}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={proponer} disabled={estado === 'proponiendo'}>
        {estado === 'proponiendo' ? ENSAYO.rubrica.proponiendo : ENSAYO.rubrica.proponer}
      </Button>
      {estado === 'error' && <p role="alert" className="text-xs">{ENSAYO.rubrica.noSePudo}</p>}
    </div>
  )
}

function EditorDeCalculada({
  question,
  onChange,
}: {
  question: Extract<Question, { type: 'calculated' }>
  onChange: (cambios: Partial<Question>) => void
}) {
  const [borrador, setBorrador] = useState({ plantilla: question.plantilla, formula: question.formula, variables: question.variables })
  const [noCierra, setNoCierra] = useState(false)

  function aplicar(nuevo: typeof borrador) {
    setBorrador(nuevo)
    const candidata = { ...question, ...nuevo, question: nuevo.plantilla }
    const instanciada = calculadaValida(candidata) ? instanciarCalculada(candidata) : null
    setNoCierra(!instanciada)
    if (instanciada) {
      onChange({
        plantilla: instanciada.plantilla,
        formula: instanciada.formula,
        variables: instanciada.variables,
        valores: instanciada.valores,
        correctAnswer: instanciada.correctAnswer,
        question: instanciada.question,
      } as Partial<Question>)
    }
  }

  return (
    <div className="space-y-3">
      <Campo label={TIPOS_MOODLE_TEXTOS.calculada.editorPlantilla}>
        <Textarea rows={3} value={borrador.plantilla} onChange={(e) => aplicar({ ...borrador, plantilla: e.target.value })} />
      </Campo>
      <Campo label={TIPOS_MOODLE_TEXTOS.calculada.editorFormula}>
        <Input value={borrador.formula} onChange={(e) => aplicar({ ...borrador, formula: e.target.value })} className="font-mono" />
      </Campo>
      {borrador.variables.map((v, i) => (
        <Campo key={v.name} label={TIPOS_MOODLE_TEXTOS.calculada.editorRango(v.name)}>
          <div className="grid grid-cols-2 gap-2">
            {(['min', 'max'] as const).map((lado) => (
              <CampoNumerico
                key={lado}
                valor={v[lado]}
                onValor={(valor) => {
                  if (valor === null) return
                  aplicar({ ...borrador, variables: borrador.variables.map((x, j) => (j === i ? { ...x, [lado]: valor } : x)) })
                }}
              />
            ))}
          </div>
        </Campo>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => aplicar({ ...borrador })}>
        {TIPOS_MOODLE_TEXTOS.calculada.otrosValores}
      </Button>
      {noCierra && (
        <p role="alert" className="text-sm text-flojo">
          {TIPOS_MOODLE_TEXTOS.calculada.noCierra}
        </p>
      )}
    </div>
  )
}

/**
 * Un número que edita el docente. `text` y no `number`: en es-AR el input
 * numérico del navegador descarta la coma decimal (el mismo bug que se arregló
 * en el campo del alumno). El texto crudo es del campo: si se reescribiera
 * desde el número, al tipear `0,` se volvería `0` y no se podría seguir.
 * Lee igual que el campo del alumno (coma, punto, fracción, miles con punto).
 */
function CampoNumerico({
  valor,
  fraccion,
  onValor,
}: {
  valor: number | null
  fraccion?: Fraccion
  onValor: (valor: number | null, vacio: boolean, fraccion: Fraccion | null) => void
}) {
  const [texto, setTexto] = useState(() =>
    fraccion ? `${fraccion.numerador}/${fraccion.denominador}` : valor === null ? '' : formatearNumero(valor),
  )
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={texto}
      aria-invalid={texto.trim() !== '' && leerRespuesta(texto) === null}
      onChange={(e) => {
        setTexto(e.target.value)
        const lectura = leerRespuesta(e.target.value)
        onValor(lectura?.valor ?? null, e.target.value.trim() === '', lectura?.fraccion ?? null)
      }}
    />
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
