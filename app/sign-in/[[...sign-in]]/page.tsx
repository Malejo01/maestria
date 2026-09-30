'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { GraduationCap } from 'lucide-react'
import { MathBackground } from '@/components/math-background'
import { LegalNotice } from '@/components/legal-notice'
import { safeCallbackUrl } from '@/lib/safe-callback-url'

export default function SignInPage() {
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background overflow-hidden">
      <MathBackground />

      <div className="relative z-10 w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-xl">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">MaestrIA</h1>
            <p className="text-sm text-muted-foreground mt-1">Plataforma de Infraestructura Curricular</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-xl p-8 flex flex-col gap-6">
          {/* Suspense: useSearchParams obliga a un límite para que la página
              se pueda prerenderizar; el fallback es el mismo formulario
              volviendo a la raíz. */}
          <Suspense fallback={<SignInForm callbackUrl="/" />}>
            <SignInFormFromQuery />
          </Suspense>

          <LegalNotice action="ingresar" />
        </div>
      </div>
    </div>
  )
}

/**
 * El proxy manda acá con `?callbackUrl=<ruta que se pidió>`. Antes el botón
 * mandaba siempre a `/` y lo ignoraba: el que tocaba "Comenzar ahora" en la
 * home se logueaba y aterrizaba otra vez en la home, sin rastro de adónde iba.
 */
function SignInFormFromQuery() {
  const searchParams = useSearchParams()
  return <SignInForm callbackUrl={safeCallbackUrl(searchParams.get('callbackUrl'))} />
}

function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  return (
    <>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">Bienvenido/a</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {callbackUrl === '/practicar'
            ? 'Para armar tu cuestionario, ingresá con tu cuenta de Google. Es gratis.'
            : 'Ingresá con tu cuenta de Google para continuar'}
        </p>
      </div>

      <button
        onClick={() => signIn('google', { callbackUrl })}
        className="flex items-center justify-center gap-3 w-full px-4 py-3 rounded-xl border border-border bg-background hover:bg-secondary/60 transition-all duration-200 font-medium text-foreground shadow-sm active:scale-95"
      >
        {/* Google icon */}
        <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Ingresar con Google
      </button>
    </>
  )
}
