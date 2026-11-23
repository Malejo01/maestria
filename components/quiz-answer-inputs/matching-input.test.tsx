// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MatchingInput } from './matching-input'
import type { MatchingQuestion } from '@/lib/types'

vi.mock('@/components/latex-renderer', () => ({ LaTeXRenderer: ({ content }: { content: string }) => <span>{content}</span> }))

const Q: MatchingQuestion = {
  id: 'q1',
  type: 'matching',
  topic: 't',
  topicName: 'Autores',
  question: 'Uní cada autor con su concepto.',
  pairs: [
    { left: 'Geertz', right: 'Descripción densa' },
    { left: 'Lévi-Strauss', right: 'Estructuralismo' },
    { left: 'Malinowski', right: 'Observación participante' },
  ],
  distractors: ['Evolucionismo'],
  explanation: '',
}

afterEach(cleanup)

describe('F3 · MatchingInput', () => {
  it('una lista por elemento, con las respuestas y el distractor; elegir devuelve lo de cada renglón', () => {
    const onChange = vi.fn()
    render(<MatchingInput question={Q} selected={[null, null, null]} submitted={false} onChange={onChange} />)
    const lista = screen.getByRole('combobox', { name: 'Pareja de: Lévi-Strauss' }) as HTMLSelectElement
    expect([...lista.options].map((o) => o.value).filter(Boolean).sort()).toEqual(['Descripción densa', 'Estructuralismo', 'Evolucionismo', 'Observación participante'])
    fireEvent.change(lista, { target: { value: 'Estructuralismo' } })
    expect(onChange).toHaveBeenLastCalledWith([null, 'Estructuralismo', null])
  })

  it('al enviar: el renglón mal dice cuál era, y ya no se cambia', () => {
    render(<MatchingInput question={Q} selected={['Descripción densa', 'Evolucionismo', 'Observación participante']} submitted onChange={vi.fn()} />)
    expect(screen.getByText('Correcta: Estructuralismo')).toBeTruthy()
    expect(screen.queryByText('Correcta: Descripción densa')).toBeNull()
    expect((screen.getByRole('combobox', { name: 'Pareja de: Geertz' }) as HTMLSelectElement).disabled).toBe(true)
  })
})
