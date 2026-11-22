'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Boton } from '@/components/sistema/boton'
import { pedirJson } from '@/lib/pedir-json'
import { CODIGOS_ADMIN as T } from '@/lib/textos'

const CAMPO = 'h-10 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-2 cuerpo-s text-texto'

/** C1 · Crear un código de descuento. Al crear, la página se relee. */
export function CrearCodigo() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [porcentaje, setPorcentaje] = useState(50)
  const [aplica, setAplica] = useState('particular')
  const [forma, setForma] = useState('ambos')
  const [meses, setMeses] = useState('')
  const [usos, setUsos] = useState(1)
  const [vence, setVence] = useState('')
  const [fundadora, setFundadora] = useState(false)
  const [nota, setNota] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function crear(evento: FormEvent) {
    evento.preventDefault()
    setEnviando(true)
    setEstado(null)
    const res = await pedirJson('/api/admin/codigos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codigo,
        porcentaje,
        aplica,
        forma,
        meses: meses ? Number(meses) : null,
        usosMaximos: usos,
        venceEl: vence ? new Date(`${vence}T23:59:59-03:00`).toISOString() : null,
        fundadora,
        nota,
      }),
    })
    setEnviando(false)
    if ('error' in res) {
      setEstado({ tipo: 'error', texto: res.error })
      return
    }
    setEstado({ tipo: 'ok', texto: T.creado })
    setCodigo('')
    setNota('')
    setMeses('')
    setVence('')
    setFundadora(false)
    router.refresh()
  }

  return (
    <form onSubmit={crear} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.codigo}</span>
        <input className={`${CAMPO} uppercase`} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="FUNDADORA-SIL" required maxLength={40} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.porcentaje}</span>
        <input type="number" min={1} max={100} className={`${CAMPO} w-20`} value={porcentaje} onChange={(e) => setPorcentaje(Number(e.target.value))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.aplica}</span>
        <select className={CAMPO} value={aplica} onChange={(e) => setAplica(e.target.value)}>
          {(['particular', 'aula', 'pase_alumno', 'todos'] as const).map((a) => (
            <option key={a} value={a}>
              {T.aplica[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.forma}</span>
        <select className={CAMPO} value={forma} onChange={(e) => setForma(e.target.value)}>
          {(['mensual', 'pase', 'ambos'] as const).map((f) => (
            <option key={f} value={f}>
              {T.forma[f]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.meses}</span>
        <input type="number" min={1} max={36} className={`${CAMPO} w-20`} value={meses} onChange={(e) => setMeses(e.target.value)} placeholder="—" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.usos}</span>
        <input type="number" min={1} max={1000} className={`${CAMPO} w-20`} value={usos} onChange={(e) => setUsos(Math.max(1, Number(e.target.value) || 1))} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.vence}</span>
        <input type="date" className={CAMPO} value={vence} onChange={(e) => setVence(e.target.value)} />
      </label>
      <label className="cuerpo-s inline-flex min-h-11 items-center gap-2 text-texto">
        <input type="checkbox" className="size-4 accent-[var(--accion)]" checked={fundadora} onChange={(e) => setFundadora(e.target.checked)} />
        {T.campos.fundadora}
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1">
        <span className="nota text-texto-suave">{T.campos.nota}</span>
        <input className={CAMPO} value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} placeholder={T.campos.notaEjemplo} />
      </label>
      <Boton type="submit" disabled={enviando}>
        {enviando ? T.creando : T.crearBoton}
      </Boton>
      {estado && (
        <p role={estado.tipo === 'error' ? 'alert' : 'status'} className={`nota w-full ${estado.tipo === 'error' ? 'text-flojo' : 'text-logrado'}`}>
          {estado.texto}
        </p>
      )}
    </form>
  )
}

/** C1 · Desactivar (o volver a activar) un código. */
export function DesactivarCodigo({ id, activo }: { id: number; activo: boolean }) {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  async function cambiar() {
    setEnviando(true)
    await pedirJson(`/api/admin/codigos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !activo }),
    })
    setEnviando(false)
    router.refresh()
  }
  return (
    <Boton variante="secundario" disabled={enviando} onClick={cambiar}>
      {activo ? T.desactivar : T.activar}
    </Boton>
  )
}
