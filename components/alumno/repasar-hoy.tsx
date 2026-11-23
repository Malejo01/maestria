'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pedirJson } from '@/lib/pedir-json'
import { useAppStore } from '@/lib/store'
import type { Question } from '@/lib/types'
import { REPASO as T } from '@/lib/textos'

/**
 * Ronda X · X2 — La tarjeta "Repasar hoy": aparece sólo si hay preguntas que
 * tocan hoy (lib/repaso.ts). El repaso es práctica: sin nota de tarea, con
 * pista y revancha, y sus respuestas vuelven a alimentar el espaciado.
 */
export function RepasarHoy({ materia, nivel }: { materia?: string; nivel?: string }) {
  const { startQuiz, setActiveView } = useAppStore()
  const sinMovimiento = useReducedMotion()
  const [preguntas, setPreguntas] = useState<Question[]>([])

  useEffect(() => {
    let vigente = true
    const url = materia ? `/api/student/repaso?materia=${encodeURIComponent(materia)}` : '/api/student/repaso'
    void pedirJson<{ preguntas: Question[] }>(url).then((r) => {
      if (vigente && 'data' in r) setPreguntas(r.data.preguntas ?? [])
    })
    return () => {
      vigente = false
    }
  }, [materia])

  if (preguntas.length === 0) return null

  function empezar() {
    const temas = [...new Map(preguntas.map((q) => [q.topicName, { id: q.topic || q.topicName, name: q.topicName }])).values()]
    startQuiz(
      {
        subject: materia ? `repaso-${materia}` : 'repaso',
        subjectName: materia ?? T.materia,
        topics: temas,
        mode: 'mixto',
        questionCount: preguntas.length,
        ...(nivel ? { nivel } : {}),
      },
      preguntas,
    )
    setActiveView('quiz')
  }

  return (
    <motion.section
      initial={sinMovimiento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: sinMovimiento ? 0 : 0.2 }}
      className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-suave p-4 sm:flex-row sm:items-center"
      data-repasar-hoy={preguntas.length}
      aria-labelledby="repasar-hoy"
    >
      <div className="min-w-0 flex-1">
        <h2 id="repasar-hoy" className="titulo-s text-texto">
          {T.titulo}
        </h2>
        <p className="cuerpo-s text-texto-suave">{T.detalle(preguntas.length)}</p>
      </div>
      {/* Secundario: la acción principal de la pantalla es la tarea que toca. */}
      <Boton variante="secundario" onClick={empezar} className="shrink-0">
        <RotateCcw className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
        {T.empezar}
      </Boton>
    </motion.section>
  )
}
