// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeccionDiagnostico } from './seccion-diagnostico'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const estado = {
  disponible: true,
  grupo: { classroomId: 1, materiaId: 13, materia: 'Matemática', unidades: [] },
  temasDificiles: [],
  diagnosticos: [
    {
      id: 1,
      modo: 'integral',
      creadoEl: '2026-11-19T12:00:00.000Z',
      cuestionarios: [{ id: 26, titulo: 'Diagnóstico integral · Matemática', unidadId: null, preguntas: 3, fuente: 'app', fecha: '2026-11-19T13:00:00.000Z' }],
      unidades: [],
      temas: [
        { temaId: 't1', nombre: 'Fracciones', unidadId: null, bien: 1, total: 1, estado: 'acerto', error: null },
        { temaId: 't2', nombre: 'Porcentajes', unidadId: null, bien: 0, total: 1, estado: 'fallo', error: null },
        { temaId: 't3', nombre: 'Estadística', unidadId: null, bien: 0, total: 1, estado: 'no_respondio', error: null },
      ],
    },
  ],
}

describe('SeccionDiagnostico · el chip del resultado (K7)', () => {
  it('anuncia sólo lo que muestra: ni "Dominado" ni "Flojo"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(estado), { status: 200 })))
    render(<SeccionDiagnostico destino={{ alumno: 'u9' }} />)
    await screen.findByText('Fracciones')
    const seccion = document.querySelector('section')!
    expect(seccion.textContent).toContain('Acertó')
    expect(seccion.textContent).toContain('Falló')
    expect(seccion.textContent).toContain('No respondió')
    expect(seccion.textContent).not.toMatch(/Dominado|Flojo|Sin datos/)
  })
})

describe('SeccionDiagnostico · la válvula de la 028 (L0)', () => {
  it('sin la 028 el botón queda deshabilitado y dice por qué', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...estado, individualDisponible: false }), { status: 200 })))
    render(<SeccionDiagnostico destino={{ alumno: 'u9' }} />)
    const boton = await screen.findByRole('button', { name: /Armar otro diagnóstico/ })
    expect(boton).toHaveProperty('disabled', true)
    expect(screen.getByText('Falta una actualización de la base para armar diagnósticos individuales')).toBeTruthy()
  })

  it('con la 028 se puede armar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...estado, individualDisponible: true }), { status: 200 })))
    render(<SeccionDiagnostico destino={{ alumno: 'u9' }} />)
    const boton = await screen.findByRole('button', { name: /Armar otro diagnóstico/ })
    expect(boton).toHaveProperty('disabled', false)
  })
})

describe('SeccionDiagnostico · las acciones de cada cuestionario (L1)', () => {
  it('suma revisar y editar y ver como alumno a imprimir y cargar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...estado, individualDisponible: true }), { status: 200 })))
    render(<SeccionDiagnostico destino={{ alumno: 'u9' }} />)
    const titulo = 'Diagnóstico integral · Matemática'
    expect(await screen.findByRole('button', { name: `Revisar y editar ${titulo}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Ver ${titulo} como alumno` })).toBeTruthy()
    expect(screen.getByRole('link', { name: `Imprimir ${titulo}` }).getAttribute('href')).toBe('/teacher/diagnosticos/imprimir/26?alumno=u9')
    expect(screen.getByRole('link', { name: `Cargar los resultados de ${titulo} desde el papel` })).toBeTruthy()
  })
})
