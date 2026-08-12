'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { CheckCircle2, Loader2, MessageSquareWarning, X } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { QuestionType } from '@/lib/types'

/**
 * Lo que se adjunta al reporte, congelado en el momento de abrir el panel.
 * Que sea el estado que define "abierto" no es un atajo: hace imposible tener
 * el formulario visible sin haber capturado el contexto.
 */
interface ReportContext {
  pathname: string
  questionId?: string
  questionType?: QuestionType
}

/**
 * Botón flotante para reportar un problema, montado una sola vez en
 * `components/app-guards.tsx` — que envuelve tanto el grupo `(app)` como
 * `(focus)`, así que con un montaje queda disponible para docente, alumno e
 * invitado, en el panel y también durante el quiz.
 *
 * Vive en z-[45] a propósito: por encima del QuizOverlay (z-40, si no quedaría
 * tapado justo cuando más se usa) y por debajo de los portales de Radix (z-50,
 * si no taparía los diálogos que sí son modales). El contrato de capas completo
 * está documentado en `components/quiz-overlay.tsx`.
 *
 * No hay notificación de ningún tipo: los reportes se leen a mano desde la
 * tabla `feedback_reports` (migración 019).
 */
export function FeedbackButton() {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const panelId = useId()

  const activeView = useAppStore((state) => state.activeView)
  const currentQuiz = useAppStore((state) => state.currentQuiz)

  // El contexto se congela al abrir el panel, no al enviar. Esa es la
  // diferencia entre reportar "la pantalla donde vi el problema" y "la pantalla
  // donde terminé de escribir": si el quiz avanza de pregunta mientras el
  // formulario está abierto, o si la persona navega a otra página, el reporte
  // tiene que seguir apuntando a lo que la hizo apretar el botón.
  const [context, setContext] = useState<ReportContext | null>(null)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const open = context !== null

  const close = useCallback(() => {
    setContext(null)
    triggerRef.current?.focus()
  }, [])

  const openWithContext = () => {
    // El caso de uso principal del botón es "esta pregunta está mal", así que
    // el reporte se lleva la pregunta que la persona está mirando. Va el id y
    // el tipo, NO el enunciado: el texto se reconstruye desde el quiz, y
    // guardarlo duplicaría contenido generado por IA en una tabla que no es
    // para eso.
    const question = activeView === 'quiz' ? currentQuiz.questions[currentQuiz.currentIndex] : undefined

    // Reabrir después de un envío tiene que dar un formulario limpio, no la
    // pantalla de "gracias" que quedó de la vez anterior.
    setStatus('idle')
    setErrorMessage(null)
    setContext({ pathname, questionId: question?.id, questionType: question?.type })
  }

  // Escape cierra el panel. Se registra sólo mientras está abierto para no
  // competir con el Escape de los diálogos de Radix, que son modales.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (status === 'sending' || !context) return

    const text = description.trim()
    if (!text) {
      setStatus('error')
      setErrorMessage('Contanos qué pasó antes de enviar.')
      return
    }

    setStatus('sending')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: text,
          pathname: context.pathname,
          questionId: context.questionId,
          questionType: context.questionType,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'No pudimos guardar tu reporte.')
      }

      setStatus('sent')
      setDescription('')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'No pudimos guardar tu reporte.')
    }
  }

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 12, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 8, scale: 0.98 },
      }

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[45] flex flex-col items-end gap-3 print:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            {...panelMotion}
            transition={{ duration: reduceMotion ? 0.12 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            id={panelId}
            role="dialog"
            aria-label="Reportar un problema"
            className="w-[calc(100vw-2rem)] sm:w-[22rem] origin-bottom-right rounded-3xl border border-border/60 bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div>
                <h2 className="text-sm font-bold text-foreground">Reportar un problema</h2>
                <p className="text-xs text-muted-foreground">Lo leemos a mano. No hace falta que des detalles técnicos.</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar el formulario de reporte"
                className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {status === 'sent' ? (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">¡Gracias! Quedó registrado.</p>
                  <p className="text-xs text-muted-foreground">No vas a recibir una respuesta automática, pero lo vamos a leer.</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="mt-1 h-10 w-full rounded-xl bg-secondary text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3 px-5 pb-5 pt-3">
                <Textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={4000}
                  rows={4}
                  placeholder="¿Qué pasó? Por ejemplo: la pregunta tiene dos respuestas correctas."
                  aria-label="Descripción del problema"
                  className="min-h-24 resize-none rounded-2xl bg-background text-sm"
                />

                {/* Transparencia: lo que se adjunta se muestra antes de enviar. */}
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Se adjunta automáticamente la página en la que estás
                  {context?.questionId ? ' y el identificador de la pregunta actual' : ''}, más tu usuario y tu rol.
                </p>

                {errorMessage && (
                  <p role="alert" className="text-xs font-medium text-destructive">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending' || !description.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                >
                  {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {status === 'sending' ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        ref={triggerRef}
        type="button"
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        onClick={() => (open ? close() : openWithContext())}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Cerrar el formulario de reporte' : 'Reportar un problema'}
        className={cn(
          // px-3.5 no es arbitrario: 14 + 20 (ícono) + 14 = 48 = h-12, así que
          // colapsado el botón es un círculo exacto y no un óvalo.
          'group flex h-12 items-center rounded-full border border-border/60 bg-card px-3.5 text-sm font-semibold text-foreground shadow-lg transition-colors hover:bg-secondary',
          open && 'bg-secondary'
        )}
      >
        <MessageSquareWarning className="h-5 w-5 shrink-0 text-primary" />
        {/* El texto vive colapsado y se despliega en hover o foco de teclado.
            Es un botón global que flota sobre todas las vistas: en reposo tiene
            que ocupar lo mínimo y no aparecer en cada captura de pantalla del
            producto. El margen se anima junto con el ancho porque un `gap` del
            flex se aplicaría igual con el span en max-w-0 y dejaría al círculo
            8px descentrado.

            No hace falta que lo lea un lector de pantalla: el nombre accesible
            sale del aria-label del botón, que ya dice lo mismo y no depende de
            si está desplegado. */}
        <span
          aria-hidden="true"
          className={cn(
            'ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0',
            'transition-[max-width,opacity,margin] duration-200 ease-out motion-reduce:transition-none',
            'group-hover:ml-2 group-hover:max-w-[10rem] group-hover:opacity-100',
            'group-focus-visible:ml-2 group-focus-visible:max-w-[10rem] group-focus-visible:opacity-100',
            open && 'ml-2 max-w-[10rem] opacity-100'
          )}
        >
          Reportar problema
        </span>
      </motion.button>
    </div>
  )
}
