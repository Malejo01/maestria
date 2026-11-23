'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { pistaPermitida, type ContextoDePista } from '@/lib/pista'
import type { Question } from '@/lib/types'
import { PISTA } from '@/lib/textos'

type Estado = { tipo: 'quieto' } | { tipo: 'pidiendo' } | { tipo: 'lista'; pista: string } | { tipo: 'aviso'; texto: string }

/**
 * Ronda X · X1 — "Pedir una pista", antes de responder. Sólo en la práctica
 * (lib/pista.ts) y con cuenta (el invitado no tiene). Una por pregunta: la
 * pista pedida queda a la vista hasta pasar a la siguiente.
 */
export function QuizPista({
  question,
  contexto,
  respondida,
  nivel,
  grado,
  materia,
}: {
  question: Question
  contexto: ContextoDePista | null | undefined
  respondida: boolean
  nivel?: string
  grado?: string
  materia?: string
}) {
  const { status } = useSession()
  const sinMovimiento = useReducedMotion()
  const [porPregunta, setPorPregunta] = useState<Record<string, Estado>>({})
  const estado = porPregunta[question.id] ?? { tipo: 'quieto' }

  if (status !== 'authenticated' || !pistaPermitida(contexto) || question.type === 'essay') return null
  if (respondida && estado.tipo !== 'lista') return null

  const poner = (e: Estado) => setPorPregunta((prev) => ({ ...prev, [question.id]: e }))

  async function pedir() {
    poner({ tipo: 'pidiendo' })
    try {
      const res = await fetch('/api/quiz/pista', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          // Sólo lo que decide si hay pista, no toda la configuración del cuestionario.
          contexto: {
            assignmentId: contexto?.assignmentId,
            practicaExtraId: contexto?.practicaExtraId,
            practicaDeTarea: contexto?.practicaDeTarea,
            previewOnly: contexto?.previewOnly,
            devolucion: contexto?.devolucion,
            limiteMinutos: contexto?.limiteMinutos,
            autodidacta: contexto?.autodidacta ? { tipo: contexto.autodidacta.tipo } : undefined,
          },
          nivel,
          grado,
          materia,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { pista?: string }
      if (res.ok && body.pista) return poner({ tipo: 'lista', pista: body.pista })
      poner({ tipo: 'aviso', texto: res.status === 429 ? PISTA.tope : res.status === 422 ? PISTA.sinPista : PISTA.error })
    } catch {
      poner({ tipo: 'aviso', texto: PISTA.error })
    }
  }

  return (
    <div className="space-y-2" data-pista={estado.tipo}>
      {(estado.tipo === 'quieto' || estado.tipo === 'pidiendo') && (
        <Boton variante="secundario" onClick={pedir} disabled={estado.tipo === 'pidiendo'}>
          <Lightbulb className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {estado.tipo === 'pidiendo' ? PISTA.pensando : PISTA.pedir}
        </Boton>
      )}
      <AnimatePresence initial={false}>
        {estado.tipo === 'lista' && (
          <motion.div
            key="pista"
            role="status"
            initial={sinMovimiento ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: sinMovimiento ? 0 : 0.18 }}
            className="flex items-start gap-2 rounded-md border border-borde bg-superficie-suave p-3"
          >
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-texto" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            <p className="cuerpo-s text-texto">
              <span className="font-semibold">{PISTA.titulo}: </span>
              {estado.pista}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {estado.tipo === 'aviso' && (
        <p role="status" className="nota text-texto-suave">
          {estado.texto}
        </p>
      )}
    </div>
  )
}
