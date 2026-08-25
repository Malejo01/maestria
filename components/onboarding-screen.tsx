'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { GraduationCap, BookOpen, Loader2, ChevronRight, ArrowLeft } from 'lucide-react'
import { CargaFallida } from '@/components/carga-fallida'
import { pedirJson } from '@/lib/pedir-json'
import { MathBackground } from '@/components/math-background'
import { NIVEL_OPTIONS, type Nivel } from '@/lib/nivel-options'
import { useRouter } from 'next/navigation'

interface OnboardingScreenProps {
  onComplete: () => void
}

type Step = 'role' | 'nivel' | 'grado'

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { update: updateSession } = useSession()
  const router = useRouter()
  const [step, setStep] = useState<Step>('role')
  const [saving, setSaving] = useState(false)
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [grades, setGrades] = useState<string[]>([])
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [gradesError, setGradesError] = useState<string | null>(null)

  const finish = async (payload: { role: 'ALUMNO' | 'DOCENTE'; nivel?: string; grado?: string }) => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Error al guardar el perfil')

      // Refresh JWT so session.user.role/nivel/grado/isOnboarded are updated
      await updateSession()
      router.refresh()
      onComplete()
    } catch {
      setSaving(false)
    }
  }

  const selectRole = async (role: 'ALUMNO' | 'DOCENTE') => {
    if (role === 'DOCENTE') {
      await finish({ role: 'DOCENTE' })
      return
    }
    setStep('nivel')
  }

  const selectNivel = async (n: Nivel) => {
    setNivel(n)
    setLoadingGrades(true)
    setGradesError(null)
    // Es lo primero que ve un alumno nuevo: un 500 acá no puede pintarse como
    // "no hay años para tu nivel" — ver deuda-tecnica.md §6a.
    const res = await pedirJson<{ grades?: string[] }>(
      `/api/curriculum/grades?nivel=${encodeURIComponent(n)}`
    )
    if ('error' in res) {
      setGrades([])
      setGradesError(res.error)
    } else {
      setGrades(res.data.grades ?? [])
    }
    setLoadingGrades(false)
    setStep('grado')
  }

  const selectGrado = (grado: string) => {
    if (!nivel) return
    finish({ role: 'ALUMNO', nivel, grado })
  }

  const skip = () => {
    finish({ role: 'ALUMNO' })
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background overflow-hidden">
      <MathBackground />

      <div className="relative z-10 w-full max-w-lg mx-4">
        {step === 'role' && (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-blue-600 shadow-xl mb-4">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">¡Bienvenido/a a MaestrIA!</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Para personalizar tu experiencia, contanos cómo vas a usar la plataforma.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => selectRole('ALUMNO')}
                disabled={saving}
                className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-foreground">Soy Alumno/a</h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Quiero practicar, realizar cuestionarios y ver mi historial de aprendizaje.
                  </p>
                </div>
              </button>

              <button
                onClick={() => selectRole('DOCENTE')}
                disabled={saving}
                className="group relative flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  <GraduationCap className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                  <h2 className="text-lg font-bold text-foreground">Soy Docente</h2>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Quiero generar cuestionarios, exportarlos a Moodle y gestionar mis programas.
                  </p>
                </div>
                {saving && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/70">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                )}
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground mt-6">
              Podés cambiar tu rol en cualquier momento desde el menú superior.
            </p>
          </>
        )}

        {step === 'nivel' && (
          <>
            <button
              onClick={() => setStep('role')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">¿Qué nivel estás cursando?</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Así te llevamos directo a tus materias la próxima vez.
              </p>
            </div>

            <div className="grid gap-4">
              {NIVEL_OPTIONS.map(({ value, label, sub, Icon, color }) => (
                <button
                  key={value}
                  onClick={() => selectNivel(value)}
                  disabled={loadingGrades}
                  className="flex items-center gap-5 p-5 rounded-2xl border border-border bg-card hover:border-primary hover:shadow-md transition-all duration-200 active:scale-95 text-left disabled:opacity-60"
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>

            <button
              onClick={skip}
              disabled={saving}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-6 transition-colors disabled:opacity-60"
            >
              Saltar por ahora
            </button>
          </>
        )}

        {step === 'grado' && (
          <>
            <button
              onClick={() => setStep('nivel')}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-foreground">
                {nivel === 'Primario' ? '¿Qué grado?' : '¿Qué año?'}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">{nivel}</p>
            </div>

            {loadingGrades ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : gradesError ? (
              <CargaFallida
                que="los años de tu nivel"
                detalle={gradesError}
                onReintentar={() => nivel && selectNivel(nivel)}
              />
            ) : grades.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Todavía no hay contenidos cargados para este nivel — podés elegir tu materia y grado más adelante desde &quot;Practicar&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {grades.map((g) => (
                  <button
                    key={g}
                    onClick={() => selectGrado(g)}
                    disabled={saving}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 font-semibold text-sm text-foreground transition-all active:scale-95 disabled:opacity-60"
                  >
                    {nivel === 'Primario' ? g.replace(/Año/gi, 'Grado') : g}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={skip}
              disabled={saving}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-6 transition-colors disabled:opacity-60"
            >
              Saltar por ahora
            </button>
          </>
        )}
      </div>
    </div>
  )
}
