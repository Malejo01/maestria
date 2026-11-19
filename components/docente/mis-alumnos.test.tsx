// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MisAlumnos } from './mis-alumnos'
import { MIS_ALUMNOS } from '@/lib/textos'

/**
 * I5: al crear la primera materia, "Mis alumnos" se vuelve a leer. Antes la
 * tarjeta de hitos decía "2 de 4 pasos" y esta sección seguía con "Primero
 * armá tu materia" hasta recargar la página.
 */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sinNada = { alumnos: [], sugerencia: null, resumen: { temaFlojo: null, tareasEstaSemana: 0 }, materias: [] }
const conMateria = { ...sinNada, materias: [{ id: 1, nombre: 'Matemática', nivel: 'Secundario', grado: '3er Año' }] }

function respuesta(cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

describe('MisAlumnos — se pone al día con las materias (I5)', () => {
  it('cuando cambia la cantidad de materias, vuelve a leer y deja de pedir que arme una', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(respuesta(sinNada)).mockResolvedValueOnce(respuesta(conMateria))
    vi.stubGlobal('fetch', fetchMock)
    const props = { agregarAbierto: false, onAgregarCambia: () => {}, onArmarTarea: () => {} }

    const { rerender } = render(<MisAlumnos {...props} refrescarCon={0} />)
    expect(await screen.findByText(MIS_ALUMNOS.sinMateria.titulo)).toBeTruthy()

    // El docente crea su primera materia: el panel pasa de 0 a 1.
    rerender(<MisAlumnos {...props} refrescarCon={1} />)
    expect(await screen.findByText(MIS_ALUMNOS.vacio.titulo)).toBeTruthy()
    await waitFor(() => expect(screen.queryByText(MIS_ALUMNOS.sinMateria.titulo)).toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sin cambios, no vuelve a pedir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(sinNada))
    vi.stubGlobal('fetch', fetchMock)
    const props = { agregarAbierto: false, onAgregarCambia: () => {}, onArmarTarea: () => {}, refrescarCon: 1 }
    const { rerender } = render(<MisAlumnos {...props} />)
    await screen.findByText(MIS_ALUMNOS.sinMateria.titulo)
    rerender(<MisAlumnos {...props} />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('MisAlumnos — quitar a los que nunca respondieron (J1)', () => {
  const fila = (userId: string, nombre: string, intentos: number) => ({
    clave: `alumno-${userId}`,
    userId,
    pendiente: null,
    nombre,
    contexto: 'Matemática',
    materias: [{ id: 1, nombre: 'Matemática' }],
    chips: [],
    temaMasFlojo: null,
    ultimaVez: intentos ? '2026-11-18T12:00:00Z' : null,
    intentos,
    tareasEntregadas: 0,
    correctas: 0,
    calificadas: 0,
  })
  const conAlumnos = {
    ...conMateria,
    alumnos: [fila('a', 'Ana Ruiz', 3), fila('b', 'Beto Gómez', 0), fila('c', 'Cami Sosa', 0)],
    quitados: [{ userId: 'q', nombre: 'Quique', materias: [{ id: 1, nombre: 'Matemática' }], quitadoEl: '2026-11-10T12:00:00Z' }],
  }

  it('lista a quiénes antes de confirmar, y manda sólo a ésos', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuesta(conAlumnos))
      .mockResolvedValueOnce(respuesta({ quitados: 2 }))
      .mockResolvedValue(respuesta(conAlumnos))
    vi.stubGlobal('fetch', fetchMock)
    render(<MisAlumnos agregarAbierto={false} onAgregarCambia={() => {}} onArmarTarea={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: MIS_ALUMNOS.sinRespuestas.boton(2) }))
    const dialogo = await screen.findByRole('dialog')
    expect(dialogo.textContent).toContain('Beto Gómez')
    expect(dialogo.textContent).toContain('Cami Sosa')
    expect(dialogo.textContent).not.toContain('Ana Ruiz')

    fireEvent.click(screen.getByRole('button', { name: MIS_ALUMNOS.sinRespuestas.confirmar(2) }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/api/teacher/alumnos/quitar-sin-respuestas')
    expect(JSON.parse(init.body)).toEqual({ userIds: ['b', 'c'] })
  })

  it('los quitados quedan plegados abajo, con "Volver a sumar"', async () => {
    const { fireEvent } = await import('@testing-library/react')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(conAlumnos)))
    render(<MisAlumnos agregarAbierto={false} onAgregarCambia={() => {}} onArmarTarea={() => {}} />)

    const plegado = await screen.findByRole('button', { name: MIS_ALUMNOS.quitados.mostrar(1) })
    expect(screen.queryByText('Quique')).toBeNull()
    fireEvent.click(plegado)
    expect(screen.getByText('Quique')).toBeTruthy()
    expect(screen.getByRole('button', { name: MIS_ALUMNOS.quitados.volverAria('Quique') })).toBeTruthy()
  })
})
