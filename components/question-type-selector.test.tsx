// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QuestionTypeSelector } from './question-type-selector'

afterEach(cleanup)

describe('F8 · QuestionTypeSelector: "Más tipos (como en Moodle)"', () => {
  it('sin conMasTipos (el alumno): sólo los cuatro de siempre', () => {
    render(<QuestionTypeSelector value={['multiple_choice']} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.queryByText('Más tipos (como en Moodle)')).toBeNull()
  })

  it('el docente: el grupo cerrado; al abrirlo, los siete tipos de Moodle, y elegir uno lo suma', () => {
    const onChange = vi.fn()
    render(<QuestionTypeSelector conMasTipos value={['multiple_choice']} onChange={onChange} />)
    const grupo = screen.getByRole('button', { name: /Más tipos \(como en Moodle\)/ })
    expect(grupo.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: /Emparejamiento/ })).toBeNull()
    fireEvent.click(grupo)
    expect(grupo.getAttribute('aria-expanded')).toBe('true')
    for (const tipo of ['Varias correctas', 'Emparejamiento', 'Ordenamiento', 'Seleccionar la palabra', 'Arrastrar al texto', 'Palabra faltante', 'Calculada']) {
      expect(screen.getByRole('button', { name: new RegExp(tipo) })).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: /Emparejamiento/ }))
    expect(onChange).toHaveBeenLastCalledWith(['multiple_choice', 'matching'])
  })

  it('con alguno de Moodle ya elegido, el grupo arranca abierto y dice cuántos', () => {
    render(<QuestionTypeSelector conMasTipos value={['multiple_choice', 'ordering', 'calculated']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Más tipos \(como en Moodle\)/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('2 elegidos')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Ordenamiento/ }).getAttribute('aria-pressed')).toBe('true')
  })
})
