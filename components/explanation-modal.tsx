'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LaTeXRenderer } from './latex-renderer'
import { Sparkles, XCircle, CheckCircle2, Zap, Loader2, Award } from 'lucide-react'
import type { MultipleChoiceQuestion } from '@/lib/types'
import { useToast } from '@/hooks/use-toast'
import { aiCutoffMessage } from '@/lib/ai-cutoff-message'

interface ExplanationModalProps {
  open: boolean
  onClose: () => void
  question: string
  correctAnswer: string
  userAnswer: string
  explanation: string
  topic?: string
  topicName?: string
  subject?: string
  nivel?: string
  grado?: string
  initialMode?: 'explain' | 'revancha'
  onRevanchaSuccess?: () => void
  /** Revancha only makes sense for multiple_choice questions today — pass false to hide it. */
  allowRevancha?: boolean
}

/** Cuántos caracteres se muestran de entrada, antes del primer tick del intervalo. */
const TYPEWRITER_START = 60

const LOADING_MESSAGES = [
  "Analizando tu respuesta e identificando el concepto...",
  "Detectando el posible malentendido o inconveniente...",
  "Formulando el camino a la solución correcta...",
  "Afinando los detalles pedagógicos según tu nivel..."
]

export function ExplanationModal({
  open,
  onClose,
  question,
  correctAnswer,
  userAnswer,
  explanation,
  topic,
  topicName,
  subject,
  nivel,
  grado,
  initialMode = 'explain',
  onRevanchaSuccess,
  allowRevancha = true,
}: ExplanationModalProps) {
  const [revanchaState, setRevanchaState] = useState<'idle' | 'loading' | 'active' | 'success' | 'failed'>(
    initialMode === 'revancha' && allowRevancha ? 'loading' : 'idle'
  )
  const [revanchaQuestion, setRevanchaQuestion] = useState<MultipleChoiceQuestion | null>(null)
  const { toast } = useToast()
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null)
  /**
   * Progreso del efecto máquina-de-escribir. Guarda `source` junto al largo
   * porque el texto de la explicación cambia de una pregunta a otra: sin eso
   * hacía falta un `setDisplayedText` sincrónico dentro del efecto para
   * reiniciar la animación, que es estado derivado escrito a mano. Comparando
   * `source` con la prop actual, un texto nuevo arranca solo desde cero.
   */
  const [reveal, setReveal] = useState<{ source: string; length: number }>({ source: '', length: 0 })
  const [loadingMsgIndex, setLoadingMsgIndex] = useState<number>(0)

  const isLoadingExplanation = !explanation || explanation.includes('Cargando')

  // Cycling loading messages
  useEffect(() => {
    if (!isLoadingExplanation) return
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2200)
    return () => clearInterval(interval)
  }, [isLoadingExplanation])

  // Progressive typewriter effect for AI explanation. Sólo avanza el contador;
  // qué se ve con ese contador se calcula abajo, en `displayedText`.
  useEffect(() => {
    // Un texto corto no se anima: aparece entero, y eso ya lo resuelve el
    // cálculo de `displayedText` sin necesidad de tocar el estado.
    if (!explanation || isLoadingExplanation || explanation.length < 100) return

    const interval = setInterval(() => {
      setReveal((prev) => {
        const from = prev.source === explanation ? prev.length : TYPEWRITER_START
        const next = from + Math.floor(Math.random() * 30) + 20

        if (next >= explanation.length) clearInterval(interval)
        return { source: explanation, length: Math.min(next, explanation.length) }
      })
    }, 25)

    return () => clearInterval(interval)
  }, [explanation, isLoadingExplanation])

  const displayedText = useMemo(() => {
    if (!explanation || isLoadingExplanation) return ''
    if (explanation.length < 100) return explanation

    const revealed = reveal.source === explanation ? reveal.length : TYPEWRITER_START
    return explanation.substring(0, revealed)
  }, [explanation, isLoadingExplanation, reveal])

  /**
   * Sólo el pedido en sí. Separado de `handleStartRevancha` porque el modal
   * puede abrirse ya en modo revancha, y en ese caso `revanchaState` arranca en
   * `'loading'` por inicializador: volver a ponerlo desde un efecto era un
   * `setState` sincrónico redundante. La función es `async` y su primera
   * instrucción con efecto es el `await fetch`, así que no escribe estado antes
   * de ceder el control.
   */
  const requestRevancha = useCallback(async () => {
    if (!allowRevancha) return
    try {
      const res = await fetch('/api/quiz/revancha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options: [userAnswer, correctAnswer],
          topic,
          topicName,
          subject,
          nivel,
          grado,
          misconceptionText: explanation.substring(0, 300),
        }),
      })

      if (!res.ok) {
        const cutoff = await aiCutoffMessage(res)
        throw new Error(cutoff ?? 'Error al solicitar revancha', { cause: cutoff ? 'cutoff' : undefined })
      }
      const data = await res.json()
      if (!data.question) throw new Error('Pregunta no recibida')

      setRevanchaQuestion(data.question as MultipleChoiceQuestion)
      setSelectedOpt(null)
      setRevanchaState('active')
    } catch (err) {
      console.error('Revancha error:', err)
      setRevanchaState('idle')
      // Volver a la explicación sin decir nada hacía parecer que el botón no
      // andaba. Si fue un corte del guard, su mensaje dice cómo seguir.
      const isCutoff = err instanceof Error && err.cause === 'cutoff'
      toast({
        title: 'No pudimos armar la revancha',
        description: isCutoff ? err.message : 'Probá de nuevo en un rato.',
      })
    }
  }, [allowRevancha, question, userAnswer, correctAnswer, topic, topicName, subject, nivel, grado, explanation, toast])

  /** Lo que dispara el botón: marca el estado y pide. */
  const handleStartRevancha = () => {
    if (!allowRevancha) return
    setRevanchaState('loading')
    requestRevancha()
  }

  // Auto-start revancha if the modal was opened directly in that mode. El
  // estado ya arranca en 'loading' por inicializador, así que acá sólo falta
  // disparar el pedido — una vez, al montar.
  useEffect(() => {
    if (initialMode === 'revancha' && allowRevancha) {
      requestRevancha()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVerifyRevancha = () => {
    if (!revanchaQuestion || selectedOpt === null) return
    const isCorrect = selectedOpt === revanchaQuestion.correctAnswer
    if (isCorrect) {
      setRevanchaState('success')
      if (onRevanchaSuccess) onRevanchaSuccess()
    } else {
      setRevanchaState('failed')
    }
  }

  const handleCloseAll = () => {
    setRevanchaState('idle')
    setRevanchaQuestion(null)
    setSelectedOpt(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseAll}>
      <DialogContent className="max-w-lg mx-4 max-h-[88vh] overflow-y-auto rounded-3xl p-6 shadow-2xl border-2 border-primary/20">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-bold text-foreground">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {revanchaState === 'active' || revanchaState === 'success' ? (
                <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary" />
              )}
            </div>
            {revanchaState === 'active' || revanchaState === 'success'
              ? '⚡ Modo Revancha Inmediata'
              : 'Tutoría Pedagógica IA'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {revanchaState === 'active'
              ? 'Demuestra que superaste esta duda en este nuevo escenario'
              : revanchaState === 'success'
                ? '¡Desafío completado con éxito!'
                : 'Análisis paso a paso del ejercicio según tu nivel'}
          </DialogDescription>
        </DialogHeader>

        {/* ── MODE: IDLE (EXPLICACIÓN PRINCIPAL) ────────────────────────────────── */}
        {revanchaState === 'idle' && (
          <div className="space-y-5 mt-3">
            {/* Question Recap */}
            <div className="p-4 bg-muted/60 rounded-2xl border border-border/60">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Pregunta:</p>
              <div className="text-sm font-semibold text-foreground leading-snug">
                <LaTeXRenderer content={question} />
              </div>
            </div>

            {/* Answers Comparison */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* User Answer */}
              <div className="p-3.5 bg-destructive/10 rounded-2xl border border-destructive/25 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-destructive uppercase tracking-wider">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>🔴 Tu respuesta</span>
                </div>
                <div className="text-sm font-medium text-foreground pt-0.5">
                  <LaTeXRenderer content={userAnswer} />
                </div>
              </div>

              {/* Correct Answer */}
              <div className="p-3.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/25 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>🟢 Respuesta correcta</span>
                </div>
                <div className="text-sm font-medium text-foreground pt-0.5">
                  <LaTeXRenderer content={correctAnswer} />
                </div>
              </div>
            </div>

            {/* Step by Step Explanation */}
            {isLoadingExplanation ? (
              <div className="p-6 rounded-2xl bg-card border-2 border-primary/20 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground transition-all duration-300">
                    {LOADING_MESSAGES[loadingMsgIndex]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preparando tu tutoría personalizada según tu grado...
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-card border-2 border-primary/20 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Sparkles className="w-4 h-4" />
                  <span>Explicación guiada por la IA:</span>
                </div>
                <div className="text-sm text-foreground/90 leading-relaxed space-y-3 whitespace-pre-wrap">
                  <LaTeXRenderer content={displayedText || explanation} />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 space-y-2.5">
              {allowRevancha && (
                <Button
                  onClick={handleStartRevancha}
                  className="w-full h-13 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg hover:from-amber-600 hover:to-orange-600 transition-all active:scale-95 gap-2"
                >
                  <Zap className="w-5 h-5 fill-white" />
                  ¡Tomarme la Revancha! (1 pregunta nueva)
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={handleCloseAll}
                className="w-full h-11 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Entendido, ¡continuar!
              </Button>
            </div>
          </div>
        )}

        {/* ── MODE: LOADING REVANCHA ───────────────────────────────────────────── */}
        {revanchaState === 'loading' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
            <p className="font-bold text-foreground text-base">Creando tu desafío de revancha...</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              La IA está creando una situación nueva para poner a prueba si dominaste este concepto.
            </p>
          </div>
        )}

        {/* ── MODE: ACTIVE REVANCHA ────────────────────────────────────────────── */}
        {revanchaState === 'active' && revanchaQuestion && (
          <div className="space-y-5 mt-3 animate-in fade-in-50">
            <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                Desafío de Revancha · {revanchaQuestion.topicName}
              </p>
              <div className="text-base font-bold text-foreground pt-1">
                <LaTeXRenderer content={revanchaQuestion.question} />
              </div>
            </div>

            <div className="space-y-2.5">
              {revanchaQuestion.options.map((optionText, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedOpt(idx)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all font-medium text-sm flex items-center justify-between ${
                    selectedOpt === idx
                      ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold shadow-md'
                      : 'border-border bg-card hover:border-amber-500/40 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                      selectedOpt === idx ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <LaTeXRenderer content={optionText} />
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={handleVerifyRevancha}
              disabled={selectedOpt === null}
              className="w-full h-13 rounded-2xl bg-amber-500 text-white font-bold text-base shadow-lg hover:bg-amber-600 transition-all disabled:opacity-40 active:scale-95"
            >
              Verificar Revancha
            </Button>
          </div>
        )}

        {/* ── MODE: SUCCESS ────────────────────────────────────────────────────── */}
        {revanchaState === 'success' && (
          <div className="py-8 text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border-2 border-emerald-500/40">
              <Award className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                ¡ESPECTACULAR! 🎉
              </h3>
              <p className="text-sm font-semibold text-foreground max-w-sm mx-auto leading-relaxed">
                ¡Demostraste que superaste tu confusión! Has recuperado tu confianza en este tema.
              </p>
            </div>

            {revanchaQuestion?.explanation && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-foreground text-left leading-relaxed">
                <LaTeXRenderer content={revanchaQuestion.explanation} />
              </div>
            )}

            <Button
              onClick={handleCloseAll}
              className="w-full h-13 rounded-2xl bg-emerald-600 text-white font-bold text-base shadow-lg hover:bg-emerald-700 transition-all active:scale-95"
            >
              ¡Continuar al Quiz!
            </Button>
          </div>
        )}

        {/* ── MODE: FAILED REVANCHA ────────────────────────────────────────────── */}
        {revanchaState === 'failed' && (
          <div className="py-6 text-center space-y-4 animate-in fade-in-50">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <XCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">¡Estuviste muy cerca!</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                No te preocupes. Este tema ha quedado guardado en tu Cofre de Tips para repasar cuando quieras.
              </p>
            </div>
            <Button
              onClick={handleCloseAll}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:bg-primary/90 transition-all"
            >
              Entendido, ¡continuar!
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}


