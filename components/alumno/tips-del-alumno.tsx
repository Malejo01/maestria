'use client'

import { useEffect, useState } from 'react'
import { CargaFallida } from '@/components/carga-fallida'
import { Cargando } from '@/components/sistema/cargando'
import { TipsChest } from '@/components/tips-chest'
import { pedirJson } from '@/lib/pedir-json'
import { MI_PROGRESO } from '@/lib/textos'
import type { StudentTip } from '@/lib/types'

/**
 * Los tips del alumno: lo que MaestrIA le fue explicando cada vez que pidió que
 * le aclaren un error. Antes era una pantalla aparte ("Cofre de Tips"); ahora
 * es una pestaña de Mi progreso, junto con lo que hizo y lo que tiene que
 * reforzar.
 */
export function TipsDelAlumno() {
  const [tips, setTips] = useState<StudentTip[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    pedirJson<{ tips?: StudentTip[] }>('/api/user/tips')
      .then((res) => {
        if ('error' in res) setError(res.error)
        else if (Array.isArray(res.data.tips)) setTips(res.data.tips)
      })
      .finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return (
      <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
        <Cargando /> {MI_PROGRESO.tips.cargando}
      </p>
    )
  }

  if (error) {
    return <CargaFallida que={MI_PROGRESO.tips.queCargamos} detalle={error} onReintentar={() => window.location.reload()} />
  }

  return <TipsChest tips={tips} />
}
