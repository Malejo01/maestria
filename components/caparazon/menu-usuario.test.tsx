// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useSession } from 'next-auth/react'
import { MenuUsuario } from './menu-usuario'

/**
 * E1 (16/11/2026): cambiar el rol desde el menú de la cuenta se tiene que
 * reflejar sin cerrar sesión.
 *
 * El rol viaja cacheado en el JWT, y el proxy decide con el del token quién
 * entra a /teacher. Si después de guardar el rol en la base no se pide el
 * refresco, la persona queda con una cuenta de docente y un token de alumno:
 * el proxy la rebota. Lo que se fija acá es el ORDEN — guardar, refrescar la
 * sesión, y recién entonces irse — y que un guardado fallido no refresque nada.
 */
vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const update = vi.fn(async () => null)
const fetchMock = vi.fn()
/** En qué orden pasaron las cosas. */
let pasos: string[] = []

beforeAll(() => {
  // Lo que Radix le pide al navegador y jsdom no trae.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  pasos = []
  update.mockImplementation(async () => {
    pasos.push('refrescar la sesión')
    return null
  })
  useSessionMock.mockReturnValue({ data: null, status: 'authenticated', update } as never)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

async function pedirElCambio() {
  const usuario = userEvent.setup()
  render(<MenuUsuario nombre="Karina Álvarez" email={null} rol="ALUMNO" vistaPrevia={false} />)
  await usuario.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }))
  await usuario.click(await screen.findByRole('menuitem', { name: 'Cambiar mi cuenta a docente' }))
  await usuario.click(await screen.findByRole('button', { name: 'Cambiar de vista' }))
}

describe('MenuUsuario — cambiar de rol', () => {
  it('guarda el rol nuevo y DESPUÉS refresca la sesión', async () => {
    fetchMock.mockImplementation(async () => {
      pasos.push('guardar el rol')
      return new Response('{}', { status: 200 })
    })

    await pedirElCambio()

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(pasos).toEqual(['guardar el rol', 'refrescar la sesión'])

    const [ruta, pedido] = fetchMock.mock.calls[0]
    expect(ruta).toBe('/api/user/profile')
    expect(pedido.method).toBe('PATCH')
    expect(JSON.parse(pedido.body)).toEqual({ role: 'DOCENTE' })
    // Con argumento: sin él, Auth.js no vuelve a leer la base.
    expect(update).toHaveBeenCalledWith({})
  })

  it('si el rol no se pudo guardar, no refresca nada y lo dice', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))

    await pedirElCambio()

    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos cambiar tu cuenta. Probá de nuevo.')
    expect(update).not.toHaveBeenCalled()
    // El botón vuelve a estar disponible para reintentar.
    expect(screen.getByRole('button', { name: 'Cambiar de vista' })).toHaveProperty('disabled', false)
  })

  it('no cambia nada sin confirmación: abrir el menú y elegir la opción no alcanza', async () => {
    const usuario = userEvent.setup()
    render(<MenuUsuario nombre="Karina Álvarez" email={null} rol="ALUMNO" vistaPrevia={false} />)
    await usuario.click(screen.getByRole('button', { name: 'Abrir el menú de tu cuenta' }))
    await usuario.click(await screen.findByRole('menuitem', { name: 'Cambiar mi cuenta a docente' }))
    await usuario.click(await screen.findByRole('button', { name: 'Quedarme acá' }))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
