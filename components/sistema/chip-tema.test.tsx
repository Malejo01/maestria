// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ChipTema } from './chip-tema'

afterEach(cleanup)

describe('ChipTema · el texto para lectores de pantalla (K7)', () => {
  it('por defecto anuncia el estado del tema, como en la planilla', () => {
    const { container } = render(<ChipTema tema="Fracciones" estado="dominado" />)
    expect(container.textContent).toBe('Fracciones: Dominado')
  })

  it('el anuncio es una prop', () => {
    const { container } = render(<ChipTema tema="Fracciones" estado="flojo" anuncio="Le cuesta" />)
    expect(container.textContent).toBe('Fracciones: Le cuesta')
  })

  it('con anuncio={null} anuncia sólo lo que muestra', () => {
    const { container } = render(<ChipTema tema="Acertó" estado="dominado" anuncio={null} />)
    expect(container.textContent).toBe('Acertó')
    expect(container.querySelector('.sr-only')).toBeNull()
  })
})
