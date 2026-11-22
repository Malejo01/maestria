'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Boton } from '@/components/sistema/boton'
import { NIVELES, cupoDeNivel, type NivelPlan } from '@/lib/planes'
import { pedirJson } from '@/lib/pedir-json'

const CAMPO = 'h-10 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-2 cuerpo-s text-texto'
const nombreNivel = (nivel: number) =>
  nivel === 0 ? 'Prueba' : nivel === 5 ? 'Tope' : nivel === 1 ? '1 bloque' : `${nivel} bloques`

/**
 * G4: el formulario de una fila de /admin/planes. Nivel, hasta cuándo (30
 * días, 90 días o una fecha) y con qué pagó. Al acreditar, la página se
 * relee y la fila muestra el estado nuevo y la línea en las notas.
 */
export function AcreditarPlan({
  docenteId,
  nivelActual,
  tipoActual = 'particular',
  cursosActuales = 0,
}: {
  docenteId: string
  nivelActual: NivelPlan | null
  tipoActual?: 'particular' | 'aula'
  cursosActuales?: number
}) {
  const router = useRouter()
  const [nivel, setNivel] = useState<NivelPlan>(nivelActual && nivelActual > 0 ? nivelActual : 1)
  // B1: Particular (bloques) o Aula (cursos de hasta 35).
  const [tipo, setTipo] = useState<'particular' | 'aula'>(tipoActual)
  const [cursos, setCursos] = useState(Math.max(1, cursosActuales))
  const [duracion, setDuracion] = useState<'30' | '90' | 'fecha'>('30')
  const [fecha, setFecha] = useState('')
  const [nota, setNota] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function acreditar(evento: FormEvent) {
    evento.preventDefault()
    if (duracion === 'fecha' && !fecha) return
    setEnviando(true)
    setEstado(null)
    // Una fecha elegida vale hasta el final de ese día, en hora argentina.
    // En Aula el nivel no decide el cupo (lo deciden los cursos): va 1, "pago".
    const base = tipo === 'aula' ? { docenteId, nivel: 1, nota, tipo, cursos } : { docenteId, nivel, nota, tipo }
    const cuerpo =
      duracion === 'fecha'
        ? { ...base, venceEl: new Date(`${fecha}T23:59:59-03:00`).toISOString() }
        : { ...base, dias: Number(duracion) }
    const res = await pedirJson<{ venceEl: string }>('/api/admin/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    setEnviando(false)
    if ('error' in res) {
      setEstado({ tipo: 'error', texto: res.error })
      return
    }
    setEstado({ tipo: 'ok', texto: `Acreditado hasta el ${new Date(res.data.venceEl).toLocaleDateString('es-AR')}.` })
    setNota('')
    router.refresh()
  }

  return (
    <form onSubmit={acreditar} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">Plan</span>
        <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
          <option value="particular">Particular</option>
          <option value="aula">Aula</option>
        </select>
      </label>
      {tipo === 'particular' ? (
        <label className="flex flex-col gap-1">
          <span className="nota text-texto-suave">Nivel</span>
          <select className={CAMPO} value={nivel} onChange={(e) => setNivel(Number(e.target.value) as NivelPlan)}>
            {NIVELES.map((n) => (
              <option key={n} value={n}>
                {nombreNivel(n)} · {cupoDeNivel(n)} alumnos
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="nota text-texto-suave">Cursos (hasta 35 c/u)</span>
          <input
            type="number"
            min={1}
            max={50}
            className={`${CAMPO} w-24`}
            value={cursos}
            onChange={(e) => setCursos(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">Hasta</span>
        <select className={CAMPO} value={duracion} onChange={(e) => setDuracion(e.target.value as typeof duracion)}>
          <option value="30">30 días (mes)</option>
          <option value="90">90 días (pase)</option>
          <option value="fecha">Una fecha…</option>
        </select>
      </label>
      {duracion === 'fecha' && (
        <label className="flex flex-col gap-1">
          <span className="nota text-texto-suave">Fecha</span>
          <input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </label>
      )}
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="nota text-texto-suave">Con qué pagó</span>
        <input
          className={CAMPO}
          value={nota}
          maxLength={300}
          placeholder="MercadoPago, pase, comprobante 123"
          onChange={(e) => setNota(e.target.value)}
        />
      </label>
      <Boton type="submit" disabled={enviando}>
        {enviando ? 'Acreditando…' : 'Acreditar'}
      </Boton>
      {estado && (
        <p
          role={estado.tipo === 'error' ? 'alert' : 'status'}
          className={`nota w-full ${estado.tipo === 'error' ? 'text-flojo' : 'text-logrado'}`}
        >
          {estado.texto}
        </p>
      )}
    </form>
  )
}
