// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TarjetaDeGrupo } from './tarjeta-de-grupo'

/**
 * M3. La tarjeta de *Mis grupos* abre la página del grupo con UN clic y con
 * Enter; Copiar link y Cerrar grupo hacen lo suyo sin abrirla.
 */
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))

const grupo = { id: 4, name: 'Matemática 1 Virtual', join_code: 'XYZ789', member_count: 25, assignment_count: 3 }

function dibujar(alCerrar = vi.fn()) {
  render(
    <ul>
      <TarjetaDeGrupo grupo={grupo} materia="Matemática · 1.º Sup." ocupado={false} alCerrar={alCerrar} />
    </ul>,
  )
  return { alCerrar }
}

beforeEach(() => {
  push.mockClear()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})
afterEach(cleanup)

describe('tarjeta de grupo', () => {
  it('un clic en cualquier parte de la tarjeta abre la página del grupo', async () => {
    dibujar()
    await userEvent.click(screen.getByText(/Código XYZ789/))
    expect(push).toHaveBeenCalledWith('/teacher/grupos/4')
  })

  it('con el teclado: Tab llega al nombre y Enter abre', async () => {
    dibujar()
    const enlace = screen.getByRole('link', { name: 'Abrir el grupo Matemática 1 Virtual' })
    expect(enlace.getAttribute('href')).toBe('/teacher/grupos/4')
    enlace.focus()
    await userEvent.keyboard('{Enter}')
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/teacher/grupos/4')
  })

  it('Copiar link copia y no navega', async () => {
    dibujar()
    await userEvent.click(screen.getByRole('button', { name: 'Copiar link del grupo Matemática 1 Virtual' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/aula/XYZ789'))
    expect(push).not.toHaveBeenCalled()
    expect(await screen.findByText('Copiado')).toBeTruthy()
  })

  it('Cerrar grupo cierra y no navega', async () => {
    const { alCerrar } = dibujar()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar grupo' }))
    expect(alCerrar).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
