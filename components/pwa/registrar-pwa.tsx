'use client'

import { useEffect } from 'react'
import { escucharInstalacion } from '@/lib/instalar-cliente'

/**
 * Ronda X · X4 — Registra el service worker (sólo en producción: en `next dev`
 * un caché viejo confunde más de lo que ayuda) y empieza a escuchar el aviso
 * de instalación del navegador.
 */
export function RegistrarPwa() {
  useEffect(() => {
    escucharInstalacion()
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app anda igual: sólo no se instala ni muestra "sin conexión".
    })
  }, [])
  return null
}
