'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { ArmarDiagnostico } from '@/components/docente/armar-diagnostico'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import type { DiagnosticoListado } from '@/lib/diagnostico-server'
import { DIAGNOSTICO as T } from '@/lib/textos'
import type { ProgramUnit } from '@/lib/types'

export interface EstadoDiagnostico {
  disponible: boolean
  grupo?: { classroomId: number; materiaId: number; materia: string; unidades: ProgramUnit[] }
  temasDificiles?: string[]
  diagnosticos?: DiagnosticoListado[]
}

/**
 * La sección Diagnóstico de la ficha (J4; el resultado llega con J6). Sin la
 * 027 no se dibuja nada: la válvula.
 */
export function SeccionDiagnostico({ destino }: { destino: { alumno: string } | { invitacion: number } }) {
  const consulta = 'alumno' in destino ? `alumno=${encodeURIComponent(destino.alumno)}` : `invitacion=${destino.invitacion}`
  const [estado, setEstado] = useState<EstadoDiagnostico | null>(null)
  const [armando, setArmando] = useState(false)

  const leer = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/diagnosticos?${consulta}`)
      setEstado(res.ok ? await res.json() : { disponible: false })
    } catch {
      setEstado({ disponible: false })
    }
  }, [consulta])

  useEffect(() => {
    void leer()
  }, [leer])

  if (!estado?.disponible || !estado.grupo) return null
  const diagnosticos = estado.diagnosticos ?? []

  return (
    <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6" aria-labelledby="ficha-diagnostico">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="ficha-diagnostico" className="titulo-m text-texto">
            {T.titulo}
          </h2>
          <p className="nota mt-1 max-w-prose text-texto-suave">{T.detalle}</p>
        </div>
        <Boton variante={diagnosticos.length > 0 ? 'secundario' : 'principal'} className="shrink-0" onClick={() => setArmando(true)}>
          <ClipboardCheck aria-hidden="true" strokeWidth={TRAZO_ICONO} />
          {diagnosticos.length > 0 ? T.armarOtro : T.armar}
        </Boton>
      </div>

      {diagnosticos.length === 0 ? (
        <p className="cuerpo-s mt-4 text-texto-suave">{T.vacio}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {diagnosticos.map((d) => (
            <li key={d.id}>
              <p className="nota font-semibold text-texto-suave">
                {T.armado(new Date(d.creadoEl).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }), d.modo)}
              </p>
              <ul className="mt-1 flex flex-col">
                {d.cuestionarios.map((c) => (
                  <li key={c.id} className="cuerpo-s flex items-center justify-between gap-3 border-b border-borde py-2 last:border-b-0">
                    <span className="min-w-0 text-texto">{c.titulo}</span>
                    <span className="nota shrink-0 text-texto-suave">{T.preguntas(c.preguntas)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <ArmarDiagnostico
        abierto={armando}
        onCambiar={setArmando}
        destino={destino}
        materia={estado.grupo.materia}
        unidades={estado.grupo.unidades}
        temasDificiles={estado.temasDificiles ?? []}
        alTerminar={leer}
      />
    </section>
  )
}
