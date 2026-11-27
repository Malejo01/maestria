// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Bienvenida } from './bienvenida'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/hooks/use-refrescar-sesion', () => ({ useRefrescarSesion: () => async () => {} }))

const cuerpos: unknown[] = []
beforeEach(() => {
  cuerpos.length = 0
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.body) cuerpos.push(JSON.parse(String(init.body)))
    return new Response('{}', { status: 200 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Bienvenida · AC1, la modalidad del docente', () => {
  it('el docente sin modalidad elegida ve «¿Cómo das clases?» una vez y se guarda con el rol', async () => {
    localStorage.setItem('maestria-rol-elegido', 'docente')
    render(<Bienvenida />)
    expect(await screen.findByText('¿Cómo das clases?')).toBeTruthy()
    await userEvent.click(screen.getByRole('radio', { name: /Doy clases particulares/ }))
    await waitFor(() => expect(cuerpos).toContainEqual({ role: 'DOCENTE', modalidad: 'particular' }))
  })

  it('con la modalidad que trajo el link (portada o /profes), no pregunta', async () => {
    localStorage.setItem('maestria-rol-elegido', 'docente')
    localStorage.setItem('maestria-modalidad-elegida', 'curso')
    render(<Bienvenida />)
    await waitFor(() => expect(cuerpos).toContainEqual({ role: 'DOCENTE', modalidad: 'curso' }))
    expect(screen.queryByText('¿Cómo das clases?')).toBeNull()
    expect(localStorage.getItem('maestria-modalidad-elegida')).toBeNull()
  })
})
