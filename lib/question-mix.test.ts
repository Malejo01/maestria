import { describe, expect, it } from 'vitest'
import {
  buildQuestionMixInstruction,
  distributeQuestionCounts,
  mergeQuestionTypeMixes,
  parseQuestionTypeMix,
  productionShare,
  questionTypesFromMix,
  restrictQuestionTypeMix,
  type QuestionTypeMix,
} from './question-mix'
import type { QuestionType } from './types'

/**
 * Mezcla de referencia: la de las unidades de cálculo del programa de Matemática
 * de la Tecnicatura Superior en Análisis de Sistemas.
 */
const CALCULO: QuestionTypeMix = {
  numeric: 50,
  short_answer: 25,
  multiple_choice: 20,
  true_false: 5,
}

const countOf = (quotas: { type: QuestionType; count: number }[], type: QuestionType) =>
  quotas.find((quota) => quota.type === type)?.count ?? 0

const totalOf = (quotas: { count: number }[]) => quotas.reduce((sum, quota) => sum + quota.count, 0)

describe('parseQuestionTypeMix', () => {
  it('acepta una mezcla bien formada', () => {
    expect(parseQuestionTypeMix({ numeric: 50, short_answer: 25 })).toEqual({ numeric: 50, short_answer: 25 })
  })

  it('descarta claves que no son tipos de pregunta', () => {
    expect(parseQuestionTypeMix({ numeric: 50, essay: 90 })).toEqual({ numeric: 50 })
  })

  it('descarta pesos que no son números positivos finitos', () => {
    expect(parseQuestionTypeMix({
      numeric: 50,
      short_answer: '30',
      multiple_choice: -10,
      true_false: Number.NaN,
    })).toEqual({ numeric: 50 })
  })

  it('devuelve undefined para lo que no es un objeto de pesos', () => {
    // La columna es JSONB: Postgres garantiza JSON válido y nada más. Lo que no
    // cumple la forma tiene que morir acá y no en el prompt.
    expect(parseQuestionTypeMix(null)).toBeUndefined()
    expect(parseQuestionTypeMix(['numeric'])).toBeUndefined()
    expect(parseQuestionTypeMix('numeric')).toBeUndefined()
    expect(parseQuestionTypeMix({})).toBeUndefined()
    expect(parseQuestionTypeMix({ numeric: 0 })).toBeUndefined()
  })
})

describe('mergeQuestionTypeMixes', () => {
  it('suma los pesos de las unidades elegidas', () => {
    expect(mergeQuestionTypeMixes([
      { numeric: 50, short_answer: 25 },
      { numeric: 25, multiple_choice: 20 },
    ])).toEqual({ numeric: 75, short_answer: 25, multiple_choice: 20 })
  })

  it('sin unidades con mezcla declarada no inventa una', () => {
    expect(mergeQuestionTypeMixes([])).toBeUndefined()
  })

  it('deja que la unidad que más aporta domine el resultado', () => {
    // Un cuestionario de seis unidades de cálculo y una de lógica tiene que
    // parecerse a cálculo. Promediar trataría a la de lógica como a las seis.
    const merged = mergeQuestionTypeMixes([
      ...Array.from({ length: 6 }, () => CALCULO),
      { short_answer: 45, numeric: 25, multiple_choice: 25, true_false: 5 },
    ])!

    expect(questionTypesFromMix(merged)[0]).toBe('numeric')
  })
})

describe('productionShare', () => {
  it('mide el peso de numeric + short_answer sobre el total', () => {
    expect(productionShare(CALCULO)).toBeCloseTo(0.75)
  })

  it('da 0 para una mezcla puramente de reconocimiento', () => {
    expect(productionShare({ multiple_choice: 80, true_false: 20 })).toBe(0)
  })
})

describe('questionTypesFromMix', () => {
  it('ordena de mayor a menor peso, que es el orden en que se muestran', () => {
    expect(questionTypesFromMix(CALCULO)).toEqual([
      'numeric', 'short_answer', 'multiple_choice', 'true_false',
    ])
  })

  it('sin mezcla no sugiere nada, y el llamador cae a su propio default', () => {
    expect(questionTypesFromMix(undefined)).toEqual([])
  })
})

/**
 * El núcleo de la condición de diseño: la columna se llama
 * `tipos_pregunta_sugeridos` y tiene que comportarse como una sugerencia. Lo que
 * el usuario elige explícitamente manda, siempre.
 */
describe('restrictQuestionTypeMix · la elección del usuario gana sobre lo sugerido', () => {
  it('elimina de la mezcla los tipos que el usuario destildó', () => {
    // El alumno deja sólo opción múltiple y V/F. La sugerencia de la cátedra
    // pesa 75% en producción, pero acá no puede colar ni una numérica.
    const restricted = restrictQuestionTypeMix(CALCULO, ['multiple_choice', 'true_false'])!

    expect(Object.keys(restricted).sort()).toEqual(['multiple_choice', 'true_false'])
    expect(productionShare(restricted)).toBe(0)

    const quotas = distributeQuestionCounts(restricted, 20)
    expect(countOf(quotas, 'numeric')).toBe(0)
    expect(countOf(quotas, 'short_answer')).toBe(0)
    expect(totalOf(quotas)).toBe(20)
  })

  it('renormaliza los pesos que quedan en vez de sub-representarlos', () => {
    // 50 y 25 sobre un total original de 100 no pueden seguir valiendo 50% y 25%
    // del cuestionario cuando son los dos únicos tipos: reparten el 100%.
    const restricted = restrictQuestionTypeMix(CALCULO, ['numeric', 'short_answer'])!
    const quotas = distributeQuestionCounts(restricted, 12)

    expect(countOf(quotas, 'numeric')).toBe(8)
    expect(countOf(quotas, 'short_answer')).toBe(4)
    expect(totalOf(quotas)).toBe(12)
  })

  it('deja entrar un tipo que el usuario pidió y el programa no pondera', () => {
    // El docente quiere V/F en una unidad cuya mezcla no lo declara. Tiene que
    // aparecer — pero sin ganarle a lo que el programa sí prioriza.
    const restricted = restrictQuestionTypeMix(
      { numeric: 50, short_answer: 25 },
      ['numeric', 'short_answer', 'true_false']
    )!

    expect(restricted.true_false).toBeGreaterThan(0)
    expect(restricted.true_false!).toBeLessThanOrEqual(restricted.short_answer!)
    expect(countOf(distributeQuestionCounts(restricted, 20), 'true_false')).toBeGreaterThan(0)
  })

  it('no sugiere reparto cuando el usuario eligió tipos que el programa ignora', () => {
    // Sin ningún tipo en común, no hay proporción que aplicar: se cae al reparto
    // parejo de siempre en vez de inventar pesos.
    expect(restrictQuestionTypeMix({ numeric: 50 }, ['multiple_choice', 'true_false'])).toBeUndefined()
  })

  it('sin mezcla del currículum no restringe nada', () => {
    expect(restrictQuestionTypeMix(undefined, ['numeric'])).toBeUndefined()
  })
})

describe('distributeQuestionCounts', () => {
  it('reparte exactamente el total pedido', () => {
    for (const total of [1, 5, 7, 10, 15, 20, 30, 40]) {
      expect(totalOf(distributeQuestionCounts(CALCULO, total)), `total=${total}`).toBe(total)
    }
  })

  it('respeta la proporción cuando divide justo', () => {
    expect(distributeQuestionCounts(CALCULO, 20)).toEqual([
      { type: 'numeric', count: 10 },
      { type: 'short_answer', count: 5 },
      { type: 'multiple_choice', count: 4 },
      { type: 'true_false', count: 1 },
    ])
  })

  it('mantiene el sesgo a producción en cuestionarios cortos', () => {
    // El caso que importa: 10 preguntas es el largo típico. Si el redondeo
    // devolviera la mayoría a los tipos con opciones, el cambio no serviría.
    const quotas = distributeQuestionCounts(CALCULO, 10)
    const produccion = countOf(quotas, 'numeric') + countOf(quotas, 'short_answer')

    expect(totalOf(quotas)).toBe(10)
    expect(produccion).toBeGreaterThanOrEqual(7)
  })

  it('no deja ningún tipo de la mezcla en cero si hay preguntas para todos', () => {
    // Un tipo tildado que desaparece por redondeo es indistinguible, para quien
    // lo tildó, de que la aplicación le haya ignorado la elección.
    const quotas = distributeQuestionCounts(CALCULO, 5)

    expect(totalOf(quotas)).toBe(5)
    expect(quotas).toHaveLength(4)
    for (const quota of quotas) expect(quota.count).toBeGreaterThan(0)
  })

  it('devuelve lista vacía cuando no hay mezcla o no hay preguntas', () => {
    expect(distributeQuestionCounts(undefined, 20)).toEqual([])
    expect(distributeQuestionCounts(CALCULO, 0)).toEqual([])
    expect(distributeQuestionCounts(CALCULO, Number.NaN)).toEqual([])
  })
})

describe('buildQuestionMixInstruction', () => {
  it('pide números exactos, no una preferencia', () => {
    // Una indicación blanda se pierde entre las otras reglas del system prompt y
    // el modelo vuelve a su default, que en cualquier corpus de exámenes es la
    // opción múltiple. Si alguien suaviza esto, el sesgo deja de existir sin que
    // falle nada más.
    const instruction = buildQuestionMixInstruction(CALCULO, 20)

    expect(instruction).toContain('DISTRIBUCIÓN OBLIGATORIA POR TIPO')
    expect(instruction).toContain('- numeric: 10 preguntas')
    expect(instruction).toContain('- true_false: 1 pregunta')
  })

  it('prohíbe explícitamente los tipos que quedaron afuera', () => {
    const instruction = buildQuestionMixInstruction(
      restrictQuestionTypeMix(CALCULO, ['numeric', 'short_answer']),
      10
    )

    expect(instruction).toContain('No generes ninguna pregunta de tipo: multiple_choice, true_false')
  })

  it('no dice nada cuando no hay mezcla que aplicar', () => {
    // El llamador usa el string vacío para caer al "distribuí de forma pareja"
    // de siempre, que es lo que sigue viendo todo K-12.
    expect(buildQuestionMixInstruction(undefined, 20)).toBe('')
  })
})
