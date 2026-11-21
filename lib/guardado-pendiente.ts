import type { Almacen } from './borrador-cuestionario'

/**
 * M1 · El resultado terminado que todavía no llegó al servidor.
 *
 * Antes, `components/results-screen.tsx` marcaba el intento como guardado
 * ANTES de mandarlo, y si el `fetch` fallaba el error terminaba en
 * `console.error`: el alumno veía su nota y el docente nunca veía el intento.
 * Con conexión inestable, en clase virtual, era el peor caso posible.
 *
 * Ahora el resultado se escribe primero en `localStorage` y se borra recién
 * con el 200 del servidor. Mientras tanto se reintenta con espera creciente y
 * al volver la conexión (`online`), y cualquier pantalla del alumno reintenta
 * los que quedaron al cargar (`usePendientesDeGuardado`). El `clientAttemptId`
 * hace que reintentar no cree dos intentos (migración 029).
 *
 * La cola vive a nivel de módulo, una por persona: la pantalla de resultados y
 * el reintento global comparten la misma, así un pendiente nunca sale dos veces
 * a la vez.
 */

const PREFIJO = 'maestria:pendiente:'

/** A los 2, 5, 15 y 30 segundos; después, cada 60. */
export const ESPERAS_MS = [2_000, 5_000, 15_000, 30_000] as const
export const ESPERA_FINAL_MS = 60_000

export function esperaParaIntento(fallidos: number): number {
  return ESPERAS_MS[fallidos - 1] ?? ESPERA_FINAL_MS
}

export interface Pendiente {
  clientAttemptId: string
  /** El cuerpo tal cual va a `/api/quiz/save-result` (ya trae `clientAttemptId`). */
  cuerpo: Record<string, unknown>
  creadoEl: string
}

export type EstadoDeGuardado =
  | { tipo: 'guardando' }
  | { tipo: 'guardado'; quizAttemptId?: number }
  | { tipo: 'sin-conexion' }
  | { tipo: 'error'; mensaje: string }

export function claveDePendiente(viewerId: string, clientAttemptId: string): string {
  return `${PREFIJO}${viewerId}:${clientAttemptId}`
}

/** Un UUID; `crypto.randomUUID` falta en contextos no seguros (http en la red local). */
export function nuevoClientAttemptId(): string {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Qué hacer con la respuesta del servidor. 200: listo. Error de red, 5xx, 408
 * o 429: se reintenta. El resto de los 4xx (tarea vencida, cupo de intentos,
 * sesión que ya no existe) no se arregla reintentando: se muestra el error.
 */
export type Desenlace =
  | { tipo: 'guardado'; quizAttemptId?: number }
  | { tipo: 'reintentar' }
  | { tipo: 'error'; mensaje: string }

export async function enviarPendiente(fetchImpl: typeof fetch, pendiente: Pendiente): Promise<Desenlace> {
  let respuesta: Response
  try {
    respuesta = await fetchImpl('/api/quiz/save-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pendiente.cuerpo),
    })
  } catch {
    return { tipo: 'reintentar' }
  }
  if (respuesta.ok) {
    const datos = (await respuesta.json().catch(() => null)) as { quizAttemptId?: unknown } | null
    const id = Number(datos?.quizAttemptId)
    return { tipo: 'guardado', ...(Number.isFinite(id) && id > 0 ? { quizAttemptId: id } : {}) }
  }
  if (respuesta.status >= 500 || respuesta.status === 408 || respuesta.status === 429) return { tipo: 'reintentar' }
  const datos = (await respuesta.json().catch(() => null)) as { error?: unknown } | null
  return { tipo: 'error', mensaje: typeof datos?.error === 'string' ? datos.error : `Error ${respuesta.status}` }
}

/** Los pendientes de esta persona que quedaron en el almacén. */
export function listarPendientes(almacen: (Almacen & Pick<Storage, 'length' | 'key'>) | null, viewerId: string): Pendiente[] {
  if (!almacen) return []
  const prefijo = `${PREFIJO}${viewerId}:`
  const encontrados: Pendiente[] = []
  try {
    for (let i = 0; i < almacen.length; i += 1) {
      const clave = almacen.key(i)
      if (!clave || !clave.startsWith(prefijo)) continue
      const pendiente = leerPendiente(almacen.getItem(clave))
      if (pendiente) encontrados.push(pendiente)
    }
  } catch {
    return encontrados
  }
  return encontrados.sort((a, b) => a.creadoEl.localeCompare(b.creadoEl))
}

export function leerPendiente(crudo: string | null): Pendiente | null {
  if (!crudo) return null
  try {
    const dato = JSON.parse(crudo) as Partial<Pendiente>
    if (typeof dato?.clientAttemptId !== 'string' || !dato.cuerpo || typeof dato.cuerpo !== 'object') return null
    return { clientAttemptId: dato.clientAttemptId, cuerpo: dato.cuerpo, creadoEl: String(dato.creadoEl ?? '') }
  } catch {
    return null
  }
}

export interface Entorno {
  almacen: (Almacen & Pick<Storage, 'length' | 'key'>) | null
  fetch: typeof fetch
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (id: unknown) => void
  ahora: () => Date
}

type Oyente = () => void

/**
 * La cola de una persona. `encolar` guarda y manda; `reintentarTodos` levanta
 * lo que quedó en el almacén (al cargar una pantalla, al volver la conexión).
 */
export class ColaDeGuardado {
  private estados = new Map<string, EstadoDeGuardado>()
  private enVuelo = new Set<string>()
  private fallidos = new Map<string, number>()
  private temporizadores = new Map<string, unknown>()
  private oyentes = new Set<Oyente>()
  /** Los que no se pudieron escribir en el almacén: viven sólo en memoria. */
  private enMemoria = new Map<string, Pendiente>()

  constructor(
    private readonly viewerId: string,
    private readonly entorno: Entorno,
  ) {}

  estado(clientAttemptId: string): EstadoDeGuardado | undefined {
    return this.estados.get(clientAttemptId)
  }

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente)
    return () => this.oyentes.delete(oyente)
  }

  /**
   * Guarda el resultado como pendiente y lo manda. Devuelve si quedó escrito en
   * el almacén (si no, sólo vive mientras la pestaña siga abierta).
   */
  encolar(clientAttemptId: string, cuerpo: Record<string, unknown>): boolean {
    const pendiente: Pendiente = {
      clientAttemptId,
      cuerpo: { ...cuerpo, clientAttemptId },
      creadoEl: this.entorno.ahora().toISOString(),
    }
    let escrito = false
    try {
      if (this.entorno.almacen) {
        this.entorno.almacen.setItem(claveDePendiente(this.viewerId, clientAttemptId), JSON.stringify(pendiente))
        escrito = true
      }
    } catch {
      escrito = false
    }
    if (!escrito) this.enMemoria.set(clientAttemptId, pendiente)
    void this.enviar(pendiente)
    return escrito
  }

  /** Lo que quedó de otra vez, y lo que espera su próximo reintento: ya. */
  reintentarTodos(): void {
    const todos = new Map<string, Pendiente>()
    for (const p of listarPendientes(this.entorno.almacen, this.viewerId)) todos.set(p.clientAttemptId, p)
    for (const [id, p] of this.enMemoria) todos.set(id, p)
    for (const pendiente of todos.values()) {
      const temporizador = this.temporizadores.get(pendiente.clientAttemptId)
      if (temporizador !== undefined) {
        this.entorno.clearTimeout(temporizador)
        this.temporizadores.delete(pendiente.clientAttemptId)
      }
      void this.enviar(pendiente)
    }
  }

  private async enviar(pendiente: Pendiente): Promise<void> {
    const id = pendiente.clientAttemptId
    if (this.enVuelo.has(id)) return
    this.enVuelo.add(id)
    if (this.estados.get(id)?.tipo !== 'sin-conexion') this.cambiar(id, { tipo: 'guardando' })
    const desenlace = await enviarPendiente(this.entorno.fetch, pendiente)
    this.enVuelo.delete(id)

    if (desenlace.tipo === 'reintentar') {
      const fallidos = (this.fallidos.get(id) ?? 0) + 1
      this.fallidos.set(id, fallidos)
      this.cambiar(id, { tipo: 'sin-conexion' })
      const temporizador = this.entorno.setTimeout(() => {
        this.temporizadores.delete(id)
        void this.enviar(pendiente)
      }, esperaParaIntento(fallidos))
      this.temporizadores.set(id, temporizador)
      return
    }

    // Guardado o error definitivo: ya no hay nada que reintentar.
    this.olvidar(id)
    this.cambiar(
      id,
      desenlace.tipo === 'guardado'
        ? { tipo: 'guardado', ...(desenlace.quizAttemptId ? { quizAttemptId: desenlace.quizAttemptId } : {}) }
        : { tipo: 'error', mensaje: desenlace.mensaje },
    )
  }

  private olvidar(id: string) {
    this.fallidos.delete(id)
    this.enMemoria.delete(id)
    try {
      this.entorno.almacen?.removeItem(claveDePendiente(this.viewerId, id))
    } catch {
      // Si no se puede borrar, el próximo reintento recibe el 200 idempotente.
    }
  }

  private cambiar(id: string, estado: EstadoDeGuardado) {
    this.estados.set(id, estado)
    for (const oyente of this.oyentes) oyente()
  }
}
