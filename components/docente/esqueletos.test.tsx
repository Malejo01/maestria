// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { EsqueletoPanel } from './esqueletos'
import { MisAlumnos } from './mis-alumnos'

/**
 * A4 (16/11/2026): el panel del docente quedaba en blanco unos cinco segundos.
 * Para quien entra por primera vez, eso es la app rota.
 *
 * Lo que se fija acá es que "todavía no sé" siempre tenga algo dibujado, y que
 * ese algo se anuncie: un esqueleto que sólo se ve deja afuera a quien usa
 * lector de pantalla.
 */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('EsqueletoPanel', () => {
  it.each([
    ['alumnos', 'Cargando tus alumnos…', 'Mis alumnos'],
    ['tareas', 'Cargando tus tareas…', 'Mis tareas'],
  ] as const)('%s: se anuncia y ya trae el título de verdad', (seccion, anuncio, titulo) => {
    render(<EsqueletoPanel seccion={seccion} />)

    const zonas = screen.getAllByRole('status')
    expect(zonas.length).toBeGreaterThan(0)
    for (const zona of zonas) {
      expect(zona.getAttribute('aria-busy')).toBe('true')
      expect(zona.textContent).toContain(anuncio)
    }
    // El título es el real: cuando llegan los datos no se mueve.
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(titulo)
  })

  it('materias: se anuncia', () => {
    render(<EsqueletoPanel seccion="materias" />)
    expect(screen.getAllByRole('status')[0].textContent).toContain('Cargando tus materias…')
  })

  it('los bloques grises son decorativos: no le llegan al lector de pantalla', () => {
    const { container } = render(<EsqueletoPanel seccion="alumnos" />)
    const bloques = container.querySelectorAll('[role="status"] span:not(.sr-only)')
    expect(bloques.length).toBeGreaterThan(5)
    for (const bloque of bloques) {
      if (bloque.children.length === 0) expect(bloque.getAttribute('aria-hidden')).toBe('true')
    }
  })
})

describe('MisAlumnos mientras el servidor no respondió', () => {
  beforeEach(() => {
    // Un pedido que no termina nunca: el peor caso de "todavía no sé".
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  })

  it('no hay ningún instante de pantalla vacía', () => {
    const { container } = render(
      <MisAlumnos agregarAbierto={false} onAgregarCambia={() => {}} onArmarTarea={() => {}} />,
    )

    expect(container.firstChild).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Cargando tus alumnos…')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mis alumnos')
  })
})
