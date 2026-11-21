'use client'

import { useEffect, useState } from 'react'
import { obtenerViewerId, viewerIdConocido } from '@/lib/viewer-cliente'

/** M1: el id de quien mira (`null` mientras no se sabe o si no hay nadie). */
export function useViewerId(): string | null {
  const [id, setId] = useState<string | null>(() => viewerIdConocido())
  useEffect(() => {
    let vigente = true
    obtenerViewerId().then((valor) => {
      if (vigente && valor) setId(valor)
    })
    return () => {
      vigente = false
    }
  }, [])
  return id
}
