'use client'

import { FeedbackButton } from './feedback-button'
import { OnboardingGate } from './onboarding-gate'
import { QuizOverlay } from './quiz-overlay'
import { Toaster } from '@/components/ui/toaster'
import { usePendientesDeGuardado } from '@/hooks/use-pendientes-de-guardado'
import { useRachaDeLaBase } from '@/hooks/use-racha-de-la-base'

/**
 * M1: cualquier pantalla reintenta, al cargar, los resultados que quedaron sin
 * llegar al servidor (un alumno que terminó sin conexión y cerró la pestaña).
 */
function ReintentoDePendientes() {
  usePendientesDeGuardado()
  // O4: la racha se lee de la base al entrar (y la del navegador pasa una vez).
  useRachaDeLaBase()
  return null
}

export function AppGuards({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGate>
      {children}
      <QuizOverlay />
      <ReintentoDePendientes />
      {/*
        Acá y no en el Navbar: este componente envuelve los dos grupos de rutas
        ((app) y (focus)), así que un solo montaje cubre docente, alumno e
        invitado, y sobre todo sigue estando durante el quiz — que es cuando
        aparece la mayoría de los problemas que vale la pena reportar. El
        Navbar, en cambio, no existe en (focus) y queda tapado por QuizOverlay.
      */}
      <FeedbackButton />
      <Toaster />
    </OnboardingGate>
  )
}
