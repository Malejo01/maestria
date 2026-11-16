'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Bienvenida } from '@/components/entrada/bienvenida'

/**
 * Tapa la app mientras una cuenta no terminó la bienvenida (rol, y para el
 * alumno qué cursa). Envuelve los grupos (app) y (focus); la raíz del sitio
 * hace lo mismo por su cuenta desde el servidor.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [forceOnboarded, setForceOnboarded] = useState(false)
  const resetQuiz = useAppStore((state) => state.resetQuiz)

  useEffect(() => {
    resetQuiz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') return null

  if (status === 'authenticated' && !session?.user?.isOnboarded && !forceOnboarded) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-superficie-base px-4 py-6">
        <Bienvenida onComplete={() => setForceOnboarded(true)} />
      </main>
    )
  }

  return <>{children}</>
}
