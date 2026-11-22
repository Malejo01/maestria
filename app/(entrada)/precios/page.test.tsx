// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import PreciosPage, { generateMetadata } from './page'

const { getViewer, resumenDelPlan } = vi.hoisted(() => ({ getViewer: vi.fn(), resumenDelPlan: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({ getViewer }))
vi.mock('@/lib/planes-server', () => ({ resumenDelPlan }))

/** B3: la página es asíncrona y tiene dos caminos; estos tests miran el Particular. */
const particular = async () => render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'particular' }) }))

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
  getViewer.mockResolvedValue(null)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('/precios', () => {
  it('la bajada nueva, con los números del plan', async () => {
    await particular()
    expect(
      screen.getByText('Empezás con 30 días gratis, con hasta 10 alumnos. Después seguís gratis con hasta 2 alumnos particulares y un curso, o elegís un plan.'),
    ).toBeTruthy()
    expect(generateMetadata().description).toMatch(/Después seguís gratis con hasta 2 alumnos particulares y un curso/)
  })

  it('gratis y prueba van arriba, como tarjetas propias', async () => {
    await particular()
    const arriba = screen.getByRole('list', { name: 'Sin pagar' })
    expect(within(arriba).getByText('Gratis')).toBeTruthy()
    expect(within(arriba).getByText('Hasta 2 alumnos particulares y 1 curso de hasta 35, para siempre.')).toBeTruthy()
    expect(within(arriba).getByText('Prueba')).toBeTruthy()
    expect(within(arriba).getByText('30 días con hasta 10 alumnos, todo incluido. Sin tarjeta.')).toBeTruthy()
  })

  it('la tabla y las tarjetas de celular tienen sólo los niveles pagos', async () => {
    await particular()
    const tabla = screen.getByRole('table')
    expect(within(tabla).queryByText('Prueba')).toBeNull()
    expect(within(tabla).queryByText(/Gratis/)).toBeNull()
    expect(within(tabla).getAllByRole('row')).toHaveLength(1 + 5)
    const celular = screen.getByRole('list', { name: 'Planes' })
    expect(within(celular).getAllByRole('listitem')).toHaveLength(5)
    expect(within(celular).queryByText('Prueba')).toBeNull()
  })

  it('el pase de 1 bloque, que tiene link, es un botón al pago; el resto, texto', async () => {
    await particular()
    const links = screen.getAllByRole('link', { name: /Pagar el pase de 90 días de 1 bloque/ })
    // Uno en la tabla y otro en la tarjeta de celular.
    expect(links).toHaveLength(2)
    // C2: lleva al resumen del pago (con el código); ahí está el link fijo si no hay Checkout Pro.
    for (const link of links) expect(link.getAttribute('href')).toBe('/precios/pagar?plan=particular&forma=pase&cantidad=1')
    expect(screen.queryAllByRole('link', { name: /Pagar un mes/ })).toHaveLength(0)
    expect(screen.queryAllByRole('link', { name: /de 2 bloques/ })).toHaveLength(0)
  })

  it('sin links cargados no aparece ningún botón de pago', async () => {
    vi.stubEnv('MAESTRIA_LINK_PASE_1', '')
    await particular()
    expect(screen.queryAllByRole('link', { name: /^Pagar/ })).toHaveLength(0)
  })

  it('la letra chica dice que los gratis no se suman a un plan', async () => {
    await particular()
    expect(screen.getByText('Los 2 alumnos gratis no se suman a un plan: 1 bloque son 5 alumnos en total.')).toBeTruthy()
  })
})

describe('/precios · B3: dos caminos', () => {
  it('sin elegir: la pregunta y los dos botones, sin planes todavía', async () => {
    render(await PreciosPage({ searchParams: Promise.resolve({}) }))
    const nav = screen.getByRole('navigation', { name: '¿Cómo das clases?' })
    expect(within(nav).getByRole('link', { name: /Clases particulares/ }).getAttribute('href')).toBe('/precios?camino=particular')
    expect(within(nav).getByRole('link', { name: /Cursos en un instituto o escuela/ }).getAttribute('href')).toBe('/precios?camino=aula')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('camino Aula: el curso, el adicional y la Institución, con precios de las variables', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO', '15000')
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL', '10000')
    vi.stubEnv('MAESTRIA_WHATSAPP_CONTACTO', '+54 9 11 1234 5678')
    render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'aula' }) }))
    expect(screen.getByText('Un curso de hasta 35 alumnos')).toBeTruthy()
    expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/10\.000/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Hablemos/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5491112345678\?text=/)
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('camino Particular: el pase se llama "Pase temporada de mesas", con el costo por alumno por mes', async () => {
    await particular()
    expect(screen.getByRole('heading', { name: 'Pase temporada de mesas' })).toBeTruthy()
    expect(screen.getByText(/por alumno por mes/)).toBeTruthy()
  })

  it('el porqué, plegado, en los dos caminos', async () => {
    render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'aula' }) }))
    expect(screen.getByText('¿Por qué un curso sale menos que 5 alumnos particulares?')).toBeTruthy()
  })

  it('con sesión de docente Aula, arranca en Aula y marca "Tu plan"', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO', '15000')
    getViewer.mockResolvedValue({ id: 'd', role: 'DOCENTE', isGuest: false, email: 'd@x' })
    resumenDelPlan.mockResolvedValue({ estado: 'activo', tipo: 'aula' })
    render(await PreciosPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('link', { name: /Cursos en un instituto/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('Tu plan')).toBeTruthy()
  })
})

describe('/precios · C2: con Checkout Pro, todos los montos llevan al resumen del pago', () => {
  it('con MERCADOPAGO_ACCESS_TOKEN, también los que no tienen link fijo', async () => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token')
    await particular()
    expect(screen.getAllByRole('link', { name: /Pagar un mes de 2 bloques/ })[0].getAttribute('href')).toBe('/precios/pagar?plan=particular&forma=mensual&cantidad=2')
  })
})
