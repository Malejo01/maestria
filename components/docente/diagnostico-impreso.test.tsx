// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ImprimirDiagnostico } from './diagnostico-impreso'
import { DIAGNOSTICO } from '@/lib/textos'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const datos = {
  quizId: 26,
  titulo: 'Diagnóstico integral · Matemática',
  materia: 'Matemática',
  alumno: 'Sofía Ayarde',
  cargaPrevia: null,
  preguntas: [
    { indice: 0, enunciado: '¿Cuánto es 6 x 7?', tipo: 'numeric', opciones: [], correcta: '42', explicacion: '' },
    { indice: 1, enunciado: '¿Cuál es par?', tipo: 'multiple_choice', opciones: ['3', '8'], correcta: 'B. 8', explicacion: '' },
  ],
}

describe('ImprimirDiagnostico (J7)', () => {
  it('la hoja del alumno lleva nombre y espacio para fecha, y NO las respuestas; las correctas van en otra página', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(datos), { status: 200 })))
    render(<ImprimirDiagnostico quizId={26} consulta="invitacion=5" />)

    const hojaDocente = (await screen.findByText(DIAGNOSTICO.impreso.hojaDocente)).closest('article')!
    const hojas = [...document.querySelectorAll('article')]
    const hojaAlumno = hojas[0]

    expect(hojas).toHaveLength(2)
    expect(hojaAlumno).not.toBe(hojaDocente)
    expect(hojaAlumno.textContent).toContain('Sofía Ayarde')
    expect(hojaAlumno.textContent).toContain(DIAGNOSTICO.impreso.fecha)
    expect(hojaAlumno.textContent).not.toContain('42')
    expect(hojaAlumno.textContent).not.toContain(DIAGNOSTICO.impreso.hojaDocente)
    // La del docente arranca en una página nueva al imprimir.
    expect(hojaDocente.className).toContain('break-before-page')
    expect(hojaDocente.textContent).toContain('42')
    expect(hojaDocente.textContent).toContain('B. 8')
  })
})
