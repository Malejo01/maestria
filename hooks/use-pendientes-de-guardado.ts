'use client'

import { useEffect, useReducer, useMemo } from 'react'
import { ColaDeGuardado, type Entorno } from '@/lib/guardado-pendiente'
import { useViewerId } from './use-viewer-id'

/**
 * M1: los resultados que todavía no llegaron al servidor. Al montarse (en
 * cualquier pantalla del alumno) reintenta los que quedaron de otra vez, y
 * también cuando el navegador avisa que volvió la conexión.
 *
 * Una cola por persona, compartida por todos los que usan el hook: la pantalla
 * de resultados encola y el reintento global (QuizOverlay) no manda el mismo
 * pendiente dos veces a la vez.
 */
const colas = new Map<string, ColaDeGuardado>()

function entornoDelNavegador(): Entorno {
  let almacen: Entorno['almacen'] = null
  try {
    almacen = typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    almacen = null
  }
  return {
    almacen,
    fetch: (...args) => fetch(...args),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    ahora: () => new Date(),
  }
}

export function colaDeGuardadoPara(viewerId: string, entorno?: Entorno): ColaDeGuardado {
  let cola = colas.get(viewerId)
  if (!cola) {
    cola = new ColaDeGuardado(viewerId, entorno ?? entornoDelNavegador())
    colas.set(viewerId, cola)
  }
  return cola
}

export function usePendientesDeGuardado(opciones: { viewerId?: string | null; entorno?: Entorno } = {}) {
  const idDelServidor = useViewerId()
  const viewerId = opciones.viewerId !== undefined ? opciones.viewerId : idDelServidor
  const { entorno } = opciones
  const cola = useMemo(() => (viewerId ? colaDeGuardadoPara(viewerId, entorno) : null), [viewerId, entorno])
  const [, refrescar] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    if (!cola) return
    const desuscribir = cola.suscribir(refrescar)
    cola.reintentarTodos()
    const alVolver = () => cola.reintentarTodos()
    window.addEventListener('online', alVolver)
    return () => {
      desuscribir()
      window.removeEventListener('online', alVolver)
    }
  }, [cola])

  return { cola, viewerId }
}
