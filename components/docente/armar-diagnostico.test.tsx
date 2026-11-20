// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArmarDiagnostico } from './armar-diagnostico'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const unidades = [
  {
    id: 'u1',
    name: 'Unidad I · Números',
    topics: ['Naturales', 'Enteros', 'Fracciones', 'Decimales', 'Porcentaje'].map((name, i) => ({ id: `t${i}`, name })),
  },
]

function servidor() {
  return vi.fn(async (url: string) => {
    if (url === '/api/teacher/diagnosticos') return new Response(JSON.stringify({ diagnosticoId: 7 }), { status: 200 })
    if (url.endsWith('/cuestionarios')) return new Response(JSON.stringify({ quizId: 41, preguntas: 5 }), { status: 200 })
    return new Response('{}', { status: 404 })
  })
}

describe('L1 · al terminar de generar el diagnóstico', () => {
  it('dice que ya quedó guardado y cada cuestionario trae sus cuatro acciones', async () => {
    vi.stubGlobal('fetch', servidor())
    render(
      <ArmarDiagnostico
        abierto
        onCambiar={() => {}}
        destino={{ alumno: 'u9' }}
        nombre="Bruno Quiroga"
        materia="Matemática"
        unidades={unidades}
        temasDificiles={[]}
        alTerminar={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('radio', { name: /Integral/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Generar y asignar' }))

    expect(await screen.findByText('Listo. Quedaron guardados en la ficha y asignados a Bruno Quiroga.')).toBeTruthy()
    const titulo = 'Integral'
    expect(screen.getByRole('button', { name: `Revisar y editar ${titulo}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Ver ${titulo} como alumno` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Hacer ${titulo} vos` })).toBeTruthy()
    expect(screen.getByRole('link', { name: `Imprimir ${titulo}` }).getAttribute('href')).toBe('/teacher/diagnosticos/imprimir/41?alumno=u9')
    // A 390 px las mismas acciones van en el menú "…".
    expect(screen.getByRole('button', { name: `Qué hacer con ${titulo}` })).toBeTruthy()
    // Ya está guardado: no hay un botón de guardar.
    expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull()
  })

  it('del grupo dice "al grupo"', async () => {
    vi.stubGlobal('fetch', servidor())
    render(
      <ArmarDiagnostico
        abierto
        onCambiar={() => {}}
        destino={{ alumno: 'u9' }}
        materia="Matemática"
        unidades={unidades}
        temasDificiles={[]}
        alTerminar={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Generar y asignar' }))
    expect(await screen.findByText('Listo. Quedaron guardados y asignados al grupo.')).toBeTruthy()
  })
})
