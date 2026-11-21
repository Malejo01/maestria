// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanillaDelGrupo } from './planilla-del-grupo'
import type { AlumnoDelInforme } from './use-informe-del-grupo'

/**
 * M4. La planilla del grupo se ordena tocando el encabezado, se filtra con la
 * búsqueda y los chips, guarda todo en la URL, y el CSV baja lo que se ve.
 */
let consulta = new URLSearchParams()
const replace = vi.fn((url: string) => {
  consulta = new URLSearchParams(url.split('?')[1] ?? '')
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/teacher/grupos/4',
  useSearchParams: () => consulta,
}))
vi.mock('@/components/classroom-student-dialog', () => ({ ClassroomStudentDialog: () => null }))

const alumno = (memberId: number, displayName: string, a: Partial<AlumnoDelInforme> = {}): AlumnoDelInforme => ({
  memberId,
  userId: `u${memberId}`,
  displayName,
  isVerified: false,
  joinedAt: '2026-11-01',
  attemptCount: 1,
  averageScore: 7,
  bestScore: 8,
  passedCount: 1,
  lastAttemptAt: '2026-11-20T15:00:00.000Z',
  weakTopics: [],
  ...a,
})

const alumnos = [
  alumno(1, 'clarita Zolorza', { averageScore: 5.5, weakTopics: [{ topicName: 'Inecuaciones', correct: 1, total: 3, accuracy: 0.33 }] }),
  alumno(2, 'Bruno Quiroga', { averageScore: 9 }),
  alumno(3, 'Ana Pérez', { attemptCount: 0, averageScore: null, bestScore: null, lastAttemptAt: null }),
]

function dibujar() {
  return render(
    <PlanillaDelGrupo grupoId={4} nombreDelGrupo="Grupo 4" codigo="XYZ789" alumnos={alumnos} otrosGrupos={[]} alCambiar={() => {}} />,
  )
}

const nombresEnOrden = () =>
  within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map((celda) => celda.textContent?.replace('sin verificar', '').trim())

beforeEach(() => {
  consulta = new URLSearchParams()
  replace.mockClear()
})
afterEach(cleanup)

describe('planilla del grupo', () => {
  it('arranca A→Z por apellido', () => {
    dibujar()
    expect(nombresEnOrden()).toEqual(['Ana Pérez', 'Bruno Quiroga', 'clarita Zolorza'])
    expect(screen.getByRole('columnheader', { name: /Alumno/ }).getAttribute('aria-sort')).toBe('ascending')
  })

  it('tocar Promedio ordena de mayor a menor (vacíos al final) y lo guarda en la URL; otro toque invierte', async () => {
    const { rerender } = dibujar()
    await userEvent.click(screen.getByRole('button', { name: 'Ordenar por Promedio' }))
    expect(replace).toHaveBeenLastCalledWith('/teacher/grupos/4?orden=promedio', { scroll: false })
    rerender(<PlanillaDelGrupo grupoId={4} nombreDelGrupo="Grupo 4" codigo="XYZ789" alumnos={alumnos} otrosGrupos={[]} alCambiar={() => {}} />)
    expect(nombresEnOrden()).toEqual(['Bruno Quiroga', 'clarita Zolorza', 'Ana Pérez'])
    expect(screen.getByRole('columnheader', { name: /Promedio/ }).getAttribute('aria-sort')).toBe('descending')

    await userEvent.click(screen.getByRole('button', { name: 'Ordenar por Promedio' }))
    expect(replace).toHaveBeenLastCalledWith('/teacher/grupos/4?orden=promedio&dir=asc', { scroll: false })
    rerender(<PlanillaDelGrupo grupoId={4} nombreDelGrupo="Grupo 4" codigo="XYZ789" alumnos={alumnos} otrosGrupos={[]} alCambiar={() => {}} />)
    expect(nombresEnOrden()).toEqual(['clarita Zolorza', 'Bruno Quiroga', 'Ana Pérez'])
  })

  it('la URL manda: vuelve con el orden y el filtro aplicados', () => {
    consulta = new URLSearchParams('orden=promedio&filtro=debajo')
    dibujar()
    expect(nombresEnOrden()).toEqual(['clarita Zolorza'])
    expect(screen.getByRole('button', { name: 'Debajo de 6 (1)' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('buscar sin tildes ni mayúsculas', () => {
    consulta = new URLSearchParams('buscar=PEREZ')
    dibujar()
    expect(nombresEnOrden()).toEqual(['Ana Pérez'])
    expect(screen.getByText('Mostrando 1 de 3.')).toBeTruthy()
  })

  it('los chips filtran y dicen cuántos hay', async () => {
    dibujar()
    expect(screen.getByRole('button', { name: 'No respondieron nada (1)' })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Con temas flojos (1)' }))
    expect(replace).toHaveBeenLastCalledWith('/teacher/grupos/4?filtro=flojos', { scroll: false })
  })

  it('el CSV baja lo que se ve, en el orden en que se ve', async () => {
    consulta = new URLSearchParams('orden=promedio&filtro=todos')
    let blob: Blob | null = null
    vi.stubGlobal('URL', { ...URL, createObjectURL: (b: Blob) => ((blob = b), 'blob:x'), revokeObjectURL: () => {} })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    dibujar()
    await userEvent.click(screen.getByRole('button', { name: 'Descargar notas' }))
    const texto = await (blob as unknown as Blob).text()
    const filas = texto.replace('﻿', '').split('\r\n')
    expect(filas.map((f) => f.split(';')[0])).toEqual(['"Alumno"', '"Bruno Quiroga"', '"clarita Zolorza"', '"Ana Pérez"'])
    click.mockRestore()
    vi.unstubAllGlobals()
  })
})
