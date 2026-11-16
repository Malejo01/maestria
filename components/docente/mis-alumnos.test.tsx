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
