// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OrderingInput } from './ordering-input'
import type { OrderingQuestion } from '@/lib/types'

vi.mock('@/components/latex-renderer', () => ({ LaTeXRenderer: ({ content }: { content: string }) => <span>{content}</span> }))

const Q: OrderingQuestion = {
  id: 'q1',
  type: 'ordering',
  topic: 't',
  topicName: 'Etapas',
  question: 'Ordená de la más antigua a la más reciente.',
  items: ['Paleolítico', 'Neolítico', 'Edad de los metales'],
  explanation: '',
}

afterEach(cleanup)

describe('F4 · OrderingInput', () => {
  it('subir y bajar devuelven el nuevo orden; el primero no sube y el último no baja', () => {
    const onChange = vi.fn()
    render(<OrderingInput question={Q} orden={[1, 0, 2]} submitted={false} onChange={onChange} />)
    expect((screen.getByRole('button', { name: 'Subir: Neolítico' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Bajar: Edad de los metales' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Subir: Paleolítico' }))
    expect(onChange).toHaveBeenLastCalledWith([0, 1, 2])
  })

  it('al enviar: sin flechas, y el lugar mal dice qué iba ahí', () => {
    render(<OrderingInput question={Q} orden={[1, 0, 2]} submitted onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^Subir/ })).toBeNull()
    expect(screen.getByText('En el lugar 1 iba: Paleolítico')).toBeTruthy()
    expect(screen.queryByText('En el lugar 3 iba: Edad de los metales')).toBeNull()
  })
})
