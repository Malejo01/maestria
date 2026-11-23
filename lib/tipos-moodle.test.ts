import { describe, expect, it } from 'vitest'
import {
  cantidadDeHuecos,
  corregirHuecos,
  huecosValidos,
  partesDelTexto,
  corregirOrden,
  moverEnOrden,
  ordenInicial,
  ordenamientoValido,
  barajarFijo,
  corregirEmparejamiento,
  emparejamientoValido,
  respuestasDelEmparejamiento,
  corregirVariasCorrectas,
  correctaEnTexto,
  fraccionesVariasCorrectas,
  payloadDeRespuesta,
  problemaDeTipoMoodle,
  respuestaEnTexto,
  respuestaGuardadaEnTexto,
  variasCorrectasValida,
} from './tipos-moodle'
import { fraccionValida } from './moodle-xml-validar'
import type { Answer, Question } from './types'

const VARIAS: Question = {
  id: 'q1',
  type: 'multiple_response',
  topic: 't',
  topicName: 'Cultura',
  question: '¿Cuáles son rasgos de la cultura según la antropología? Marcá todas las que correspondan.',
  options: ['Se aprende', 'Es innata', 'Se comparte', 'Es individual', 'Es simbólica'],
  correctAnswers: [0, 2, 4],
  explanation: '',
}

describe('F2 · varias correctas', () => {
  it('se corrige todo o nada: exactamente las correctas, en cualquier orden', () => {
    expect(corregirVariasCorrectas([0, 2, 4], [4, 0, 2])).toBe(true)
    expect(corregirVariasCorrectas([0, 2, 4], [0, 2])).toBe(false)
    expect(corregirVariasCorrectas([0, 2, 4], [0, 1, 2, 4])).toBe(false)
    expect(corregirVariasCorrectas([0, 2, 4], [])).toBe(false)
  })

  it('sirve con entre 2 y n−1 correctas, índices válidos y sin opciones vacías', () => {
    expect(variasCorrectasValida(VARIAS as Extract<Question, { type: 'multiple_response' }>)).toBe(true)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [1] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 1, 2] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 5] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', 'b', 'c'], correctAnswers: [0, 0] })).toBe(false)
    expect(variasCorrectasValida({ options: ['a', '', 'c'], correctAnswers: [0, 2] })).toBe(false)
    expect(problemaDeTipoMoodle({ type: 'multiple_response', options: ['a', 'b', 'c'], correctAnswers: [1] })).toMatch(/varias correctas/)
    expect(problemaDeTipoMoodle(VARIAS as unknown as Record<string, unknown>)).toBeNull()
  })

  it('las fracciones de Moodle: las correctas suman 100 y todas son de las que Moodle acepta', () => {
    for (const [n, correctas] of [[5, [0, 2, 4]], [4, [1, 3]], [6, [0, 1, 2, 3]], [5, [0, 1]]] as const) {
      const f = fraccionesVariasCorrectas(n, correctas)
      expect(f.every(fraccionValida)).toBe(true)
      expect(Math.abs(f.filter((x) => x > 0).reduce((s, x) => s + x, 0) - 100)).toBeLessThan(0.01)
    }
    expect(fraccionesVariasCorrectas(5, [0, 2, 4])).toEqual([33.33333, -50, 33.33333, -50, 33.33333])
  })

  it('en texto: las letras y las opciones, en orden', () => {
    expect(correctaEnTexto(VARIAS)).toBe('A) Se aprende · C) Se comparte · E) Es simbólica')
    const respuesta: Answer = {
      type: 'multiple_response',
      questionId: 'q1',
      questionText: VARIAS.question,
      isCorrect: false,
      topic: 't',
      topicName: 'Cultura',
      explanation: '',
      options: (VARIAS as Extract<Question, { type: 'multiple_response' }>).options,
      selectedAnswers: [2, 0],
      correctAnswers: [0, 2, 4],
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('A) Se aprende · C) Se comparte')
    const payload = payloadDeRespuesta(respuesta)
    expect(payload).toMatchObject({ tipo: 'multiple_response', selectedAnswers: [2, 0], selectedText: 'A) Se aprende · C) Se comparte', acceptedAnswers: ['A) Se aprende · C) Se comparte · E) Es simbólica'] })
    // Leída de vuelta: con su tipo, o guardada como respuesta corta (sin la 042).
    expect(respuestaGuardadaEnTexto('multiple_response', payload)).toEqual({ tipo: 'multiple_response', elegido: 'A) Se aprende · C) Se comparte', correcto: 'A) Se aprende · C) Se comparte · E) Es simbólica' })
    expect(respuestaGuardadaEnTexto('short_answer', payload)?.tipo).toBe('multiple_response')
    expect(respuestaGuardadaEnTexto('short_answer', { selectedText: 'x', acceptedAnswers: ['y'] })).toBeNull()
  })
})

const EMPAREJAR: Extract<Question, { type: 'matching' }> = {
  id: 'q2',
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

describe('F3 · emparejamiento', () => {
  it('todo o nada, sin importar espacios de más', () => {
    expect(corregirEmparejamiento(EMPAREJAR.pairs, ['Descripción densa', 'Estructuralismo', ' Observación  participante '])).toBe(true)
    expect(corregirEmparejamiento(EMPAREJAR.pairs, ['Descripción densa', 'Observación participante', 'Estructuralismo'])).toBe(false)
    expect(corregirEmparejamiento(EMPAREJAR.pairs, ['Descripción densa', 'Estructuralismo', null])).toBe(false)
  })

  it('sirve con 3 a 8 pares distintos y distractores que no son respuestas', () => {
    expect(emparejamientoValido(EMPAREJAR)).toBe(true)
    expect(emparejamientoValido({ pairs: EMPAREJAR.pairs.slice(0, 2) })).toBe(false)
    expect(emparejamientoValido({ pairs: [...EMPAREJAR.pairs.slice(0, 2), { left: 'Boas', right: 'Estructuralismo' }] })).toBe(false)
    expect(emparejamientoValido({ pairs: [...EMPAREJAR.pairs.slice(0, 2), { left: 'Geertz', right: 'Otra' }] })).toBe(false)
    expect(emparejamientoValido({ pairs: EMPAREJAR.pairs, distractors: ['Estructuralismo'] })).toBe(false)
    expect(emparejamientoValido({ pairs: [...EMPAREJAR.pairs.slice(0, 2), { left: 'Boas', right: '' }] })).toBe(false)
  })

  it('las respuestas que se ofrecen: las de los pares y los distractores, barajadas siempre igual', () => {
    expect(respuestasDelEmparejamiento(EMPAREJAR).sort()).toEqual(['Descripción densa', 'Estructuralismo', 'Evolucionismo', 'Observación participante'])
    const a = barajarFijo(respuestasDelEmparejamiento(EMPAREJAR), 'q2')
    expect(barajarFijo(respuestasDelEmparejamiento(EMPAREJAR), 'q2')).toEqual(a)
    expect([...a].sort()).toEqual(respuestasDelEmparejamiento(EMPAREJAR).sort())
  })

  it('en texto y en el payload', () => {
    expect(correctaEnTexto(EMPAREJAR)).toBe('Geertz → Descripción densa · Lévi-Strauss → Estructuralismo · Malinowski → Observación participante')
    const respuesta: Answer = {
      type: 'matching',
      questionId: 'q2',
      questionText: EMPAREJAR.question,
      isCorrect: false,
      topic: 't',
      topicName: 'Autores',
      explanation: '',
      pairs: EMPAREJAR.pairs,
      selectedRights: ['Descripción densa', 'Evolucionismo', null],
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('Geertz → Descripción densa · Lévi-Strauss → Evolucionismo · Malinowski → —')
    expect(payloadDeRespuesta(respuesta)).toMatchObject({ tipo: 'matching', selectedRights: ['Descripción densa', 'Evolucionismo', null] })
  })
})

describe('F4 · ordenamiento', () => {
  const ORDENAR = { id: 'q3', items: ['Recolección', 'Agricultura', 'Industria', 'Servicios'] }

  it('todo o nada: el orden exacto', () => {
    expect(corregirOrden([0, 1, 2, 3])).toBe(true)
    expect(corregirOrden([1, 0, 2, 3])).toBe(false)
    expect(corregirOrden([])).toBe(false)
  })

  it('subir y bajar cambian de lugar con el vecino; en los bordes no hacen nada', () => {
    expect(moverEnOrden([2, 0, 1], 1, -1)).toEqual([0, 2, 1])
    expect(moverEnOrden([2, 0, 1], 1, 1)).toEqual([2, 1, 0])
    expect(moverEnOrden([2, 0, 1], 0, -1)).toEqual([2, 0, 1])
    expect(moverEnOrden([2, 0, 1], 2, 1)).toEqual([2, 0, 1])
  })

  it('arranca barajado, siempre igual para la pregunta, y nunca ya ordenado', () => {
    const a = ordenInicial(ORDENAR)
    expect(ordenInicial(ORDENAR)).toEqual(a)
    expect([...a].sort()).toEqual([0, 1, 2, 3])
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) {
      expect(corregirOrden(ordenInicial({ id, items: ['x', 'y', 'z'] }))).toBe(false)
    }
  })

  it('sirve con 3 a 8 elementos escritos y distintos', () => {
    expect(ordenamientoValido(ORDENAR)).toBe(true)
    expect(ordenamientoValido({ items: ['a', 'b'] })).toBe(false)
    expect(ordenamientoValido({ items: ['a', 'b', 'A'] })).toBe(false)
    expect(ordenamientoValido({ items: ['a', '', 'c'] })).toBe(false)
  })

  it('en texto y en el payload', () => {
    const respuesta: Answer = {
      type: 'ordering',
      questionId: 'q3',
      questionText: 'Ordená',
      isCorrect: false,
      topic: 't',
      topicName: 'Etapas',
      explanation: '',
      items: ORDENAR.items,
      selectedOrder: [1, 0, 2, 3],
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('1. Agricultura · 2. Recolección · 3. Industria · 4. Servicios')
    expect(respuestaEnTexto(respuesta, 'correct')).toBe('1. Recolección · 2. Agricultura · 3. Industria · 4. Servicios')
    expect(payloadDeRespuesta(respuesta)).toMatchObject({ tipo: 'ordering', selectedOrder: [1, 0, 2, 3] })
  })
})

describe('F5 · huecos (seleccionar y arrastrar)', () => {
  const HUECOS = {
    id: 'q4',
    type: 'gapselect' as const,
    topic: 't',
    topicName: 'Mercado',
    question: 'Completá el texto.',
    text: 'Si sube el [[1]], baja la [[2]] demandada; la curva de [[3]] tiene pendiente negativa.',
    choices: ['precio', 'cantidad', 'demanda', 'oferta', 'renta'],
    explanation: '',
  }

  it('parte el texto en lo que se lee y los huecos', () => {
    expect(partesDelTexto('A [[1]] b [[2]].')).toEqual([
      { tipo: 'texto', texto: 'A ' },
      { tipo: 'hueco', hueco: 1 },
      { tipo: 'texto', texto: ' b ' },
      { tipo: 'hueco', hueco: 2 },
      { tipo: 'texto', texto: '.' },
    ])
    expect(cantidadDeHuecos(HUECOS.text)).toBe(3)
  })

  it('todo o nada: en cada hueco su palabra', () => {
    expect(corregirHuecos([0, 1, 2], 3)).toBe(true)
    expect(corregirHuecos([0, 2, 1], 3)).toBe(false)
    expect(corregirHuecos([0, 1, null], 3)).toBe(false)
  })

  it('sirve con 3 a 6 huecos numerados 1..k, una palabra para cada uno, distractores y todo distinto', () => {
    expect(huecosValidos(HUECOS)).toBe(true)
    expect(huecosValidos({ text: 'A [[1]] b [[2]].', choices: ['x', 'y', 'z'] })).toBe(false)
    expect(huecosValidos({ text: 'A [[1]] b [[3]] c [[4]].', choices: ['x', 'y', 'z', 'w'] })).toBe(false)
    expect(huecosValidos({ text: 'A [[1]] b [[1]] c [[2]].', choices: ['x', 'y', 'z'] })).toBe(false)
    expect(huecosValidos({ text: HUECOS.text, choices: ['precio', 'cantidad'] })).toBe(false)
    expect(huecosValidos({ text: HUECOS.text, choices: ['precio', 'cantidad', 'Precio'] })).toBe(false)
  })

  it('en texto: lo de cada hueco entre corchetes', () => {
    expect(correctaEnTexto(HUECOS)).toBe('Si sube el [precio], baja la [cantidad] demandada; la curva de [demanda] tiene pendiente negativa.')
    const respuesta: Answer = {
      type: 'ddwtos',
      questionId: 'q4',
      questionText: HUECOS.question,
      isCorrect: false,
      topic: 't',
      topicName: 'Mercado',
      explanation: '',
      text: HUECOS.text,
      choices: HUECOS.choices,
      selectedChoices: [0, 3, null],
    }
    expect(respuestaEnTexto(respuesta, 'selected')).toBe('Si sube el [precio], baja la [oferta] demandada; la curva de [___] tiene pendiente negativa.')
    expect(payloadDeRespuesta(respuesta)).toMatchObject({ tipo: 'ddwtos', selectedChoices: [0, 3, null] })
  })
})
