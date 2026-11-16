// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { QuizEngine } from './quiz-engine'
import { useAppStore } from '@/lib/store'
import type { MultipleChoiceQuestion, Question, QuizConfig } from '@/lib/types'

/**
 * Regression test for the production crash
 *   "Error: Selection type does not match question type"
 *
 * The engine keeps the student's in-progress selection in local component
 * state and resets it from a useEffect keyed on `currentIndex`. Effects run
 * AFTER the render they belong to, so the render that first sees question
 * N+1 still holds the selection built for question N. In a mixed-type quiz
 * that pair has two different `type` discriminants, and `buildAnswer` —
 * which runs during render, not in an event handler — throws.
 *
 * A throw during render is not catchable by the component: it unwinds to the
 * error boundary and the student loses the attempt, which is why no
 * non-multiple_choice answer has ever reached `quiz_answers` in production.
 */

const config: QuizConfig = {
  subject: 'mat',
  subjectName: 'Matemática',
  topics: [{ id: 't1', name: 'Fracciones' }],
  mode: 'mixto',
  questionCount: 2,
  questionTypes: ['multiple_choice', 'true_false'],
}

const multipleChoice: MultipleChoiceQuestion = {
  id: 'q1',
  type: 'multiple_choice',
  topic: 't1',
  topicName: 'Fracciones',
  question: '¿Cuánto es 1/2 + 1/2?',
  explanation: 'Las mitades suman un entero.',
  options: ['0', '1', '2', '1/4'],
  correctAnswer: 1,
}

const trueFalse: Question = {
  id: 'q2',
  type: 'true_false',
  topic: 't1',
  topicName: 'Fracciones',
  question: '3/4 es mayor que 2/3.',
  explanation: '3/4 = 0,75 y 2/3 ≈ 0,67.',
  correctAnswer: true,
}

const numeric: Question = {
  id: 'q3',
  type: 'numeric',
  topic: 't1',
  topicName: 'Fracciones',
  question: '¿Cuánto es 3 x 7?',
  explanation: '21.',
  correctAnswer: 21,
}

function startQuizWith(questions: Question[]) {
  act(() => {
    useAppStore.getState().startQuiz(config, questions)
  })
}

/** Answers the current multiple_choice question and confirms it. */
function answerMultipleChoice(optionIndex: number) {
  act(() => {
    screen.getAllByRole('button')
      .filter((button) => button.textContent?.includes(multipleChoice.options[optionIndex]))[0]
      .click()
  })
  act(() => {
    screen.getByRole('button', { name: 'Verificar' }).click()
  })
}

beforeEach(() => {
  // The engine reads window.confirm on exit; never hit in these tests, but
  // jsdom throws "not implemented" if something does reach it.
  vi.stubGlobal('confirm', () => true)
})

afterEach(() => {
  cleanup()
  act(() => {
    useAppStore.getState().resetQuiz()
  })
  vi.unstubAllGlobals()
})

describe('QuizEngine — advancing between questions of different types', () => {
  it('does not throw when going from multiple_choice to true_false', () => {
    startQuizWith([multipleChoice, trueFalse])
    render(<QuizEngine />)

    answerMultipleChoice(1)
    expect(screen.getByText('Correcto')).toBeTruthy()

    // This is the click that crashes in production.
    expect(() => {
      act(() => {
        screen.getByRole('button', { name: /Siguiente/ }).click()
      })
    }).not.toThrow()

    expect(screen.getByText(trueFalse.question)).toBeTruthy()
  })

  it('renders the true_false input, not a blank question, after the transition', () => {
    startQuizWith([multipleChoice, trueFalse])
    render(<QuizEngine />)

    answerMultipleChoice(1)
    act(() => {
      screen.getByRole('button', { name: /Siguiente/ }).click()
    })

    // AnswerInput returns null on a question/selection mismatch, so a stale
    // selection that does NOT throw would still leave the student with no
    // way to answer. Both failure modes have to be covered.
    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '')
    expect(labels.some((label) => /Verdadero/i.test(label))).toBe(true)
    expect(labels.some((label) => /Falso/i.test(label))).toBe(true)
  })

  it('does not throw when going from multiple_choice to numeric', () => {
    startQuizWith([multipleChoice, numeric])
    render(<QuizEngine />)

    answerMultipleChoice(1)

    expect(() => {
      act(() => {
        screen.getByRole('button', { name: /Siguiente/ }).click()
      })
    }).not.toThrow()

    expect(screen.getByText(numeric.question)).toBeTruthy()
  })

  it('still works for a same-type transition (the case that never broke)', () => {
    const secondMultipleChoice: Question = { ...multipleChoice, id: 'q1b', question: '¿Cuánto es 2 + 2?' }
    startQuizWith([multipleChoice, secondMultipleChoice])
    render(<QuizEngine />)

    answerMultipleChoice(1)
    act(() => {
      screen.getByRole('button', { name: /Siguiente/ }).click()
    })

    expect(screen.getByText(secondMultipleChoice.question)).toBeTruthy()
  })
})
