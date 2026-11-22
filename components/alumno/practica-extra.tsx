'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { useToast } from '@/hooks/use-toast'
import { aiCutoffMessage } from '@/lib/ai-cutoff-message'
import { pedirJson } from '@/lib/pedir-json'
import { muestraLaPracticaExtra, type ConfigDePracticaExtra, type EstadoDePracticaExtra } from '@/lib/practica-extra'
import { useAppStore } from '@/lib/store'
import { PRACTICA_EXTRA as T } from '@/lib/textos'
import type { Question } from '@/lib/types'

interface Reserva {
  ok: true
  id: number
  classroomId: number
  config: ConfigDePracticaExtra
  restantes: number
}

/**
 * P4 · "Practicar otra vez con preguntas nuevas", en los resultados de una
 * tarea (y de una práctica extra de esa tarea). Misma configuración que la
 * tarea, preguntas distintas, y NO cuenta como intento: no cambia la nota.
 *
 * No aparece si el plan del docente venció, si es un diagnóstico o sin la 036.
 * Con el tope del día (3) alcanzado, en su lugar va el texto del tope.
 */
export function PracticaExtra({ asignacionId }: { asignacionId: number }) {
  const [estado, setEstado] = useState<EstadoDePracticaExtra | null>(null)
  const [armando, setArmando] = useState(false)
  const startQuiz = useAppStore((s) => s.startQuiz)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { toast } = useToast()

  useEffect(() => {
    let vigente = true
    void pedirJson<EstadoDePracticaExtra>(`/api/student/practica-extra?asignacion=${asignacionId}`).then((r) => {
      if (vigente && !('error' in r)) setEstado(r.data)
    })
    return () => {
      vigente = false
    }
  }, [asignacionId])

  if (!muestraLaPracticaExtra(estado)) return null

  if (estado?.motivo === 'tope') {
    return (
      <p className="nota rounded-lg border border-borde bg-superficie-suave px-3 py-2 text-center text-texto-suave" role="status">
        {T.tope}
      </p>
    )
  }

  async function practicar() {
    setArmando(true)
    const reserva = await pedirJson<Reserva>('/api/student/practica-extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asignacion: asignacionId }),
    })
    if ('error' in reserva) {
      setArmando(false)
      if (reserva.error === T.tope) setEstado((e) => (e ? { ...e, disponible: false, motivo: 'tope', restantes: 0 } : e))
      else toast({ title: T.fallo, description: T.falloDetalle })
      return
    }
    const { id, classroomId, config } = reserva.data
    setActiveView('loading')
    try {
      const respuesta = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practicaExtraId: id }),
      })
      const corte = await aiCutoffMessage(respuesta)
      const datos = (await respuesta.json().catch(() => null)) as { questions?: Question[] } | null
      const preguntas = Array.isArray(datos?.questions) ? datos.questions : []
      if (!respuesta.ok || preguntas.length === 0) {
        setActiveView('results')
        toast({ title: T.fallo, description: corte ?? T.falloDetalle })
        return
      }
      startQuiz(
        {
          subject: config.subject,
          subjectName: config.subjectName,
          topics: config.topics,
          mode: config.mode,
          questionCount: preguntas.length,
          questionTypes: config.questionTypes,
          nivel: config.nivel,
          grado: config.grado,
          pedagogyContext: config.pedagogyContext,
          classroomId,
          practicaExtraId: id,
          practicaDeTarea: asignacionId,
        },
        preguntas,
      )
    } catch {
      setActiveView('results')
      toast({ title: T.fallo, description: T.falloDetalle })
    } finally {
      setArmando(false)
    }
  }

  return (
    <div className="space-y-1">
      <Boton variante="secundario" ancho disabled={armando} onClick={() => void practicar()} className="min-h-12 whitespace-normal">
        {armando ? <Cargando /> : <RefreshCw aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />}
        {armando ? T.armando : T.boton}
      </Boton>
      <p className="nota text-center text-texto-suave">
        {T.detalle} {estado ? T.quedan(estado.restantes) : ''}
      </p>
    </div>
  )
}
