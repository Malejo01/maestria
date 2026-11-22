// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CorregirTiposDialog } from './corregir-tipos-dialog'
import { guardarPreguntas } from '@/lib/guardar-preguntas'
import type { Question, TeacherQuiz } from '@/lib/types'

/**
 * N2. El diálogo de antes → después: todas tildadas, se puede destildar una,
 * y nada se guarda antes de Aplicar. Y el guardado de Mis tareas: con intentos,
 * copia.
 */
vi.mock('@/components/latex-renderer', () => ({ LaTeXRenderer: ({ content }: { content: string }) => <span>{content}</span> }))

const siNo: Question = {
  id: 'q1', type: 'true_false', topic: 'div', topicName: 'Divisibilidad',
  question: 'Aplicando el criterio, ¿es el número 1.242 divisible por 9?', correctAnswer: true, explanation: '',
}
const abierta: Question = {
  id: 'q2', type: 'true_false', topic: 'ine', topicName: 'Inecuaciones',
  question: 'Al multiplicar por un negativo, ¿qué sucede con el sentido de la desigualdad?', correctAnswer: true, explanation: '',
}
const siNoCorregida: Question = { ...siNo, question: 'El número 1.242 es divisible por 9.', origin: 'ai_regenerada' }
const abiertaCorregida: Question = {
  id: 'q2', type: 'multiple_choice', topic: 'ine', topicName: 'Inecuaciones',
  question: '¿Qué pasa con el sentido de la desigualdad?', options: ['Se invierte', 'Se mantiene', 'Desaparece', 'Depende'], correctAnswer: 0, explanation: '',
}

const pedidos: { url: string; init?: RequestInit }[] = []
let respuestas: Record<string, { status: number; cuerpo: unknown }[]> = {}

beforeEach(() => {
  pedidos.length = 0
  respuestas = {
    corregir: [{
      status: 200,
      cuerpo: { propuestas: [
        { indice: 0, problema: 'vf-pregunta-si-no', antes: siNo, despues: siNoCorregida, via: 'ia' },
        { indice: 1, problema: 'vf-pregunta-abierta', antes: abierta, despues: abiertaCorregida, via: 'ia' },
      ] },
    }],
  }
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    pedidos.push({ url, init })
    const clave = url.endsWith('/corregir-tipos') ? 'corregir' : 'patch'
    const r = respuestas[clave]?.shift() ?? { status: 500, cuerpo: {} }
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: { 'Content-Type': 'application/json' } })
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('CorregirTiposDialog', () => {
  it('muestra antes → después con todas tildadas y aplica sólo las elegidas', async () => {
    const alAplicar = vi.fn()
    render(<CorregirTiposDialog quizId={41} preguntas={[siNo, abierta]} abierto onOpenChange={() => {}} alAplicar={alAplicar} />)
    expect(await screen.findByText('El número 1.242 es divisible por 9.')).toBeTruthy()
    expect(screen.getByText('Se invierte')).toBeTruthy()
    const casillas = screen.getAllByRole('checkbox')
    expect(casillas.every((c) => c.getAttribute('aria-checked') === 'true')).toBe(true)

    // Nada se guardó todavía: el único pedido fue el de las propuestas.
    expect(pedidos.map((p) => p.url)).toEqual(['/api/teacher/quizzes/41/corregir-tipos'])

    await userEvent.click(casillas[1])
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar 1 cambio' }))
    expect(alAplicar).toHaveBeenCalledWith([siNoCorregida, abierta], 1)
  })

  it('una que no se pudo corregir queda como está, sin casilla', async () => {
    respuestas.corregir = [{ status: 200, cuerpo: { propuestas: [
      { indice: 0, problema: 'vf-pregunta-si-no', antes: siNo, despues: null, via: 'ia', motivo: 'La IA cambió el valor de verdad.' },
    ] } }]
    render(<CorregirTiposDialog quizId={41} preguntas={[siNo]} abierto onOpenChange={() => {}} alAplicar={() => {}} />)
    expect(await screen.findByText(/La IA cambió el valor de verdad/)).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
  })
})

describe('guardarPreguntas (Mis tareas)', () => {
  const quiz = { id: 41, questions: [siNo], questionCount: 1, title: 'x' } as unknown as TeacherQuiz

  it('sin intentos guarda en el lugar', async () => {
    respuestas.patch = [{ status: 200, cuerpo: { quiz: { id: 41, question_count: 1, questions: [siNoCorregida] } } }]
    const r = await guardarPreguntas(quiz, [siNoCorregida])
    expect(r).toMatchObject({ ok: true, copiado: false, quiz: { id: 41 } })
    expect(JSON.parse(String(pedidos[0].init?.body)).strategy).toBe('in_place')
  })

  it('con intentos (409) guarda como copia y mueve las asignaciones', async () => {
    respuestas.patch = [
      { status: 409, cuerpo: { requiresDecision: true, impact: {} } },
      { status: 200, cuerpo: { quiz: { id: 52, question_count: 1, questions: [siNoCorregida] }, copiado: true, reasignadas: 2 } },
    ]
    const r = await guardarPreguntas(quiz, [siNoCorregida])
    expect(r).toMatchObject({ ok: true, copiado: true, reasignadas: 2, quiz: { id: 52 } })
    await waitFor(() => expect(pedidos).toHaveLength(2))
    expect(JSON.parse(String(pedidos[1].init?.body)).strategy).toBe('copy')
  })
})
