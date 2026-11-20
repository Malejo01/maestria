// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NumericInput } from './numeric-input'
import type { NumericQuestion } from '@/lib/types'

afterEach(cleanup)

const factorizacion: NumericQuestion = {
  id: 'q8',
  type: 'numeric',
  topic: 't1',
  topicName: 'Números naturales',
  question: 'Realizá la factorización en números primos del número 120 y expresala como producto de potencias.',
  explanation: '',
  correctAnswer: 120,
}

const cuenta: NumericQuestion = { ...factorizacion, question: '¿Cuánto es 7 + 5?', topicName: 'Suma', correctAnswer: 12 }

describe('L3 · el campo de una factorización', () => {
  it('lee el producto, muestra la vista previa y trae la barra', () => {
    const onChange = vi.fn()
    render(<NumericInput question={factorizacion} value={null} submitted={false} onChange={onChange} />)
    const campo = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(campo, { target: { value: '2^3·3·5' } })
    expect(onChange).toHaveBeenLastCalledWith(120, '2^3·3·5')
    expect(screen.getByRole('toolbar', { name: 'Símbolos matemáticos' })).toBeTruthy()
    expect(screen.getByText('Se ve así:')).toBeTruthy()
    // Un producto no es "un número que no entendimos".
    expect(screen.queryByText(/No entendimos ese número/)).toBeNull()
  })

  it('el botón de potencia inserta ^ en el cursor', () => {
    const onChange = vi.fn()
    render(<NumericInput question={factorizacion} value={null} submitted={false} onChange={onChange} />)
    const campo = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(campo, { target: { value: '2' } })
    campo.setSelectionRange(1, 1)
    fireEvent.click(screen.getByRole('button', { name: /Potencia/ }))
    // `2^` todavía no es un producto: el valor queda vacío hasta que escriba el exponente.
    expect(onChange).toHaveBeenLastCalledWith(null, '2^')
  })

  it('si está mal, dice por qué y muestra la correcta como producto de potencias', () => {
    render(<NumericInput question={factorizacion} value={120} submitted isCorrect={false} onChange={() => {}} />)
    expect(document.body.textContent).toContain('Respuesta correcta')
    expect(screen.queryByRole('toolbar')).toBeNull()
  })

  it('en una cuenta simple no hay barra', () => {
    render(<NumericInput question={cuenta} value={null} submitted={false} onChange={() => {}} />)
    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})

describe('L3 · el cursor después de insertar', () => {
  it('la raíz deja el cursor adentro de los paréntesis', async () => {
    const { useState } = await import('react')
    const { ShortAnswerInput } = await import('./short-answer-input')
    function Campo() {
      const [valor, setValor] = useState('')
      return (
        <ShortAnswerInput
          question={{ id: 's', type: 'short_answer', topic: 't', topicName: 'Potencias', question: '¿?', explanation: '', acceptedAnswers: ['4'] }}
          value={valor}
          submitted={false}
          onChange={setValor}
        />
      )
    }
    render(<Campo />)
    fireEvent.click(screen.getByRole('button', { name: /Raíz/ }))
    const campo = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(campo.value).toBe('√()')
    expect(campo.selectionStart).toBe(2)
  })
})
