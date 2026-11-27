// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { params } = vi.hoisted(() => ({ params: { valor: new URLSearchParams() } }))
vi.mock('next/navigation', () => ({ useSearchParams: () => params.valor }))

import ProfesPage, { metadata } from './page'

beforeEach(() => {
  params.valor = new URLSearchParams()
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('/profes (AA3 + AB2)', () => {
  it('título, bajada y los tres puntos de la oferta v3', () => {
    render(<ProfesPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Empezá gratis con 2 alumnos.' })).toBeTruthy()
    expect(screen.getByText('Nada le llega a tu alumno sin tu OK.')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText(/te lo cargo yo en una videollamada de 15 minutos/)).toBeTruthy()
    expect(screen.getByText(/la aprobás en un clic/)).toBeTruthy()
    expect(screen.getByText(/Cada lunes ves quién practicó/)).toBeTruthy()
  })

  it('el botón «Empezar gratis con 2 alumnos» conserva origen y ref', () => {
    params.valor = new URLSearchParams('origen=meta&ref=AD-prueba')
    render(<ProfesPage />)
    const href = screen.getByRole('link', { name: 'Empezar gratis con 2 alumnos' }).getAttribute('href') ?? ''
    const p = new URL(href, 'https://x.test')
    expect(p.pathname).toBe('/sign-in')
    expect(p.searchParams.get('rol')).toBe('docente')
    expect(p.searchParams.get('callbackUrl')).toBe('/teacher')
    expect(p.searchParams.get('origen')).toBe('meta')
    expect(p.searchParams.get('ref')).toBe('AD-PRUEBA')
  })

  it('AB2 · el copy no dice «30 días», «revisando» ni «IA que corrige todo»', () => {
    const { container } = render(<ProfesPage />)
    const texto = `${container.textContent} ${metadata.description}`
    expect(texto).not.toMatch(/30 días/i)
    expect(texto).not.toMatch(/revisando/i)
    expect(texto).not.toMatch(/ahorrá horas/i)
    expect(texto).not.toMatch(/corrige todo/i)
  })

  it('el ancla de precio, con el monto del bloque si está la variable', () => {
    vi.stubEnv('MAESTRIA_PRECIO_MENSUAL_BLOQUE', '15000')
    render(<ProfesPage />)
    expect(screen.getByText(/¿Más de 2 alumnos\? \$\s?15\.000 por mes, para 5\. Menos que una clase\./)).toBeTruthy()
  })

  it('sin la variable de precio, el ancla no muestra ningún número de pesos', () => {
    vi.stubEnv('MAESTRIA_PRECIO_MENSUAL_BLOQUE', '')
    const { container } = render(<ProfesPage />)
    const ancla = container.querySelector('[data-ancla]')?.textContent ?? ''
    expect(ancla).toBe('¿Más de 2 alumnos? Menos que una clase por mes, para 5.')
    expect(ancla).not.toMatch(/\$/)
  })

  it('«Prefiero que me lo cargues vos» va al WhatsApp de Mauro con el mensaje; sin el número, no aparece', () => {
    vi.stubEnv('MAESTRIA_WHATSAPP_CONTACTO', '+54 9 11 1234 5678')
    render(<ProfesPage />)
    const link = screen.getByRole('link', { name: /Prefiero que me lo cargues vos/ }).getAttribute('href') ?? ''
    expect(link).toMatch(/^https:\/\/wa\.me\/5491112345678\?text=/)
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Hola Mauro, quiero que me ayudes a cargar mi programa en MaestrIA')
    cleanup()
    vi.stubEnv('MAESTRIA_WHATSAPP_CONTACTO', '')
    render(<ProfesPage />)
    expect(screen.queryByRole('link', { name: /Prefiero que me lo cargues vos/ })).toBeNull()
  })

  it('sin public/profes/reel.mp4, la captura en lugar del video; y el link a precios', () => {
    const { container } = render(<ProfesPage />)
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('img', { name: /La ficha de un alumno/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Ver precios' }).getAttribute('href')).toBe('/precios')
  })
})
