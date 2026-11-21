// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePendientesDeGuardado } from './use-pendientes-de-guardado'
import { claveDePendiente, esperaParaIntento, type Entorno } from '@/lib/guardado-pendiente'

/**
 * M1. El resultado terminado sin conexión no se pierde: queda en el almacén,
 * se reintenta a los 2 y 5 segundos (y después 15, 30, 60…), y se borra recién
 * con el 200. Siempre con el mismo `clientAttemptId`.
 */

vi.mock('./use-viewer-id', () => ({ useViewerId: () => null }))

function almacenDePrueba() {
  const datos = new Map<string, string>()
  return {
    datos,
    get length() {
      return datos.size
    },
    key: (i: number) => [...datos.keys()][i] ?? null,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  }
}

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
}

let viewer = 0
function nuevoViewer() {
  viewer += 1
  return `u-prueba-${viewer}`
}

function entornoCon(fetchMock: ReturnType<typeof vi.fn>, almacen = almacenDePrueba()): Entorno & { almacen: ReturnType<typeof almacenDePrueba> } {
  return {
    almacen,
    fetch: fetchMock as unknown as typeof fetch,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
    ahora: () => new Date('2026-11-21T15:00:00.000Z'),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('esperaParaIntento', () => {
  it('2, 5, 15 y 30 segundos, y después cada 60', () => {
    expect([1, 2, 3, 4, 5, 9].map(esperaParaIntento)).toEqual([2000, 5000, 15000, 30000, 60000, 60000])
  })
})

describe('usePendientesDeGuardado', () => {
  it('con fetch que falla dos veces y después anda: guarda una vez y borra el pendiente', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respuesta(503, { error: 'caído' }))
      .mockResolvedValueOnce(respuesta(200, { success: true, quizAttemptId: 77 }))
    const entorno = entornoCon(fetchMock)
    const viewerId = nuevoViewer()

    const { result } = renderHook(() => usePendientesDeGuardado({ viewerId, entorno }))
    const cola = result.current.cola!

    await act(async () => {
      cola.encolar('id-del-intento-1', { score: 8, answers: [] })
    })
    expect(entorno.almacen.datos.has(claveDePendiente(viewerId, 'id-del-intento-1'))).toBe(true)
    expect(cola.estado('id-del-intento-1')).toEqual({ tipo: 'sin-conexion' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(cola.estado('id-del-intento-1')).toEqual({ tipo: 'sin-conexion' })
    expect(entorno.almacen.datos.size).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(cola.estado('id-del-intento-1')).toEqual({ tipo: 'guardado', quizAttemptId: 77 })
    expect(entorno.almacen.datos.size).toBe(0)

    // Los tres envíos con el mismo id: el servidor no crea dos intentos.
    const ids = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).clientAttemptId)
    expect(ids).toEqual(['id-del-intento-1', 'id-del-intento-1', 'id-del-intento-1'])

    // Y no hay más reintentos programados.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('un 4xx no se reintenta: se muestra el error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(403, { error: 'Esta tarea ya venció.' }))
    const entorno = entornoCon(fetchMock)
    const viewerId = nuevoViewer()
    const { result } = renderHook(() => usePendientesDeGuardado({ viewerId, entorno }))

    await act(async () => {
      result.current.cola!.encolar('id-del-intento-2', { score: 5 })
    })
    expect(result.current.cola!.estado('id-del-intento-2')).toEqual({ tipo: 'error', mensaje: 'Esta tarea ya venció.' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(entorno.almacen.datos.size).toBe(0)
  })

  it('al cargar, reintenta lo que quedó de otra vez', async () => {
    const viewerId = nuevoViewer()
    const almacen = almacenDePrueba()
    almacen.setItem(
      claveDePendiente(viewerId, 'id-viejo'),
      JSON.stringify({ clientAttemptId: 'id-viejo', cuerpo: { score: 9, clientAttemptId: 'id-viejo' }, creadoEl: '2026-11-20T10:00:00.000Z' }),
    )
    // Uno de otra persona en el mismo dispositivo: no se toca.
    almacen.setItem(claveDePendiente('otra-persona', 'id-ajeno'), JSON.stringify({ clientAttemptId: 'id-ajeno', cuerpo: {}, creadoEl: '' }))
    const fetchMock = vi.fn().mockResolvedValue(respuesta(200, { success: true, quizAttemptId: 5, duplicado: true }))

    const entorno = entornoCon(fetchMock, almacen)
    await act(async () => {
      renderHook(() => usePendientesDeGuardado({ viewerId, entorno }))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(almacen.datos.has(claveDePendiente(viewerId, 'id-viejo'))).toBe(false)
    expect(almacen.datos.has(claveDePendiente('otra-persona', 'id-ajeno'))).toBe(true)
  })

  it('al volver la conexión reintenta sin esperar', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respuesta(200, { success: true, quizAttemptId: 8 }))
    const viewerId = nuevoViewer()
    const entorno = entornoCon(fetchMock)
    const { result } = renderHook(() => usePendientesDeGuardado({ viewerId, entorno }))

    await act(async () => {
      result.current.cola!.encolar('id-del-intento-3', {})
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.cola!.estado('id-del-intento-3')).toEqual({ tipo: 'guardado', quizAttemptId: 8 })
  })
})
