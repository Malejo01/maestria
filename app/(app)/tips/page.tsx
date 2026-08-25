'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { TipsChest } from '@/components/tips-chest'
import { CargaFallida } from '@/components/carga-fallida'
import { pedirJson } from '@/lib/pedir-json'
import type { StudentTip } from '@/lib/types'

export default function TipsPage() {
  const [studentTips, setStudentTips] = useState<StudentTip[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    pedirJson<{ tips?: StudentTip[] }>('/api/user/tips')
      .then((res) => {
        if ('error' in res) setLoadError(res.error)
        else if (Array.isArray(res.data.tips)) setStudentTips(res.data.tips)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-sm shrink-0">
          <Sparkles className="w-5 h-5 fill-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Cofre de Tips</h1>
          <p className="text-sm text-muted-foreground">
            Tus apuntes e ideas clave extraídos por la IA. Toca una tarjeta para dar vuelta y ver el consejo.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border-2 border-dashed border-border/60 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : loadError ? (
        <CargaFallida que="tus tips" detalle={loadError} onReintentar={() => window.location.reload()} />
      ) : (
        <TipsChest tips={studentTips} />
      )}
    </div>
  )
}
