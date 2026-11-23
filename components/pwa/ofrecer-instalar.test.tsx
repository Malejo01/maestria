// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { OfrecerInstalar } from './ofrecer-instalar'
import { escucharInstalacion } from '@/lib/instalar-cliente'

/** Ronda X · X4 — "Instalá MaestrIA": una vez, después de la segunda práctica, si el navegador lo permite. */
describe('OfrecerInstalar', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', { value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }), configurable: true })
  })
  afterEach(cleanup)

  it('sin el aviso del navegador no ofrece nada, aunque haya practicado', () => {
    localStorage.clear()
    render(<OfrecerInstalar intento="a" />)
    cleanup()
    render(<OfrecerInstalar intento="b" />)
    expect(screen.queryByText('Instalá MaestrIA')).toBeNull()
  })

  it('con el aviso: no en la primera, sí en la segunda, y nunca más', () => {
    localStorage.clear()
    escucharInstalacion()
    act(() => {
      const evento = Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })
      window.dispatchEvent(evento)
    })
    render(<OfrecerInstalar intento="1" />)
    expect(screen.queryByText('Instalá MaestrIA')).toBeNull()
    cleanup()
    // El mismo intento dos veces (StrictMode, volver a la pantalla) cuenta una sola.
    render(<OfrecerInstalar intento="1" />)
    expect(screen.queryByText('Instalá MaestrIA')).toBeNull()
    cleanup()
    render(<OfrecerInstalar intento="2" />)
    expect(screen.getByText('Instalá MaestrIA')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Instalar' })).toBeTruthy()
    cleanup()
    render(<OfrecerInstalar intento="3" />)
    expect(screen.queryByText('Instalá MaestrIA')).toBeNull()
  })
})
