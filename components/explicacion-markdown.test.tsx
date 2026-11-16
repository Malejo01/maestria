// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ExplicacionMarkdown } from './explicacion-markdown'

afterEach(cleanup)

/**
 * Lo que ve el alumno. El parser tiene sus tests aparte; acá se fija que el
 * árbol llegue al DOM como elementos de verdad y que KaTeX siga dibujando las
 * fórmulas.
 */
describe('ExplicacionMarkdown', () => {
  const explicacion = [
    '## 1. ¿Por qué elegiste esta opción?',
    'Es **muy común** confundirse acá.',
    '',
    '- Primero restá.',
    '- Después dividí.',
    '',
    'La cuenta es $\\frac{6}{2} = 3$ y usás `Math.sqrt`.',
  ].join('\n')

  it('encabezado, negrita, lista, código y fórmula llegan formateados', () => {
    const { container } = render(<ExplicacionMarkdown content={explicacion} />)

    expect(container.querySelector('h3')?.textContent).toBe('1. ¿Por qué elegiste esta opción?')
    expect(container.querySelector('strong')?.textContent).toBe('muy común')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelector('code')?.textContent).toBe('Math.sqrt')
    expect(container.querySelector('.katex')).not.toBeNull()
  })

  it('no queda ningún ## ni ** a la vista', () => {
    const { container } = render(<ExplicacionMarkdown content={explicacion} />)
    expect(container.textContent).not.toMatch(/##|\*\*/)
  })

  it('"$texto entre signos de pesos$" sigue sin dibujarse como fórmula', () => {
    // Regla que ya tenía LaTeXRenderer: tres palabras o más no son matemática.
    const { container } = render(<ExplicacionMarkdown content="Dijo $esto no es una formula$ y siguió." />)
    expect(container.querySelector('.katex')).toBeNull()
    expect(container.textContent).toContain('esto no es una formula')
  })
})
