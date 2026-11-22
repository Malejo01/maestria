// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvisoDeReporte, olvidarAvisosDeReporte } from './aviso-de-reporte'
import { useAppStore } from '@/lib/store'

/**
 * N1. El aviso a quien reportó: se pide una vez por pestaña, no aparece en
 * medio de un cuestionario, y "Entendido" lo guarda y lo cierra.
 */
const pedidos: { url: string; init?: RequestInit }[] = []
let avisos: unknown[] = []

beforeEach(() => {
  pedidos.length = 0
  avisos = [
    { id: 6, reportadoEl: '2026-11-20T18:40:00.000Z', cuestionario: 'Matemática - Mixto - 20/11/2026', respuesta: 'Cambié la pregunta.', respondidoPor: 'Mauro' },
  ]
  olvidarAvisosDeReporte()
  window.sessionStorage.clear()
  useAppStore.setState({ activeView: 'dashboard' })
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init })
    const cuerpo = url.endsWith('/visto') ? { marcados: 1 } : { avisos }
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AvisoDeReporte', () => {
  it('muestra el aviso con el mensaje del admin', async () => {
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    expect(await screen.findByText(/Lo que reportaste el 20\/11 sobre una pregunta de «Matemática - Mixto - 20\/11\/2026» ya está corregido/)).toBeTruthy()
    expect(screen.getByText('Mauro te dejó un mensaje: Cambié la pregunta.')).toBeTruthy()
  })

  it('se pide una sola vez por pestaña, aunque se navegue', async () => {
    const { unmount } = render(<AvisoDeReporte quien="invitado:Clarita" />)
    await screen.findByText(/ya está corregido/)
    unmount()
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    await screen.findByText(/ya está corregido/)
    expect(pedidos.filter((p) => p.url === '/api/feedback/avisos')).toHaveLength(1)
  })

  it('no aparece en medio de un cuestionario; sí al terminarlo', async () => {
    useAppStore.setState({ activeView: 'quiz' })
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    await waitFor(() => expect(pedidos).toHaveLength(1))
    expect(screen.queryByText(/ya está corregido/)).toBeNull()
    act(() => useAppStore.setState({ activeView: 'results' }))
    expect(await screen.findByText(/ya está corregido/)).toBeTruthy()
  })

  it('"Entendido" guarda el visto con los ids y no vuelve a aparecer', async () => {
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }))
    const visto = pedidos.find((p) => p.url === '/api/feedback/avisos/visto')
    expect(JSON.parse(String(visto?.init?.body))).toEqual({ ids: [6] })
    await waitFor(() => expect(screen.queryByText(/ya está corregido/)).toBeNull())
    cleanup()
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    expect(screen.queryByText(/ya está corregido/)).toBeNull()
  })

  it('P3: se guarda como visto apenas se muestra, sin esperar "Entendido" (sólo la primera vez)', async () => {
    useAppStore.setState({ activeView: 'quiz' })
    render(<AvisoDeReporte quien="invitado:Clarita" />)
    await waitFor(() => expect(pedidos).toHaveLength(1))
    // En el cuestionario no se ve, así que todavía no cuenta como visto.
    expect(pedidos.some((p) => p.url === '/api/feedback/avisos/visto')).toBe(false)
    act(() => useAppStore.setState({ activeView: 'results' }))
    await screen.findByText(/ya está corregido/)
    await waitFor(() => expect(pedidos.filter((p) => p.url === '/api/feedback/avisos/visto')).toHaveLength(1))
    expect(JSON.parse(String(pedidos.find((p) => p.url === '/api/feedback/avisos/visto')?.init?.body))).toEqual({ ids: [6] })
  })

  it('sin avisos no dibuja nada', async () => {
    avisos = []
    const { container } = render(<AvisoDeReporte quien="ana@x" />)
    await waitFor(() => expect(pedidos).toHaveLength(1))
    expect(container.textContent).toBe('')
  })
})
