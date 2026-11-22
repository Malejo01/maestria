'use client'

import { useEffect, useRef, useState } from 'react'

/** "mm:ss" (o "h:mm:ss" desde una hora). */
export function formatearTiempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const dos = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${dos(m)}:${dos(r)}`
}

/** Los segundos que quedan de `minutos` desde `inicio` (ISO), a la hora `ahora`. */
export function segundosQueQuedan(minutos: number, inicio: string | null, ahora: number): number {
  const desde = inicio ? Date.parse(inicio) : ahora
  return Math.max(0, Math.ceil((desde + minutos * 60_000 - ahora) / 1000))
}

/**
 * Ronda T · E1 — La cuenta regresiva del simulacro. null sin límite. Al llegar
 * a 0 llama `alTerminar` UNA sola vez. Se calcula desde el inicio guardado del
 * cuestionario: si el alumno recarga, no le devuelve el tiempo.
 */
export function useCuentaRegresiva(minutos: number | undefined, inicio: string | null, alTerminar: () => void): number | null {
  const [ahora, setAhora] = useState(() => Date.now())
  const termino = useRef(false)
  const alTerminarRef = useRef(alTerminar)
  useEffect(() => {
    alTerminarRef.current = alTerminar
  })

  useEffect(() => {
    if (!minutos) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [minutos])

  const restantes = minutos ? segundosQueQuedan(minutos, inicio, ahora) : null

  useEffect(() => {
    if (restantes === 0 && !termino.current) {
      termino.current = true
      alTerminarRef.current()
    }
  }, [restantes])

  return restantes
}
