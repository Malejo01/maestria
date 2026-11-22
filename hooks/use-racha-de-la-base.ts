'use client'

import { useEffect } from 'react'
import { EVENTO_RACHA } from '@/lib/guardado-pendiente'
import { pedirJson } from '@/lib/pedir-json'
import { useAppStore } from '@/lib/store'

/**
 * O4 · La racha vive en la base. Al entrar (una vez por pestaña) se lee; si
 * la base todavía no tiene la de este alumno, la que guardaba el navegador se
 * pasa UNA vez. Después de cada intento guardado, el servidor devuelve la
 * racha nueva (evento `maestria:racha`) y manda sobre la del navegador.
 *
 * Sin sesión o sin la 032, no pasa nada: queda la del navegador.
 */
let leidaEnEstaPestana = false

/** Sólo para los tests. */
export function olvidarRachaLeida() {
  leidaEnEstaPestana = false
}

export function useRachaDeLaBase() {
  const setStreak = useAppStore((s) => s.setStreak)

  useEffect(() => {
    const alGuardar = (evento: Event) => {
      const racha = (evento as CustomEvent<unknown>).detail
      if (typeof racha === 'number') setStreak(racha)
    }
    window.addEventListener(EVENTO_RACHA, alGuardar)

    if (!leidaEnEstaPestana) {
      leidaEnEstaPestana = true
      void (async () => {
        const leida = await pedirJson<{ racha: number | null }>('/api/student/racha')
        if ('error' in leida) return
        if (typeof leida.data.racha === 'number') {
          setStreak(leida.data.racha)
          return
        }
        const delNavegador = useAppStore.getState().userProgress.streak
        const migrada = await pedirJson<{ racha: number | null }>('/api/student/racha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delNavegador }),
        })
        if (!('error' in migrada) && typeof migrada.data.racha === 'number') setStreak(migrada.data.racha)
      })()
    }

    return () => window.removeEventListener(EVENTO_RACHA, alGuardar)
  }, [setStreak])
}
