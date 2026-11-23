import { describe, expect, it } from 'vitest'
import { barajarConSemilla, preguntaEnTema, versionDelExamen } from './examen-ab'

const base = { topic: 't', topicName: 'Tema', explanation: '' }
const PREGUNTAS: Record<string, unknown>[] = [
  { ...base, id: 'q1', type: 'multiple_choice', question: '¿Capital de Francia?', options: ['París', 'Roma', 'Madrid', 'Lisboa'], correctAnswer: 0 },
  { ...base, id: 'q2', type: 'true_false', question: 'El agua hierve a 100 °C.', correctAnswer: true },
  { ...base, id: 'q3', type: 'multiple_response', question: '¿Cuáles son pares?', options: ['2', '3', '4', '5'], correctAnswers: [0, 2] },
  {
    ...base,
    id: 'q4',
    type: 'matching',
    question: 'Uní.',
    pairs: [
      { left: 'Perro', right: 'Ladra' },
      { left: 'Gato', right: 'Maúlla' },
      { left: 'Vaca', right: 'Muge' },
    ],
    distractors: ['Ruge'],
  },
  { ...base, id: 'q5', type: 'ordering', question: 'Ordená de menor a mayor.', items: ['1', '2', '3', '4'] },
  { ...base, id: 'q6', type: 'gapselect', question: 'Completá.', text: 'El [[1]] y la [[2]] y el [[3]].', choices: ['sol', 'luna', 'mar', 'cielo'] },
  {
    ...base,
    id: 'q7',
    type: 'calculated',
    question: 'Cuesta 100 y sube 10 %.',
    plantilla: 'Cuesta {p} y sube {x} %. ¿Cuánto cuesta?',
    formula: '{p} * (1 + {x} / 100)',
    variables: [
      { name: 'p', min: 100, max: 900, decimals: 0 },
      { name: 'x', min: 5, max: 30, decimals: 0 },
    ],
    valores: { p: 100, x: 10 },
    correctAnswer: 110,
    tolerance: 0.01,
  },
  { ...base, id: 'q8', type: 'missing_word', question: 'Elegí.', text: 'Es [[1]].', options: ['rojo', 'azul', 'verde'], correctAnswer: 1 },
]

describe('el examen con temas A y B (W4)', () => {
  it('siempre igual para la misma tarea y tema (con semilla)', () => {
    expect(versionDelExamen(PREGUNTAS, 'B', 'tarea-7')).toEqual(versionDelExamen(PREGUNTAS, 'B', 'tarea-7'))
    expect(barajarConSemilla([1, 2, 3, 4, 5], 'x')).toEqual(barajarConSemilla([1, 2, 3, 4, 5], 'x'))
  })

  it('A mantiene el orden de las preguntas y B lo baraja; las dos tienen todas', () => {
    const a = versionDelExamen(PREGUNTAS, 'A', 'tarea-7')
    const b = versionDelExamen(PREGUNTAS, 'B', 'tarea-7')
    expect(a.map((p) => p.enunciado.split('\n')[0])).toEqual(PREGUNTAS.map((p) => String(p.question).split('\n')[0]).map((t, i) => (i === 6 ? a[6].enunciado.split('\n')[0] : t)))
    expect(b.map((p) => p.enunciado)).not.toEqual(a.map((p) => p.enunciado))
    expect(new Set(b.map((p) => p.enunciado.slice(0, 8))).size).toBe(8)
  })

  it('la correcta sigue a su opción al barajar', () => {
    for (const tema of ['A', 'B'] as const) {
      const mc = versionDelExamen(PREGUNTAS, tema, 'tarea-7').find((p) => p.enunciado === '¿Capital de Francia?')!
      expect(mc.papel.forma).toBe('opciones')
      const letra = mc.correcta[0]
      const opciones = (mc.papel as { opciones: string[] }).opciones
      expect(opciones['ABCD'.indexOf(letra)]).toBe('París')
    }
    const varias = preguntaEnTema(PREGUNTAS[2], 3, 's')
    expect(varias.papel).toMatchObject({ forma: 'opciones', varias: true })
  })

  it('la calculada trae sus propios números en cada tema', () => {
    const a = versionDelExamen(PREGUNTAS, 'A', 'tarea-7').find((p) => p.enunciado.startsWith('Cuesta'))!
    const b = versionDelExamen(PREGUNTAS, 'B', 'tarea-7').find((p) => p.enunciado.startsWith('Cuesta'))!
    expect(a.enunciado).not.toBe(b.enunciado)
    expect(a.enunciado).not.toContain('{p}')
  })

  it('cada tipo sale en papel con su forma y su respuesta para el docente', () => {
    const unir = preguntaEnTema(PREGUNTAS[3], 4, 's')
    expect(unir.papel).toMatchObject({ forma: 'unir' })
    expect((unir.papel as { derecha: string[] }).derecha).toHaveLength(4)
    expect(unir.correcta.split(' · ')).toHaveLength(3)
    const ordenar = preguntaEnTema(PREGUNTAS[4], 5, 's')
    expect((ordenar.papel as { pasos: string[] }).pasos).not.toEqual(['1', '2', '3', '4'])
    expect(ordenar.correcta.split(' → ')).toHaveLength(4)
    const huecos = preguntaEnTema(PREGUNTAS[5], 6, 's')
    expect(huecos.papel).toMatchObject({ forma: 'huecos', texto: 'El (1) __________ y la (2) __________ y el (3) __________.' })
    expect(huecos.correcta).toBe('(1) sol · (2) luna · (3) mar')
    const faltante = preguntaEnTema(PREGUNTAS[7], 8, 's')
    expect(faltante.enunciado).toContain('Es __________.')
    expect(faltante.correcta).toMatch(/azul$/)
    expect(preguntaEnTema(PREGUNTAS[1], 2, 's').papel.forma).toBe('verdadero_falso')
  })
})

describe('el ensayo en papel (W5)', () => {
  it('sale con lo que se va a mirar y la rúbrica en la hoja del docente', () => {
    const p = preguntaEnTema({ type: 'essay', question: 'Explicá la fotosíntesis.', rubrica: [{ criterio: 'Define' }, { criterio: 'Ejemplo' }, { criterio: 'Relaciona' }], explanation: '' }, 1, 's')
    expect(p.papel).toEqual({ forma: 'ensayo', criterios: ['Define', 'Ejemplo', 'Relaciona'] })
    expect(p.correcta).toContain('rúbrica')
  })
})
