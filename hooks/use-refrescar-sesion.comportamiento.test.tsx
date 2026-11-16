// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRefrescarSesion } from './use-refrescar-sesion'

/**
 * E1 (16/11/2026). Los tests de use-refrescar-sesion.test.ts leen el código;
 * éstos lo ejecutan. Fijan las dos formas en que este arreglo ya falló, las dos
 * calladas:
 *
 *  1. `update()` sin argumento: Auth.js hace un GET y devuelve el token viejo.
 *  2. Guardar la `update` del primer render: nace con `loading: true` adentro y
 *     sale sin hacer nada.
 */
vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const useSessionMock = vi.mocked(useSession)

function sesionCon(update: (datos?: unknown) => Promise<null>) {
  useSessionMock.mockReturnValue({ data: null, status: 'authenticated', update } as never)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('useRefrescarSesion, ejecutado', () => {
  it('llama a update CON argumento: es lo que dispara el trigger en el servidor', async () => {
    const update = vi.fn(async () => null)
    sesionCon(update)

    const { result } = renderHook(() => useRefrescarSesion())
    await result.current()

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith({})
  })

  it('usa la update del ÚLTIMO render, no la del primero', async () => {
    // La del primer render es la que next-auth entrega mientras carga: no hace nada.
    const deLaCarga = vi.fn(async () => null)
    const laBuena = vi.fn(async () => null)

    sesionCon(deLaCarga)
    const { result, rerender } = renderHook(() => useRefrescarSesion())
    const refrescarAntes = result.current

    sesionCon(laBuena)
    rerender()
    await result.current()

    expect(laBuena).toHaveBeenCalledWith({})
    expect(deLaCarga).not.toHaveBeenCalled()
    // Y la función que se devuelve es la misma: se puede usar en un efecto
    // sin que lo vuelva a disparar.
    expect(result.current).toBe(refrescarAntes)
  })

  it('aun guardada desde el primer render, llama a la update vigente', async () => {
    const deLaCarga = vi.fn(async () => null)
    const laBuena = vi.fn(async () => null)

    sesionCon(deLaCarga)
    const { result, rerender } = renderHook(() => useRefrescarSesion())
    const guardada = result.current

    sesionCon(laBuena)
    rerender()
    await guardada()

    expect(laBuena).toHaveBeenCalledTimes(1)
    expect(deLaCarga).not.toHaveBeenCalled()
  })
})
