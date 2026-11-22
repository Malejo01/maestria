// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TraerAlumnos } from './traer-alumnos'

/**
 * O7. Traer alumnos de otro grupo: se elige el grupo, se ven sus alumnos con
 * casillas (cuentas e invitados), los que ya están no se pueden tildar, y el
 * botón final manda sólo los elegidos.
 */
const pedidos: { url: string; init?: RequestInit }[] = []

beforeEach(() => {
  pedidos.length = 0
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init })
    const cuerpo =
      init?.method === 'POST'
        ? { copied: 1 }
        : {
            members: [
              { user_id: 'ana', display_name: 'Ana Gómez', is_verified: true },
              { user_id: 'guest_1', display_name: 'Beto', is_verified: false },
              { user_id: 'cami', display_name: 'Cami Ruiz', is_verified: true },
            ],
          }
    return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TraerAlumnos', () => {
  it('elige grupo y alumnos, y trae sólo los tildados', async () => {
    const alTraer = vi.fn()
    render(
      <TraerAlumnos grupoId={4} nombreDelGrupo="Matemática 1" otrosGrupos={[{ id: 2, name: 'Primer año', member_count: 3 }]} yaEstan={new Set(['cami'])} alTraer={alTraer} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Traer alumnos de otro grupo' }))
    await userEvent.selectOptions(screen.getByRole('combobox'), '2')
    await screen.findByText('Ana Gómez')
    expect(screen.getByText(/sin cuenta/)).toBeTruthy()
    expect(screen.getByText(/ya está en este grupo/)).toBeTruthy()

    const casillas = screen.getAllByRole('checkbox')
    expect(casillas[2].hasAttribute('disabled')).toBe(true)
    // Destildo a Beto: viaja sólo Ana.
    await userEvent.click(casillas[1])
    await userEvent.click(screen.getByRole('button', { name: 'Traer 1 alumno a Matemática 1' }))
    await waitFor(() => expect(alTraer).toHaveBeenCalledWith({ copiados: 1 }))
    const post = pedidos.find((p) => p.init?.method === 'POST')
    expect(post?.url).toBe('/api/teacher/classrooms/4/members')
    expect(JSON.parse(String(post?.init?.body))).toEqual({ sourceClassroomId: 2, userIds: ['ana'] })
  })

  it('sin otros grupos no se muestra', () => {
    const { container } = render(<TraerAlumnos grupoId={4} nombreDelGrupo="X" otrosGrupos={[]} yaEstan={new Set()} alTraer={() => {}} />)
    expect(container.textContent).toBe('')
  })
})
