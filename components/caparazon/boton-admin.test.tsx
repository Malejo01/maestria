// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BotonAdmin } from './boton-admin'

afterEach(cleanup)

describe('P1 · botón Admin de la barra', () => {
  it('no se pinta sin admin', () => {
    const { container } = render(<BotonAdmin esAdmin={false} />)
    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('link', { name: 'Panel de administrador' })).toBeNull()
  })

  it('con admin, lleva a /admin', () => {
    render(<BotonAdmin esAdmin />)
    expect(screen.getByRole('link', { name: 'Panel de administrador' }).getAttribute('href')).toBe('/admin')
  })
})
