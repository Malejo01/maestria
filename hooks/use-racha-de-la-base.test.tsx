// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { olvidarRachaLeida, useRachaDeLaBase } from './use-racha-de-la-base'
import { EVENTO_RACHA } from '@/lib/guardado-pendiente'
import { useAppStore } from '@/lib/store'

/** O4. La racha del navegador pasa a la base una vez; después manda la base. */
const pedidos: { url: string; init?: RequestInit }[] = []
let enLaBase: number | null = null

beforeEach(() => {
  pedidos.length = 0
  olvidarRachaLeida()
  useAppStore.setState((s) => ({ userProgress: { ...s.userProgress, streak: 3 } }))
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init })
    if (init?.method === 'POST') {
      const { delNavegador } = JSON.parse(String(init.body))
      enLaBase = enLaBase ?? delNavegador
    }
    return new Response(JSON.stringify({ racha: enLaBase }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useRachaDeLaBase', () => {
  it('sin racha en la base, la del navegador pasa una vez', async () => {
    enLaBase = null
    renderHook(() => useRachaDeLaBase())
    await waitFor(() => expect(pedidos.filter((p) => p.init?.method === 'POST')).toHaveLength(1))
    expect(JSON.parse(String(pedidos[1].init?.body))).toEqual({ delNavegador: 3 })
    expect(useAppStore.getState().userProgress.streak).toBe(3)
  })

  it('con racha en la base, manda la base y no se migra nada', async () => {
    enLaBase = 7
    renderHook(() => useRachaDeLaBase())
    await waitFor(() => expect(useAppStore.getState().userProgress.streak).toBe(7))
    expect(pedidos.some((p) => p.init?.method === 'POST')).toBe(false)
  })

  it('se lee una sola vez por pestaña', async () => {
    enLaBase = 2
    const a = renderHook(() => useRachaDeLaBase())
    await waitFor(() => expect(pedidos).toHaveLength(1))
    a.unmount()
    renderHook(() => useRachaDeLaBase())
    await new Promise((r) => setTimeout(r, 20))
    expect(pedidos).toHaveLength(1)
  })

  it('la racha que devuelve el servidor al guardar manda sobre la del navegador', async () => {
    enLaBase = 2
    renderHook(() => useRachaDeLaBase())
    await waitFor(() => expect(useAppStore.getState().userProgress.streak).toBe(2))
    act(() => {
      window.dispatchEvent(new CustomEvent(EVENTO_RACHA, { detail: 0 }))
    })
    expect(useAppStore.getState().userProgress.streak).toBe(0)
  })
})
