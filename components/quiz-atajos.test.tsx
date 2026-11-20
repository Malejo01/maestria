// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuizEngine } from './quiz-engine'
import { useAppStore } from '@/lib/store'
import type { MultipleChoiceQuestion, NumericQuestion, Question, QuizConfig } from '@/lib/types'

/**
 * L2: los atajos de teclado del cuestionario, en escritorio. Tres cosas que
 * pide el encargo: elegir con flechas + Espacio y avanzar con Enter; que
 * escribir "1" en un campo numérico no elija la opción 1; y que con un diálogo
 * abierto las flechas no hagan nada.
 */

const config: QuizConfig = {
  subject: 'mat',
  subjectName: 'Matemática',
  topics: [{ id: 't1', name: 'Fracciones' }],
  mode: 'practico',
  questionCount: 2,
}

const opcionMultiple: MultipleChoiceQuestion = {
  id: 'q1',
  type: 'multiple_choice',
  topic: 't1',
  topicName: 'Fracciones',
  question: '¿Cuánto es 1/2 + 1/2?',
  explanation: 'Las mitades suman un entero.',
  options: ['0', '1', '2', '1/4'],
  correctAnswer: 1,
}

const numerica: NumericQuestion = {
  id: 'q2',
  type: 'numeric',
  topic: 't1',
  topicName: 'Suma',
  question: '¿Cuánto es 3 + 9?',
  explanation: '12.',
  correctAnswer: 12,
}

function empezar(preguntas: Question[]) {
  act(() => {
    useAppStore.getState().startQuiz(config, preguntas)
  })
}

const opcion = (texto: string) => screen.getAllByRole('radio').find((r) => r.textContent?.includes(texto))!

beforeEach(() => {
  // Escritorio: puntero fino y 768 px o más.
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: true,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  // La pista de atajos se lee de localStorage; arranca visible.
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  act(() => {
    useAppStore.getState().setActiveView('dashboard')
  })
})

describe('L2 · atajos de teclado', () => {
  it('elegir con flechas y Espacio, y avanzar con Enter', async () => {
    const usuario = userEvent.setup()
    empezar([opcionMultiple, numerica])
    render(<QuizEngine />)

    // ↓ entra al grupo por la primera opción; ↓ otra vez, a la segunda.
    await usuario.keyboard('{ArrowDown}{ArrowDown}')
    expect(document.activeElement).toBe(opcion('1'))
    expect(opcion('1').getAttribute('aria-checked')).toBe('false')

    await usuario.keyboard(' ')
    expect(opcion('1').getAttribute('aria-checked')).toBe('true')

    // Enter confirma…
    await usuario.keyboard('{Enter}')
    expect(screen.getByText('Correcto')).toBeTruthy()

    // …y Enter otra vez pasa a la siguiente.
    await usuario.keyboard('{Enter}')
    expect(screen.getByText('¿Cuánto es 3 + 9?')).toBeTruthy()
  })

  it('con una letra o un número se elige directo', async () => {
    const usuario = userEvent.setup()
    empezar([opcionMultiple])
    render(<QuizEngine />)
    await usuario.keyboard('c')
    expect(opcion('2').getAttribute('aria-checked')).toBe('true')
    await usuario.keyboard('2')
    expect(opcion('1').getAttribute('aria-checked')).toBe('true')
  })

  it('escribir "1" en un campo numérico no elige la opción 1: escribe', async () => {
    const usuario = userEvent.setup()
    empezar([numerica])
    render(<QuizEngine />)
    const campo = screen.getByRole('textbox') as HTMLInputElement
    await usuario.click(campo)
    await usuario.keyboard('1')
    expect(campo.value).toBe('1')
    await usuario.keyboard('2')
    expect(campo.value).toBe('12')
    // En un campo de texto, Enter confirma lo escrito.
    await usuario.keyboard('{Enter}')
    expect(screen.getByText('Correcto')).toBeTruthy()
  })

  it('con un diálogo abierto, las flechas no hacen nada', async () => {
    const usuario = userEvent.setup()
    empezar([opcionMultiple])
    render(<QuizEngine />)

    // Esc abre el Dialog de salir (antes era un confirm() nativo).
    await usuario.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: '¿Salís del cuestionario?' })).toBeTruthy()

    await usuario.keyboard('{ArrowDown}{ArrowDown}1')
    expect(screen.getAllByRole('radio', { hidden: true }).every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('? muestra y oculta la ayuda; la pista se puede ocultar', async () => {
    const usuario = userEvent.setup()
    empezar([opcionMultiple])
    render(<QuizEngine />)
    expect(screen.getByText('↑↓ elegir · Espacio marcar · Enter siguiente · ? atajos')).toBeTruthy()
    await usuario.keyboard('?')
    expect(screen.getByRole('region', { name: 'Atajos de teclado' })).toBeTruthy()
    await usuario.keyboard('?')
    expect(screen.queryByRole('region', { name: 'Atajos de teclado' })).toBeNull()
    await usuario.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(screen.queryByText(/Espacio marcar/)).toBeNull()
    expect(window.localStorage.getItem('maestria:atajos-pista-oculta')).toBe('1')
  })

  it('Enter sobre otro botón es de ese botón, no un atajo', async () => {
    const usuario = userEvent.setup()
    empezar([opcionMultiple, numerica])
    render(<QuizEngine />)
    await usuario.keyboard('b{Enter}')
    expect(screen.getByText('Correcto')).toBeTruthy()
    // Con el foco en "Siguiente", Enter lo aprieta una sola vez: no saltea dos preguntas.
    screen.getByRole('button', { name: /Siguiente/ }).focus()
    await usuario.keyboard('{Enter}')
    expect(screen.getByText('¿Cuánto es 3 + 9?')).toBeTruthy()
  })
})
