'use client'

import { BookOpen, Calculator, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuestionTypeSelector } from '@/components/question-type-selector'
import { cn } from '@/lib/utils'
import type { QuestionType } from '@/lib/types'

interface QuizModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMode: (mode: 'teorico' | 'practico' | 'mixto') => void
  onBack?: () => void
  isLoading?: boolean
  title?: string
  description?: string
  showQuestionCountSelector?: boolean
  questionCountValue?: string
  onQuestionCountValueChange?: (value: string) => void
  onDecreaseQuestionCount?: () => void
  onIncreaseQuestionCount?: () => void
  isQuestionCountValid?: boolean
  minQuestionCount?: number
  maxQuestionCount?: number
  /**
   * Off by default: the quick "revancha"/weak-points retry dialogs reuse this
   * component but keep asking for exactly what they always asked (mode only).
   * Only the full quiz-creation flows (subject-content) turn this on.
   */
  showQuestionTypeSelector?: boolean
  questionTypes?: QuestionType[]
  onQuestionTypesChange?: (next: QuestionType[]) => void
}

const modeCards = [
  {
    mode: 'teorico' as const,
    title: 'Examen Teorico',
    description: 'Conceptos, definiciones, propiedades y fundamentos.',
    icon: BookOpen,
    accent: 'from-sky-500 to-cyan-400',
    border: 'border-sky-200 hover:border-sky-400',
    background: 'from-sky-50 to-cyan-50',
  },
  {
    mode: 'practico' as const,
    title: 'Examen Practico',
    description: 'Resolucion de ejercicios, cuentas y aplicacion directa.',
    icon: Calculator,
    accent: 'from-orange-500 to-amber-400',
    border: 'border-orange-200 hover:border-orange-400',
    background: 'from-orange-50 to-amber-50',
  },
  {
    mode: 'mixto' as const,
    title: 'Examen Mixto',
    description: 'Combina ejercicios teoricos y practicos.',
    icon: BookOpen,
    accent: 'from-violet-500 to-fuchsia-400',
    border: 'border-violet-200 hover:border-violet-400',
    background: 'from-violet-50 to-fuchsia-50',
  },
]

export function QuizModeDialog({
  open,
  onOpenChange,
  onSelectMode,
  onBack,
  isLoading = false,
  title = 'Elegir tipo de cuestionario',
  description = 'Seleccioná si querés practicar con un examen teórico o práctico.',
  showQuestionCountSelector = true,
  questionCountValue = '10',
  onQuestionCountValueChange,
  onDecreaseQuestionCount,
  onIncreaseQuestionCount,
  isQuestionCountValid = true,
  minQuestionCount = 5,
  maxQuestionCount = 50,
  showQuestionTypeSelector = false,
  questionTypes = ['multiple_choice'],
  onQuestionTypesChange,
}: QuizModeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-2 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 text-left space-y-2">
          {onBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-foreground gap-1 -ml-2 self-start"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Volver atrás</span>
            </Button>
          )}
          <DialogTitle className="text-xl font-black text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {showQuestionCountSelector && (
          <div className="rounded-2xl border-2 border-border/70 bg-muted/20 p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground">Cantidad de preguntas</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onDecreaseQuestionCount?.()}
                disabled={isLoading}
                aria-label="Disminuir cantidad de preguntas"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="number"
                min={minQuestionCount}
                max={maxQuestionCount}
                step={1}
                value={questionCountValue}
                onChange={(event) => onQuestionCountValueChange?.(event.target.value)}
                disabled={isLoading}
                className={cn(
                  'h-10 w-full rounded-md border bg-background px-3 text-center text-base font-bold outline-none',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  !isQuestionCountValid && 'border-destructive text-destructive focus-visible:ring-destructive'
                )}
                aria-label="Cantidad de preguntas"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onIncreaseQuestionCount?.()}
                disabled={isLoading}
                aria-label="Aumentar cantidad de preguntas"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <p className={cn('text-xs', isQuestionCountValid ? 'text-muted-foreground' : 'text-destructive')}>
              {isQuestionCountValid
                ? `Rango permitido: ${minQuestionCount} a ${maxQuestionCount}.`
                : `Ingresa un numero entero entre ${minQuestionCount} y ${maxQuestionCount}.`}
            </p>
          </div>
          )}

          {showQuestionTypeSelector && (
            <div className="rounded-2xl border-2 border-border/70 bg-muted/20 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Tipos de pregunta</p>
              <QuestionTypeSelector
                value={questionTypes}
                onChange={(next) => onQuestionTypesChange?.(next)}
                disabled={isLoading}
              />
            </div>
          )}

          {modeCards.map(({ mode, title: modeTitle, description: modeDescription, icon: Icon, accent, border, background }) => (
            <Button
              key={mode}
              type="button"
              variant="outline"
              disabled={isLoading || !isQuestionCountValid}
              onClick={() => onSelectMode(mode)}
              className={cn(
                'h-auto w-full justify-start rounded-2xl border-2 px-4 py-4 text-left',
                'bg-gradient-to-br shadow-sm transition-all hover:scale-[1.01] hover:shadow-md',
                border,
                background
              )}
            >
              <div className="flex w-full items-center gap-4">
                <div className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                  accent
                )}>
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-foreground">{modeTitle}</div>
                  <div className="text-sm text-muted-foreground whitespace-normal">{modeDescription}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}