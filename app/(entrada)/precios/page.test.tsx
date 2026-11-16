// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import PreciosPage, { generateMetadata } from './page'

/**
 * H5: la prueba y el gratis van arriba, aparte; la tabla tiene sólo los
 * niveles pagos; donde hay link de pago el monto es un botón.
 */
const VARIABLES = {
  MAESTRIA_PRECIO_MENSUAL_BLOQUE: '20000',
  MAESTRIA_PRECIO_MENSUAL_TOPE: '99000',
  MAESTRIA_PRECIO_PASE_BLOQUE: '50000',
  MAESTRIA_PRECIO_PASE_TOPE: '249000',
  MAESTRIA_LINK_PASE_1: 'https://mpago.la/pase-1',
}

beforeEach(() => {
  for (const [clave, valor] of Object.entries(VARIABLES)) vi.stubEnv(clave, valor)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('/precios', () => {
  it('la bajada nueva, con los números del plan', () => {
    render(<PreciosPage />)
    expect(
      screen.getByText('Empezás con 30 días gratis, con hasta 10 alumnos. Después seguís gratis con hasta 2, o elegís un plan.'),
    ).toBeTruthy()
    expect(generateMetadata().description).toMatch(/Después seguís gratis con hasta 2/)
  })

  it('gratis y prueba van arriba, como tarjetas propias', () => {
    render(<PreciosPage />)
    const arriba = screen.getByRole('list', { name: 'Sin pagar' })
    expect(within(arriba).getByText('Gratis')).toBeTruthy()
    expect(within(arriba).getByText('Hasta 2 alumnos, para siempre.')).toBeTruthy()
    expect(within(arriba).getByText('Prueba')).toBeTruthy()
    expect(within(arriba).getByText('30 días con hasta 10 alumnos, todo incluido. Sin tarjeta.')).toBeTruthy()
  })

  it('la tabla y las tarjetas de celular tienen sólo los niveles pagos', () => {
    render(<PreciosPage />)
    const tabla = screen.getByRole('table')
    expect(within(tabla).queryByText('Prueba')).toBeNull()
    expect(within(tabla).queryByText(/Gratis/)).toBeNull()
    expect(within(tabla).getAllByRole('row')).toHaveLength(1 + 5)
    const celular = screen.getByRole('list', { name: 'Planes' })
    expect(within(celular).getAllByRole('listitem')).toHaveLength(5)
    expect(within(celular).queryByText('Prueba')).toBeNull()
  })

  it('el pase de 1 bloque, que tiene link, es un botón al pago; el resto, texto', () => {
    render(<PreciosPage />)
    const links = screen.getAllByRole('link', { name: /Pagar el pase de 90 días de 1 bloque/ })
    // Uno en la tabla y otro en la tarjeta de celular.
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('href')).toBe('https://mpago.la/pase-1')
    expect(screen.queryAllByRole('link', { name: /Pagar un mes/ })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /de 2 bloques/ })).toHaveLength(0)
  })

  it('sin links cargados no aparece ningún botón de pago', () => {
    vi.stubEnv('MAESTRIA_LINK_PASE_1', '')
    render(<PreciosPage />)
    expect(screen.queryAllByRole('link', { name: /^Pagar/ })).toHaveLength(0)
  })

  it('la letra chica dice que los gratis no se suman a un plan', () => {
    render(<PreciosPage />)
    expect(screen.getByText('Los 2 alumnos gratis no se suman a un plan: 1 bloque son 5 alumnos en total.')).toBeTruthy()
  })
})
