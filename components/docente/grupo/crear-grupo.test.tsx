// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CrearGrupo } from './crear-grupo'
import type { TeacherProgram } from '@/lib/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
afterEach(cleanup)

const materias = [{ id: 1, subjectName: 'Matemática' }] as unknown as TeacherProgram[]

describe('CrearGrupo · AC1', () => {
  it('al docente particular: el botón se ve, deshabilitado, con la ayuda y el link a «Cómo das clases»', () => {
    render(<CrearGrupo materias={materias} modalidad="particular" />)
    const boton = screen.getByRole('button', { name: /Crear grupo/ })
    expect(boton.hasAttribute('disabled')).toBe(true)
    const ayuda = document.querySelector('[data-crear-grupo-deshabilitado] p')?.textContent ?? ''
    expect(ayuda).toBe('Los cursos son para clases en una escuela o instituto. ¿Das clases en un curso? Cambialo en Cómo das clases.')
    expect(screen.getByRole('link', { name: 'Cómo das clases' }).getAttribute('href')).toBe('/teacher?comoDasClases=1')
    expect(boton.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('al de curso y al que no eligió (null): habilitado, como siempre', () => {
    render(<CrearGrupo materias={materias} modalidad="curso" />)
    expect(screen.getByRole('button', { name: /Crear grupo/ }).hasAttribute('disabled')).toBe(false)
    cleanup()
    render(<CrearGrupo materias={materias} />)
    expect(screen.getByRole('button', { name: /Crear grupo/ }).hasAttribute('disabled')).toBe(false)
  })
})
