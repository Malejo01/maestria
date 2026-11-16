'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CLAVE_TEMA, type Tema } from '@/lib/tema'

function leer(): Tema {
  return document.documentElement.dataset.theme === 'oscuro' ? 'oscuro' : 'claro'
}

function suscribir(avisar: () => void): () => void {
  // El atributo es la fuente de verdad: lo puede cambiar este hook, el script
  // del <head> u otra pestaña (vía el evento storage de abajo).
  const observador = new MutationObserver(avisar)
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  const alCambiarEnOtraPestana = (evento: StorageEvent) => {
    if (evento.key !== CLAVE_TEMA) return
    document.documentElement.dataset.theme = evento.newValue === 'oscuro' ? 'oscuro' : 'claro'
  }
  window.addEventListener('storage', alCambiarEnOtraPestana)

  return () => {
    observador.disconnect()
    window.removeEventListener('storage', alCambiarEnOtraPestana)
  }
}

/** Modo activo y cómo cambiarlo. En el servidor siempre es 'claro', que es el modo por defecto. */
export function useTema(): { tema: Tema; cambiarTema: (tema: Tema) => void } {
  const tema = useSyncExternalStore<Tema>(suscribir, leer, () => 'claro')

  const cambiarTema = useCallback((nuevo: Tema) => {
    document.documentElement.dataset.theme = nuevo
    try {
      localStorage.setItem(CLAVE_TEMA, nuevo)
    } catch {
      // Navegación privada o almacenamiento bloqueado: el modo vale para esta
      // carga y nada más. No es un error que haya que mostrar.
    }
  }, [])

  return { tema, cambiarTema }
}
