'use client'

import { useEffect, useState } from 'react'
import { MathBackground } from './math-background'
import { cn } from '@/lib/utils'
import { Brain, Sparkles, BookOpen, Zap } from 'lucide-react'

const loadingMessages = [
  { text: 'Analizando el curriculum...', icon: BookOpen },
  { text: 'Generando preguntas con IA...', icon: Brain },
  { text: 'Calibrando dificultad...', icon: Zap },
  { text: 'Preparando opciones...', icon: Sparkles },
  { text: 'Casi listo...', icon: Brain },
]

export function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  // Rotate loading messages every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Animate progress bar (slow, asymptotic approach to ~90%)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + (90 - prev) * 0.05
      })
    }, 300)
    return () => clearInterval(interval)
  }, [])

  const CurrentIcon = loadingMessages[messageIndex].icon

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center">
      <MathBackground />
      
      <div className="relative z-10 text-center px-8 max-w-sm w-full">
        {/* Animated Icon */}
        <div className={cn(
          'w-28 h-28 mx-auto mb-8 rounded-3xl flex items-center justify-center',
          ' bg-[var(--algebra)]',
          '',
          ''
        )}>
          <Brain className="w-14 h-14 text-texto-sobre-accion" />
        </div>

        {/* Loading Message */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl font-black text-foreground">
            Preparando tu cuestionario
          </h2>
          <div className="flex items-center justify-center gap-2 text-muted-foreground min-h-[28px]">
            <CurrentIcon className="w-5 h-5 text-accion" />
            <span className="font-medium fade-in-50 duration-500" key={messageIndex}>
              {loadingMessages[messageIndex].text}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden mb-4">
          <div 
            className="h-full bg-[var(--algebra)] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-xs text-muted-foreground">
          Esto puede tardar unos segundos...
        </p>

        {/* Animated Dots */}
        <div className="flex items-center justify-center gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'w-3 h-3 rounded-full',
                ' bg-[var(--algebra)]',
              )}
              style={{
                animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
