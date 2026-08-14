// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { NumericInput } from './numeric-input'
import { isCorrectNumeric } from '@/lib/answer-grading'
import type { NumericQuestion } from '@/lib/types'

/**
 * El input de respuesta numérica usaba `type="number"`, que en la mayoría de
 * los navegadores descarta la coma decimal. Un alumno en es-AR que escribía
 * `3,5` obtenía un valor vacío y el botón "Verificar" quedaba deshabilitado sin
 * explicación — no hay forma de que adivine que el problema es el separador.
 *
 * Estos tests fijan las cuatro cosas: que acepte texto, que interprete con
 * `parseNumericAnswer`, que muestre qué entendió, y que avise antes de enviar
 * cuando no entiende.
 */

const pregunta: NumericQuestion = {
  id: 'q1',
  type: 'numeric',
  topic: 't1',
  topicName: 'Fracciones',
  question: '¿Cuánto es 7 dividido 2?',
  explanation: '3,5.',
  correctAnswer: 3.5,
}

function renderInput(overrides: Partial<React.ComponentProps<typeof NumericInput>> = {}) {
  const onChange = vi.fn()
  render(
    <NumericInput
      question={pregunta}
      value={null}
      submitted={false}
      onChange={onChange}
      {...overrides}
    />
  )
  return { onChange, input: screen.getByRole('textbox') as HTMLInputElement }
}

afterEach(cleanup)

describe('acepta las formas que se escriben en Argentina', () => {
  it('NO es un input type=number — es el bug que rompía la coma', () => {
    const { input } = renderInput()
    expect(input.getAttribute('type')).toBe('text')
    // El teclado numérico del celular se conserva.
    expect(input.getAttribute('inputMode')).toBe('decimal')
  })

  it.each([
    ['3,5', 3.5, 'coma decimal — el caso que estaba roto'],
    ['3.5', 3.5, 'punto decimal'],
    ['7/2', 3.5, 'fracción'],
    ['\\frac{7}{2}', 3.5, 'fracción en LaTeX'],
    ['$3,5$', 3.5, 'envuelto en LaTeX'],
    ['50%', 0.5, 'porcentaje'],
    ['-4,25', -4.25, 'negativo con coma'],
    ['  3,5  ', 3.5, 'con espacios de sobra'],
  ])('interpreta %j como %s (%s)', (texto, esperado) => {
    const { onChange, input } = renderInput()
    fireEvent.change(input, { target: { value: texto } })
    expect(onChange).toHaveBeenLastCalledWith(esperado)
  })

  it('deja escribir lo que el alumno tipeó, sin reformatearlo mientras escribe', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '7/2' } })
    // Si el componente sobreescribiera con "3,5" no se podría seguir editando.
    expect(input.value).toBe('7/2')
  })
})

describe('le muestra al alumno qué interpretamos', () => {
  it('confirma la lectura cuando la forma se transformó', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '7/2' } })
    expect(screen.getByText(/Leímos:/)).toBeTruthy()
    expect(screen.getByText('3,5')).toBeTruthy()
  })

  it('usa coma decimal, que es como se lee acá', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '1/2' } })
    expect(screen.getByText('0,5')).toBeTruthy()
    expect(screen.queryByText('0.5')).toBeNull()
  })

  it('no repite lo obvio cuando el alumno ya escribió la forma canónica', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '3,5' } })
    expect(screen.queryByText(/Leímos:/)).toBeNull()
  })
})

describe('avisa ANTES de enviar cuando no puede interpretar', () => {
  it('explica el problema en vez de dejar el botón muerto sin causa', () => {
    const { onChange, input } = renderInput()
    fireEvent.change(input, { target: { value: 'tres y medio' } })

    // El padre recibe null, así que "Verificar" sigue deshabilitado — pero
    // ahora el alumno sabe por qué y cómo arreglarlo.
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(screen.getByText(/No entendimos ese número/)).toBeTruthy()
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('no grita sobre un campo vacío', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: '3,5' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByText(/No entendimos/)).toBeNull()
  })

  it('el aviso desaparece cuando el alumno corrige', () => {
    const { input } = renderInput()
    fireEvent.change(input, { target: { value: 'x' } })
    expect(screen.getByText(/No entendimos ese número/)).toBeTruthy()

    fireEvent.change(input, { target: { value: '3,5' } })
    expect(screen.queryByText(/No entendimos/)).toBeNull()
  })

  it.each(['1 1/2', '1/0', '3 5'])('rechaza %j en vez de adivinar', (texto) => {
    // `1 1/2` es el caso peligroso: si se ignoraran los espacios se leería
    // 11/2 = 5,5. Mejor pedirle al alumno que lo reescriba.
    const { onChange, input } = renderInput()
    fireEvent.change(input, { target: { value: texto } })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
})

describe('la comparación usa la tolerancia por defecto', () => {
  it('0,33 cuenta como 1/3', () => {
    const tercio: NumericQuestion = { ...pregunta, correctAnswer: 1 / 3 }
    expect(isCorrectNumeric(tercio, 0.33)).toBe(true)
  })

  it('7/2 escrito como 3,5 acierta sin depender del punto flotante', () => {
    expect(isCorrectNumeric(pregunta, 7 / 2)).toBe(true)
  })

  it('un entero sigue sin tolerar al de al lado', () => {
    // defaultToleranceFor devuelve 0 para enteros: ninguna pregunta de
    // resultado entero cambia de veredicto respecto del comportamiento viejo.
    const entero: NumericQuestion = { ...pregunta, correctAnswer: 13 }
    expect(isCorrectNumeric(entero, 12)).toBe(false)
    expect(isCorrectNumeric(entero, 13)).toBe(true)
  })

  it('una tolerance explícita gana, incluso en 0', () => {
    const exacta: NumericQuestion = { ...pregunta, correctAnswer: 1 / 3, tolerance: 0 }
    expect(isCorrectNumeric(exacta, 0.33)).toBe(false)
  })
})

describe('estado ya enviado', () => {
  it('muestra la respuesta correcta con coma decimal', () => {
    render(
      <NumericInput
        question={pregunta}
        value={2}
        submitted
        isCorrect={false}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText(/Respuesta correcta: 3,5/)).toBeTruthy()
  })

  it('no muestra el aviso de interpretación una vez enviada', () => {
    render(
      <NumericInput question={pregunta} value={3.5} submitted isCorrect onChange={vi.fn()} />
    )
    expect(screen.queryByText(/Leímos:/)).toBeNull()
  })
})
