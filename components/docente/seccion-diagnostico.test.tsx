// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeccionDiagnostico } from './seccion-diagnostico'

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
