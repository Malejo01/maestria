// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import PreciosPage, { generateMetadata } from './page'

const { getViewer, resumenDelPlan } = vi.hoisted(() => ({ getViewer: vi.fn(), resumenDelPlan: vi.fn() }))
vi.mock('@/lib/auth-session', () => ({ getViewer }))
vi.mock('@/lib/planes-server', () => ({ resumenDelPlan }))

/** B3: la página es asíncrona. AB3: el Particular está siempre adelante. */
const particular = async () => render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'particular' }) }))
const sinParametros = async () => render(await PreciosPage({ searchParams: Promise.resolve({}) }))
const desplegarOtros = () => fireEvent.click(screen.getByRole('button', { name: /¿Sos escuela, instituto o estudiás por tu cuenta\?/ }))

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

describe('/precios · AB3: una sola oferta adelante', () => {
  it('arriba, sólo el plan Particular: gratis con 2 para siempre y el bloque de 5 por mes', async () => {
    await sinParametros()
    const oferta = screen.getByRole('region', { name: /Plan Particular/ })
    expect(within(oferta).getByText('Gratis con 2 alumnos, para siempre')).toBeTruthy()
    expect(within(oferta).getByText('Bloque de 5 alumnos')).toBeTruthy()
    expect(within(oferta).getByText(/20\.000/)).toBeTruthy()
    expect(generateMetadata().description).toMatch(/Gratis con 2 alumnos, para siempre\. Bloque de 5 alumnos: \$\s?20\.000 por mes\./)
  })

  it('el pase de 90 días es la segunda opción, más chica, y no cambia sus 90 días', async () => {
    await sinParametros()
    const pase = document.querySelector('[data-pase]')
    expect(pase?.textContent).toMatch(/O un pase de 90 días: \$\s?50\.000/)
    expect(pase?.className).toMatch(/cuerpo-s/)
  })

  it('debajo del precio, la garantía y lo de marzo', async () => {
    await sinParametros()
    expect(screen.getByText('Si en 14 días ninguno de tus alumnos practicó, te devuelvo el pago.')).toBeTruthy()
    expect(screen.getByText('No hay débito automático: si no renovás, tus fichas quedan guardadas y volvés cuando quieras.')).toBeTruthy()
  })

  it('Aula, Institución y Autodidacta no están en el primer render y aparecen al desplegar', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO', '15000')
    vi.stubEnv('MAESTRIA_PRECIO_PASE_ALUMNO', '9000')
    await sinParametros()
    expect(screen.queryByText('Plan Aula')).toBeNull()
    expect(screen.queryByText('Institución')).toBeNull()
    expect(screen.queryByText('Me preparo solo para un examen')).toBeNull()
    desplegarOtros()
    expect(screen.getByText('Plan Aula')).toBeTruthy()
    expect(screen.getByText('Institución')).toBeTruthy()
    expect(screen.getByText('Me preparo solo para un examen')).toBeTruthy()
    expect(screen.getByText(/Pase por materia: \$\s?9\.000/)).toBeTruthy()
  })

  it('sin la prueba: ni «Prueba» ni «30 días» a la vista en el primer render', async () => {
    const { container } = await sinParametros()
    const visible = [...container.querySelectorAll('[data-oferta-particular], header')].map((n) => n.textContent).join(' ')
    expect(visible).not.toMatch(/30 días/)
    expect(visible).not.toMatch(/Prueba/)
    expect(screen.getByRole('link', { name: 'Empezar gratis' }).getAttribute('href')).toBe('/sign-in?rol=docente')
  })

  it('sin precio cargado, la oferta no inventa un número', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_MENSUAL_BLOQUE', '')
    vi.stubEnv('MAESTRIA_PRECIO_PASE_BLOQUE', '')
    await sinParametros()
    const oferta = screen.getByRole('region', { name: /Plan Particular/ })
    expect(within(oferta).getByText('Precio a confirmar')).toBeTruthy()
    expect(oferta.querySelector('[data-pase]')).toBeNull()
  })
})

describe('/precios', () => {
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
    // AB3: uno en la oferta de arriba, uno en la tabla y otro en la tarjeta de celular.
    expect(links).toHaveLength(3)
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

describe('/precios · B3: el camino Aula, ahora detrás del botón', () => {
  it('?camino=aula lo abre de entrada: el curso, el adicional y la Institución, con precios de las variables', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO', '15000')
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO_ADICIONAL', '10000')
    vi.stubEnv('MAESTRIA_WHATSAPP_CONTACTO', '+54 9 11 1234 5678')
    render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'aula' }) }))
    expect(screen.getByText('Un curso de hasta 35 alumnos')).toBeTruthy()
    expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/10\.000/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Hablemos/ }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5491112345678\?text=/)
  })

  it('camino Particular: el pase se llama "Pase temporada de mesas", con el costo por alumno por mes', async () => {
    await particular()
    expect(screen.getByRole('heading', { name: 'Pase temporada de mesas' })).toBeTruthy()
    expect(screen.getByText(/por alumno por mes/)).toBeTruthy()
  })

  it('el porqué, plegado, junto al Aula', async () => {
    render(await PreciosPage({ searchParams: Promise.resolve({ camino: 'aula' }) }))
    expect(screen.getByText('¿Por qué un curso sale menos que 5 alumnos particulares?')).toBeTruthy()
  })

  it('con sesión de docente Aula, los otros planes arrancan abiertos y marcan "Tu plan"', async () => {
    vi.stubEnv('MAESTRIA_PRECIO_AULA_CURSO', '15000')
    getViewer.mockResolvedValue({ id: 'd', role: 'DOCENTE', isGuest: false, email: 'd@x' })
    resumenDelPlan.mockResolvedValue({ estado: 'activo', tipo: 'aula' })
    render(await PreciosPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole('button', { name: /Ocultar los otros planes/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Tu plan')).toBeTruthy()
  })

  it('con sesión de docente Particular activo, «Tu plan» va en la oferta', async () => {
    getViewer.mockResolvedValue({ id: 'd', role: 'DOCENTE', isGuest: false, email: 'd@x' })
    resumenDelPlan.mockResolvedValue({ estado: 'activo', tipo: 'particular' })
    await sinParametros()
    expect(within(screen.getByRole('region', { name: /Plan Particular/ })).getByText('Tu plan')).toBeTruthy()
  })
})

describe('/precios · C2: con Checkout Pro, todos los montos llevan al resumen del pago', () => {
  it('con MERCADOPAGO_ACCESS_TOKEN, también los que no tienen link fijo', async () => {
    vi.stubEnv('MERCADOPAGO_ACCESS_TOKEN', 'TEST-token')
    await particular()
    expect(screen.getAllByRole('link', { name: /Pagar un mes de 2 bloques/ })[0].getAttribute('href')).toBe('/precios/pagar?plan=particular&forma=mensual&cantidad=2')
  })
})
