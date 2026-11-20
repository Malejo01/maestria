// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TarjetaDeTarea } from './tarjeta-de-tarea'
import { minutosEstimados, resumirPlan, tamanoDeTarea } from '@/lib/diagnostico'

afterEach(cleanup)

const tarea = (questionCount: number) => ({
  title: 'Fracciones',
  questionCount,
  state: 'disponible' as const,
  dueAt: null,
  opensAt: null,
  attemptsUsed: 0,
  maxAttempts: null,
  bestScore: null,
})

function dibujar(preguntas: number) {
  render(
    <ul>
      <TarjetaDeTarea assignment={tarea(preguntas)} materia="Matemática" docente="Irina" principal abriendo={false} alEmpezar={() => {}} />
    </ul>,
  )
}

describe('L5 · la tarjeta dice cuántas preguntas tiene la tarea', () => {
  it('con una sola pregunta, en singular', () => {
    dibujar(1)
    expect(screen.getByText(/^1 pregunta · unos 5 min/)).toBeTruthy()
  })

  it('con 40 preguntas', () => {
    dibujar(40)
    expect(screen.getByText(/^40 preguntas · unos 50 min/)).toBeTruthy()
  })

  it('el tiempo es la misma estimación que el resumen del diagnóstico', () => {
    for (const n of [1, 6, 15, 28, 40]) {
      const plan = [{ unidadId: null, titulo: '', temas: [], total: n }]
      expect(minutosEstimados(n)).toBe(resumirPlan(plan).minutos)
    }
    expect(tamanoDeTarea(15)).toBe('15 preguntas · unos 20 min')
  })
})
