'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, PlayCircle, Share2, Loader2 } from 'lucide-react'
import type { QuizActionMode } from '@/lib/types'

interface QuizActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectAction: (action: QuizActionMode) => void
  isLoading?: boolean
}

export function QuizActionDialog({
  open,
  onOpenChange,
  onSelectAction,
  isLoading = false,
}: QuizActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-2 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="text-xl font-black text-foreground">¿Qué querés hacer?</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Elegí si querés realizar ahora el cuestionario, guardarlo o dejarlo pendiente para compartir.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          <Button
            type="button"
            disabled={isLoading}
            onClick={() => onSelectAction('realizar')}
            className="w-full justify-start h-12 rounded-xl"
          >
            {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Realizar
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onSelectAction('guardar')}
            className="w-full justify-start h-12 rounded-xl"
          >
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onSelectAction('compartir')}
            className="w-full justify-start h-12 rounded-xl"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
