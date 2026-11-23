// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MultipleResponseInput } from './multiple-response-input'
import type { MultipleResponseQuestion } from '@/lib/types'

vi.mock('@/components/latex-renderer', () => ({ LaTeXRenderer: ({ content }: { content: string }) => <span>{content}</span> }))

const Q: MultipleResponseQuestion = {
  id: 'q1',
  type: 'multiple_response',
  topic: 't',
  topicName: 'Cultura',
  question: '¿Cuáles?',
  options: ['Se aprende', 'Es innata', 'Se comparte'],
  correctAnswers: [0, 2],
  explanation: '',
}

afterEach(cleanup)

describe('F2 · MultipleResponseInput', () => {
  it('casillas: marcar y desmarcar devuelve los índices ordenados', () => {
    const onChange = vi.fn()
    const { rerender } = render(<MultipleResponseInput question={Q} selected={[]} submitted={false} onChange={onChange} />)
    expect(screen.getByText('Marcá todas las correctas.')).toBeTruthy()
    const casillas = screen.getAllByRole('checkbox')
    expect(casillas).toHaveLength(3)
    fireEvent.click(casillas[2])
    expect(onChange).toHaveBeenLastCalledWith([2])
    rerender(<MultipleResponseInput question={Q} selected={[2]} submitted={false} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenLastCalledWith([0, 2])
    rerender(<MultipleResponseInput question={Q} selected={[0, 2]} submitted={false} onChange={onChange} />)
    expect(screen.getAllByRole('checkbox')[0].getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(onChange).toHaveBeenLastCalledWith([2])
  })

  it('al enviar: la correcta que faltó lo dice, y ya no se puede cambiar', () => {
    render(<MultipleResponseInput question={Q} selected={[0]} submitted onChange={vi.fn()} />)
    expect(screen.getByText('Era correcta y no la marcaste.')).toBeTruthy()
    expect((screen.getAllByRole('checkbox')[1] as HTMLButtonElement).disabled).toBe(true)
  })
})
