'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useAppStore } from '@/lib/store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WeakPointsSection } from '@/components/weak-points-section'
import { TipsChest } from '@/components/tips-chest'
import { JoinClassroomField } from '@/components/join-classroom-field'
import { DEFAULT_JURISDICTION } from '@/lib/curriculum-config'
import {
  Sparkles,
  ChevronRight,
  CheckCircle,
  Target,
  History,
  GraduationCap,
} from 'lucide-react'
import type { StudentTip } from '@/lib/types'

export default function InicioPage() {
  const { data: session } = useSession()
  const { userProfile, userProgress } = useAppStore()
  const router = useRouter()
  const isTeacher = userProfile?.role === 'DOCENTE'

  const [studentTips, setStudentTips] = useState<StudentTip[]>([])
  const [performedQuizzesCount, setPerformedQuizzesCount] = useState(0)

  useEffect(() => {
    if (isTeacher) return

    // Los dos alimentan el saludo y el contador de la home: si fallan, el
    // default (sin tips, contador en 0) es aceptable — pero un 500 tiene que
    // caer al catch, no parsearse como si fuera el dato.
    fetch('/api/user/tips')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data.tips)) setStudentTips(data.tips)
      })
      .catch((err) => console.warn('Could not fetch student tips:', err))

    fetch('/api/quiz/history')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data.attempts)) setPerformedQuizzesCount(data.attempts.length)
      })
      .catch((err) => console.warn('Could not fetch quiz history:', err))
  }, [isTeacher])

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="text-left">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground">
          {session?.user?.name ? `¡Hola, ${session.user.name.split(' ')[0]}! 👋` : '¡Bienvenido/a! 👋'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isTeacher
            ? 'Gestioná tus materias, programas y cuestionarios educativos.'
            : 'Practicá cualquier materia con Inteligencia Artificial basada en tu plan de estudios.'}
        </p>
      </div>

      {/* Call to Action Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-primary via-indigo-600 to-violet-700 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-30px] opacity-10 select-none pointer-events-none">
          <Sparkles className="w-40 h-40" strokeWidth={1} />
        </div>

        <div className="relative z-10 max-w-lg space-y-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Evaluaciones Inteligentes
            </span>
            <h2 className="text-xl sm:text-2xl font-black leading-tight">
              {isTeacher ? 'Generar Cuestionario' : 'Comenzar a practicar'}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 mt-1.5 leading-relaxed">
              {isTeacher
                ? `Diseñá cuestionarios a medida basados en la Currícula Oficial de ${DEFAULT_JURISDICTION} o subiendo tu propio programa.`
                : 'Creá un cuestionario personalizado seleccionando tu grado, materia y temas específicos.'}
            </p>
          </div>

          <Button
            onClick={() => router.push('/practicar')}
            className="bg-white hover:bg-white/90 text-indigo-700 hover:text-indigo-800 font-bold px-5 py-2.5 rounded-xl shadow-md transition-all duration-200 active:scale-95 flex items-center gap-2 text-sm"
          >
            {isTeacher ? 'Generar Cuestionario' : 'Comenzar ahora'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isTeacher ? (
        <Card
          onClick={() => router.push('/teacher')}
          className="p-5 border-2 border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer rounded-2xl flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">
                Panel Docente
              </h4>
              <p className="text-xs text-muted-foreground font-medium">
                Gestioná materias, generá cuestionarios y exportá a Moodle
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold text-primary gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
            <span>Ir al panel</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </Card>
      ) : (
        <>
          {/* Puerta de entrada al aula: el código llega por WhatsApp y este es
              el primer lugar donde el alumno lo busca. */}
          <JoinClassroomField />

          {/* Stats Row */}
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
            <Card className="p-4 border-2 border-border bg-card/80 backdrop-blur-sm flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center mb-1.5">
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-2xl font-black text-foreground">{userProgress.streak}</div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Racha días</div>
            </Card>

            <Card className="p-4 border-2 border-border bg-card/80 backdrop-blur-sm flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center mb-1.5">
                <CheckCircle className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-foreground">{performedQuizzesCount}</div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Realizados</div>
            </Card>

            <Card className="p-4 border-2 border-border bg-card/80 backdrop-blur-sm flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mb-1.5">
                <Target className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-foreground">{userProgress.weakPoints.length}</div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">A Reforzar</div>
            </Card>
          </div>

          {/* Sneak peek: Temas a Reforzar */}
          {userProgress.weakPoints.length > 0 && (
            <WeakPointsSection weakPoints={userProgress.weakPoints} variant="preview" limit={3} />
          )}

          {/* Sneak peek: Cofre de Tips */}
          <TipsChest tips={studentTips} limit={3} />

          {/* Historial teaser */}
          {performedQuizzesCount > 0 && (
            <Card
              onClick={() => router.push('/history')}
              className="p-4 border-2 border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all cursor-pointer rounded-2xl flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">
                    Historial de Evaluaciones y Actividad Reciente
                  </h4>
                  <p className="text-xs text-muted-foreground font-medium">
                    Tienes {performedQuizzesCount} evaluación{performedQuizzesCount > 1 ? 'es' : ''} realizada{performedQuizzesCount > 1 ? 's' : ''} en tu historial
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-bold text-primary gap-1 group-hover:translate-x-0.5 transition-transform shrink-0"
              >
                <span>Ver Historial</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
