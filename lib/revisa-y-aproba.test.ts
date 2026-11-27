import { describe, expect, it } from 'vitest'
import { alternarAprobada, aprobarTodas, claveDePregunta, contarRevisadas, textoDelContador } from './revisa-y-aproba'

const preguntas = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}` }))

describe('el contador de «Revisá y aprobá» (AB7)', () => {
  it('«7 de 10 revisadas» y el singular', () => {
    let aprobadas = new Set<string>()
    for (let i = 0; i < 7; i++) aprobadas = alternarAprobada(aprobadas, claveDePregunta(preguntas[i], i))
    expect(textoDelContador(contarRevisadas(preguntas, aprobadas), preguntas.length)).toBe('7 de 10 revisadas')
    expect(textoDelContador(1, 1)).toBe('1 de 1 revisada')
    expect(textoDelContador(0, 3)).toBe('0 de 3 revisadas')
  })

  it('aprobar dos veces la misma la desaprueba', () => {
    const una = alternarAprobada(new Set(), 'q1')
    expect(una.has('q1')).toBe(true)
    expect(alternarAprobada(una, 'q1').has('q1')).toBe(false)
  })

  it('una aprobada que se quitó (o se regeneró con otro id) deja de contar', () => {
    const aprobadas = aprobarTodas(preguntas)
    expect(contarRevisadas(preguntas, aprobadas)).toBe(10)
    const sinLaTercera = preguntas.filter((p) => p.id !== 'q3')
    expect(contarRevisadas(sinLaTercera, aprobadas)).toBe(9)
    const regenerada = preguntas.map((p) => (p.id === 'q4' ? { id: 'q4-nueva' } : p))
    expect(contarRevisadas(regenerada, aprobadas)).toBe(9)
  })

  it('sin id, la clave es el lugar', () => {
    expect(claveDePregunta({}, 2)).toBe('#2')
    expect(contarRevisadas([{}, {}], aprobarTodas([{}, {}]))).toBe(2)
  })
})
