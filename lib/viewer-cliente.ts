'use client'

/**
 * M1: el id de quien mira, del lado del navegador (ver
 * app/api/student/viewer/route.ts). Se pide una vez por carga y se recuerda
 * en `sessionStorage`, así un corte de conexión a mitad del cuestionario no
 * deja sin clave al borrador ni al resultado pendiente.
 */
const CLAVE = 'maestria:viewer-id'

let enCurso: Promise<string | null> | null = null
let conocido: string | null = null

function leerRecordado(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

function recordar(id: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (id) window.sessionStorage.setItem(CLAVE, id)
    else window.sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin sessionStorage se vuelve a pedir en la próxima carga.
  }
}

/** Lo último que se supo, sin pedir nada (puede ser `null`). */
export function viewerIdConocido(): string | null {
  return conocido ?? leerRecordado()
}

export function obtenerViewerId(): Promise<string | null> {
  if (enCurso) return enCurso
  enCurso = Promise.resolve()
    .then(() => fetch('/api/student/viewer', { cache: 'no-store' }))
    .then((r) => (r?.ok ? r.json() : null))
    .then((datos: { id?: unknown } | null) => {
      const id = typeof datos?.id === 'string' && datos.id ? datos.id : null
      conocido = id
      recordar(id)
      return id
    })
    .catch(() => {
      // Sin conexión: lo recordado de esta pestaña, y se vuelve a pedir la próxima.
      enCurso = null
      return leerRecordado()
    })
  return enCurso
}

/** Sólo para tests. */
export function olvidarViewerId() {
  enCurso = null
  conocido = null
  recordar(null)
}
