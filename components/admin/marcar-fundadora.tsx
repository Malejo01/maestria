'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pedirJson } from '@/lib/pedir-json'
import { DISTINTIVO_DEL_PLAN } from '@/lib/textos'

/** B2 · La casilla de docente fundadora en /admin/planes. Sólo el admin la pone o la saca. */
export function MarcarFundadora({ docenteId, fundadora }: { docenteId: string; fundadora: boolean }) {
  const router = useRouter()
  const [marcada, setMarcada] = useState(fundadora)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiar(valor: boolean) {
    setEnviando(true)
    setError(null)
    const res = await pedirJson('/api/admin/planes/fundadora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docenteId, fundadora: valor }),
    })
    setEnviando(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setMarcada(valor)
    router.refresh()
  }

  return (
    <label className="cuerpo-s inline-flex min-h-11 items-center gap-2 text-texto">
      <input
        type="checkbox"
        className="size-4 accent-[var(--accion)]"
        checked={marcada}
        disabled={enviando}
        onChange={(e) => cambiar(e.target.checked)}
      />
      {DISTINTIVO_DEL_PLAN.fundadora}
      {error && (
        <span role="alert" className="nota text-flojo">
          {error}
        </span>
      )}
    </label>
  )
}
