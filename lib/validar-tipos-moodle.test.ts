import { describe, expect, it } from 'vitest'
import { normalizarPalabra, pareceLaMisma, problemaDeCalidad } from './validar-tipos-moodle'

const base = { id: 'q', topic: 't', topicName: 'Tema', explanation: '' }

describe('pareceLaMisma', () => {
  it('junta tildes, mayúsculas, artículos, plural y género', () => {
    expect(pareceLaMisma('La Cultura', 'cultura')).toBe(true)
    expect(pareceLaMisma('etnocéntrico', 'Etnocentrico')).toBe(true)
    expect(pareceLaMisma('culturales', 'cultural')).toBe(true)
    expect(pareceLaMisma('simbólica', 'simbólico')).toBe(true)
  })
  it('una letra de diferencia sólo en palabras largas', () => {
    expect(pareceLaMisma('relativismo', 'relativsmo')).toBe(true)
    expect(pareceLaMisma('casa', 'cosa')).toBe(false)
  })
  it('palabras distintas no', () => {
    expect(pareceLaMisma('etnocentrismo', 'relativismo')).toBe(false)
    expect(pareceLaMisma('oferta', 'demanda')).toBe(false)
  })
  it('normalizarPalabra', () => {
    expect(normalizarPalabra('  El  Método, científico! ')).toBe('metodo cientifico')
  })
})

describe('emparejamiento', () => {
  const pares = [
    { left: 'Malinowski', right: 'Observación participante' },
    { left: 'Geertz', right: 'Descripción densa' },
    { left: 'Lévi-Strauss', right: 'Estructuralismo' },
  ]
  it('uno bueno pasa', () => {
    expect(problemaDeCalidad({ ...base, type: 'matching', question: 'Uní', pairs: pares })).toBeNull()
  })
  it('entre 3 y 6 pares', () => {
    expect(problemaDeCalidad({ ...base, type: 'matching', pairs: pares.slice(0, 2) })).toBe('emparejamiento-cantidad')
    const siete = Array.from({ length: 7 }, (_, i) => ({ left: `Autor número ${i}`, right: `Concepto distinto ${'abcdefg'[i]}x${i}` }))
    expect(problemaDeCalidad({ ...base, type: 'matching', pairs: siete })).toBe('emparejamiento-cantidad')
  })
  it('respuestas que se confunden', () => {
    const repetidas = [...pares.slice(0, 2), { left: 'Boas', right: 'La descripción densa' }]
    expect(problemaDeCalidad({ ...base, type: 'matching', pairs: repetidas })).toBe('emparejamiento-repetido')
  })
  it('un distractor que es una respuesta', () => {
    expect(problemaDeCalidad({ ...base, type: 'matching', pairs: pares, distractors: ['estructuralismos'] })).toBe('emparejamiento-repetido')
  })
  it('un par que repite la misma palabra', () => {
    const iguales = [...pares.slice(0, 2), { left: 'Estructuralismo', right: 'estructuralismo' }]
    expect(problemaDeCalidad({ ...base, type: 'matching', pairs: iguales })).toBe('emparejamiento-par-igual')
  })
})

describe('ordenamiento', () => {
  it('con criterio y pasos distintos pasa', () => {
    expect(
      problemaDeCalidad({ ...base, type: 'ordering', question: 'Ordená de la más antigua a la más reciente.', items: ['Paleolítico', 'Neolítico', 'Edad de los metales'] }),
    ).toBeNull()
    expect(
      problemaDeCalidad({ ...base, type: 'ordering', question: 'Ordená los pasos del trabajo de campo.', items: ['Elegir el problema', 'Entrar al campo', 'Escribir'] }),
    ).toBeNull()
  })
  it('sin criterio de orden en la consigna', () => {
    expect(problemaDeCalidad({ ...base, type: 'ordering', question: 'Ordená estos conceptos.', items: ['Cultura', 'Sociedad', 'Rito'] })).toBe(
      'ordenamiento-sin-criterio',
    )
  })
  it('dos pasos intercambiables', () => {
    expect(
      problemaDeCalidad({
        ...base,
        type: 'ordering',
        question: 'Ordená los pasos.',
        items: ['Registrar las observaciones del campo', 'Registrar observaciones en el campo', 'Analizar'],
      }),
    ).toBe('ordenamiento-intercambiable')
  })
})

describe('huecos y palabra faltante', () => {
  it('uno bueno pasa', () => {
    expect(
      problemaDeCalidad({ ...base, type: 'gapselect', question: 'Completá', text: 'Si sube el [[1]], baja la [[2]] y la [[3]].', choices: ['precio', 'cantidad', 'demanda', 'oferta'] }),
    ).toBeNull()
  })
  it('un hueco sin su respuesta', () => {
    expect(problemaDeCalidad({ ...base, type: 'ddwtos', text: 'El [[1]] y el [[2]] y el [[4]].', choices: ['a1', 'b2', 'c3'] })).toBe('huecos-sin-respuesta')
  })
  it('una opción que es la misma palabra que otra', () => {
    expect(
      problemaDeCalidad({ ...base, type: 'gapselect', text: 'El [[1]], la [[2]] y el [[3]].', choices: ['precio', 'cantidad', 'demanda', 'precios'] }),
    ).toBe('huecos-sinonimo')
  })
  it('palabra faltante con una incorrecta igual a la correcta', () => {
    expect(problemaDeCalidad({ ...base, type: 'missing_word', text: 'Eso es [[1]].', options: ['etnocentrismo', 'Etnocentrismo.', 'relativismo'], correctAnswer: 0 })).toBe(
      'palabra-faltante-sinonimo',
    )
    expect(problemaDeCalidad({ ...base, type: 'missing_word', text: 'Eso es [[1]].', options: ['etnocentrismo', 'evolucionismo', 'relativismo'], correctAnswer: 0 })).toBeNull()
  })
})

describe('calculada', () => {
  const buena = {
    ...base,
    type: 'calculated',
    question: 'Cuesta {p} pesos y sube un {x} %. ¿Cuánto cuesta ahora?',
    formula: '{p} * (1 + {x} / 100)',
    variables: [
      { name: 'p', min: 100, max: 500, decimals: 0 },
      { name: 'x', min: 5, max: 20, decimals: 0 },
    ],
    tolerance: 0.01,
  }
  it('una buena pasa', () => {
    expect(problemaDeCalidad(buena)).toBeNull()
  })
  it('una fórmula que no se evalúa (sin eval: ^ es un error)', () => {
    expect(problemaDeCalidad({ ...buena, formula: '{p} ^ {x}' })).toBe('calculada-formula')
  })
  it('comodines que no coinciden', () => {
    expect(problemaDeCalidad({ ...buena, question: 'Cuesta {p} pesos. ¿Cuánto cuesta ahora?' })).toBe('calculada-comodines')
    expect(problemaDeCalidad({ ...buena, formula: '{p} * 1.1' })).toBe('calculada-comodines')
  })
  it('un rango que divide por cero en algún juego de valores', () => {
    expect(
      problemaDeCalidad({
        ...buena,
        question: 'Dividí {a} por {b}.',
        formula: '{a} / {b}',
        variables: [
          { name: 'a', min: 1, max: 10, decimals: 0 },
          { name: 'b', min: 0, max: 1, decimals: 0 },
        ],
      }),
    ).toBe('calculada-valores')
  })
  it('una respuesta guardada que no sale de la fórmula', () => {
    expect(problemaDeCalidad({ ...buena, plantilla: buena.question, question: 'Cuesta 200…', valores: { p: 200, x: 10 }, correctAnswer: 230 })).toBe(
      'calculada-correcta',
    )
    expect(problemaDeCalidad({ ...buena, plantilla: buena.question, question: 'Cuesta 200…', valores: { p: 200, x: 10 }, correctAnswer: 220 })).toBeNull()
  })
})

describe('varias correctas', () => {
  it('al menos 2 correctas y 1 incorrecta', () => {
    expect(problemaDeCalidad({ ...base, type: 'multiple_response', options: ['a', 'b', 'c'], correctAnswers: [0, 1, 2] })).toBe('varias-correctas-cantidad')
    expect(problemaDeCalidad({ ...base, type: 'multiple_response', options: ['a', 'b', 'c'], correctAnswers: [0] })).toBe('varias-correctas-cantidad')
    expect(problemaDeCalidad({ ...base, type: 'multiple_response', options: ['Sal', 'Insulina', 'Viajes'], correctAnswers: [0, 1] })).toBeNull()
  })
  it('dos opciones que son la misma', () => {
    expect(problemaDeCalidad({ ...base, type: 'multiple_response', options: ['Sal', 'La sal', 'Viajes', 'Joyas'], correctAnswers: [0, 2] })).toBe(
      'varias-correctas-repetida',
    )
  })
})

it('los otros tipos no se miran', () => {
  expect(problemaDeCalidad({ ...base, type: 'multiple_choice', options: ['a', 'a'], correctAnswer: 0 })).toBeNull()
})

it('con números o símbolos, sólo lo idéntico cuenta como lo mismo', () => {
  expect(pareceLaMisma('x^2', 'x·2')).toBe(false)
  expect(pareceLaMisma('2x', '2 x')).toBe(true)
  expect(pareceLaMisma('1810', '1816')).toBe(false)
})

it('definiciones que difieren en una palabra clave no se confunden (caso real de staging)', () => {
  expect(
    problemaDeCalidad({
      type: 'matching',
      question: 'Uní cada concepto con su definición técnica correspondiente.',
      pairs: [
        { left: 'Demanda elástica', right: 'Variación porcentual de cantidad mayor al precio' },
        { left: 'Demanda inelástica', right: 'Variación porcentual de cantidad menor al precio' },
        { left: 'Movimiento a lo largo', right: 'Cambio causado exclusivamente por el precio' },
        { left: 'Desplazamiento de curva', right: 'Cambio causado por factores exógenos' },
      ],
      distractors: ['Cambio en la oferta monetaria'],
    }),
  ).toBeNull()
})
