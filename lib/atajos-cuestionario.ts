/**
 * L2: los atajos de teclado del cuestionario, en escritorio. Puro y con tests:
 * dada una tecla y el estado de la pantalla, qué hacer (o nada). El motor
 * (components/quiz-engine.tsx) sólo escucha la tecla y ejecuta la acción.
 *
 *   ↑ / ↓        mover entre las opciones (opción múltiple, verdadero o falso)
 *   Espacio      elegir la opción enfocada (lo hace el botón mismo)
 *   1–9 / A–D    elegir esa opción
 *   V / F        verdadero o falso
 *   Enter        confirmar, o pasar a la siguiente si ya respondió; en un
 *                campo de texto, confirma lo escrito
 *   ← / →        anterior o siguiente, donde la navegación ya lo permite
 *   ?            mostrar u ocultar la ayuda
 *   Esc          salir (con confirmación)
 *
 * Nunca con un diálogo abierto, y nunca mientras se escribe en un campo,
 * salvo Enter: escribir "1" en una numérica no elige la opción 1.
 */

export type AccionDeAtajo =
  | { tipo: 'mover'; delta: 1 | -1 }
  | { tipo: 'elegir'; indice: number }
  | { tipo: 'verdaderoFalso'; valor: boolean }
  | { tipo: 'confirmar' }
  | { tipo: 'siguiente' }
  | { tipo: 'anterior' }
  | { tipo: 'ayuda' }
  | { tipo: 'salir' }

export interface EstadoParaAtajos {
  tipoDePregunta: 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer'
  cantidadDeOpciones: number
  /** Ya eligió o escribió algo que se puede confirmar. */
  hayRespuesta: boolean
  /** Ya la confirmó (y está viendo la devolución). */
  enviada: boolean
  /** El foco está en un input o un textarea. */
  enCampoDeTexto: boolean
  /** Hay un diálogo abierto (salir, explicación, cambios sin guardar…). */
  dialogoAbierto: boolean
  puedeIrAtras: boolean
  puedeIrAdelante: boolean
}

export interface Tecla {
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
}

export function accionDeTecla(tecla: Tecla, estado: EstadoParaAtajos): AccionDeAtajo | null {
  if (estado.dialogoAbierto) return null
  if (tecla.ctrlKey || tecla.metaKey || tecla.altKey) return null
  const { key } = tecla

  if (key === 'Enter') {
    // Shift+Enter en un textarea es un renglón nuevo.
    if (estado.enCampoDeTexto && tecla.shiftKey) return null
    if (estado.enviada) return estado.puedeIrAdelante ? { tipo: 'siguiente' } : null
    return estado.hayRespuesta ? { tipo: 'confirmar' } : null
  }

  // Escribiendo: ninguna otra tecla es atajo.
  if (estado.enCampoDeTexto) return null

  if (key === 'Escape') return { tipo: 'salir' }
  if (key === '?') return { tipo: 'ayuda' }
  if (key === 'ArrowRight') return estado.enviada && estado.puedeIrAdelante ? { tipo: 'siguiente' } : null
  if (key === 'ArrowLeft') return estado.puedeIrAtras ? { tipo: 'anterior' } : null

  if (estado.enviada) return null

  const conOpciones = estado.tipoDePregunta === 'multiple_choice' || estado.tipoDePregunta === 'true_false'
  if (!conOpciones) return null

  if (key === 'ArrowDown') return { tipo: 'mover', delta: 1 }
  if (key === 'ArrowUp') return { tipo: 'mover', delta: -1 }

  if (estado.tipoDePregunta === 'true_false') {
    const letra = key.toLowerCase()
    if (letra === 'v' || key === '1') return { tipo: 'verdaderoFalso', valor: true }
    if (letra === 'f' || key === '2') return { tipo: 'verdaderoFalso', valor: false }
    return null
  }

  if (/^[1-9]$/.test(key)) {
    const indice = Number(key) - 1
    return indice < estado.cantidadDeOpciones ? { tipo: 'elegir', indice } : null
  }
  const letra = key.toUpperCase()
  if (/^[A-D]$/.test(letra) && key.length === 1) {
    const indice = letra.charCodeAt(0) - 65
    return indice < estado.cantidadDeOpciones ? { tipo: 'elegir', indice } : null
  }
  return null
}

/** El índice al que se mueve el foco con ↑/↓, dando la vuelta. */
export function moverEnOpciones(actual: number | null, delta: 1 | -1, cantidad: number): number {
  if (cantidad <= 0) return 0
  if (actual === null) return delta === 1 ? 0 : cantidad - 1
  return (actual + delta + cantidad) % cantidad
}

/** Los atajos sólo en escritorio: puntero fino y 768 px o más. */
export const CONSULTA_DE_ESCRITORIO = '(pointer: fine) and (min-width: 768px)'
