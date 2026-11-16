'use client'

import { useCallback, useEffect, useState } from 'react'
import type { OpcionDePago, ResumenDelPlan } from '@/lib/planes'
import { pedirJson } from '@/lib/pedir-json'

export interface PlanDelPanel {
  plan: ResumenDelPlan
  /** Lo que se le ofrece para renovar o subir de nivel, si hay precios cargados. */
  renovar: OpcionDePago | null
}

/**
 * El plan del docente para el panel (GET /api/teacher/plan). Si la lectura
 * falla, `datos` queda en null y nada del plan se muestra: el panel no se
 * cierra por esto.
 */
export function usePlanDocente(refrescarCon?: unknown) {
  const [datos, setDatos] = useState<PlanDelPanel | null>(null)
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    let vigente = true
    void pedirJson<PlanDelPanel>('/api/teacher/plan').then((res) => {
      if (vigente) setDatos('data' in res ? res.data : null)
    })
    return () => {
      vigente = false
    }
  }, [refrescarCon, vuelta])

  const recargar = useCallback(() => setVuelta((n) => n + 1), [])

  return { datos, recargar }
}
