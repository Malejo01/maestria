// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { GapsInput } from './gaps-input'
import type { GapsQuestion } from '@/lib/types'

vi.mock('@/components/latex-renderer', () => ({ LaTeXRenderer: ({ content }: { content: string }) => <span>{content}</span> }))

const base: Omit<GapsQuestion, 'type'> = {
  id: 'q1',
  topic: 't',
  topicName: 'Mercado',
  question: 'Completá el texto.',
  text: 'Si sube el [[1]], baja la [[2]] demandada; la curva de [[3]] baja.',
  choices: ['precio', 'cantidad', 'demanda', 'oferta'],
  explanation: '',
}

afterEach(cleanup)

describe('F5 · GapsInput', () => {
  it('seleccionar: una lista por hueco, con todas las palabras', () => {
    const onChange = vi.fn()
    render(<GapsInput question={{ ...base, type: 'gapselect' }} elegidas={[null, null, null]} submitted={false} onChange={onChange} />)
    const hueco = screen.getByRole('combobox', { name: 'Hueco 2' }) as HTMLSelectElement
    expect([...hueco.options].map((o) => o.textContent).filter((t) => t !== 'Elegí…').sort()).toEqual(['cantidad', 'demanda', 'oferta', 'precio'])
    fireEvent.change(hueco, { target: { value: '1' } })
    expect(onChange).toHaveBeenLastCalledWith([null, 1, null])
  })

  it('arrastrar: se toca la palabra y después el hueco; tocar un hueco lleno lo vacía', () => {
    const onChange = vi.fn()
    const { rerender } = render(<GapsInput question={{ ...base, type: 'ddwtos' }} elegidas={[null, null, null]} submitted={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'demanda' }))
    expect(screen.getByText('Ahora tocá el hueco donde va "demanda".')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hueco 3: vacío' }))
    expect(onChange).toHaveBeenLastCalledWith([null, null, 2])
    rerender(<GapsInput question={{ ...base, type: 'ddwtos' }} elegidas={[null, null, 2]} submitted={false} onChange={onChange} />)
    // Ya puesta, la palabra no se puede volver a tomar.
    expect((screen.getByRole('button', { name: 'demanda' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hueco 3: demanda. Tocalo para sacarla.' }))
    expect(onChange).toHaveBeenLastCalledWith([null, null, null])
  })

  it('al enviar con algo mal: las correctas, en orden', () => {
    render(<GapsInput question={{ ...base, type: 'gapselect' }} elegidas={[0, 3, 2]} submitted onChange={vi.fn()} />)
    expect(screen.getByText('Correctas, en orden: precio · cantidad · demanda')).toBeTruthy()
  })
})
