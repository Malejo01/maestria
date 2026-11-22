import { describe, expect, it } from 'vitest'
import { problemaDeArea } from './validar-area'

describe('problemaDeArea', () => {
  it('en una unidad conceptual marca LaTeX, numéricas y cuentas', () => {
    expect(problemaDeArea({ type: 'multiple_choice', question: 'Si $x = 2$, ¿qué cultura…?' }, 'conceptual')).toBe('latex-en-conceptual')
    expect(problemaDeArea({ type: 'multiple_choice', question: '¿Cuál?', options: ['$\\frac{1}{2}$', 'b'] }, 'conceptual')).toBe('latex-en-conceptual')
    expect(problemaDeArea({ type: 'numeric', question: '¿Cuántas etapas tiene el rito de paso?' }, 'conceptual')).toBe('numerica-en-conceptual')
    expect(problemaDeArea({ type: 'short_answer', question: 'Calculá el porcentaje de la población que migró.' }, 'conceptual')).toBe('calculo-en-conceptual')
    expect(problemaDeArea({ type: 'multiple_choice', question: '¿Cuánto es 12 + 30?' }, 'conceptual')).toBe('calculo-en-conceptual')
    expect(problemaDeArea({ type: 'true_false', question: 'Si 3 x 4 da 12, la comunidad tiene 12 linajes.' }, 'conceptual')).toBe('calculo-en-conceptual')
  })

  it('no marca una pregunta conceptual normal, aunque tenga un año o un número suelto', () => {
    expect(problemaDeArea({ type: 'multiple_choice', question: 'En 1920, ¿qué enfoque predominaba en la antropología?' }, 'conceptual')).toBeNull()
    expect(problemaDeArea({ type: 'true_false', question: 'El relativismo cultural rechaza juzgar una cultura con los valores de otra.' }, 'conceptual')).toBeNull()
    expect(problemaDeArea({ type: 'short_answer', question: 'Un grupo de 30 turistas califica de "atrasada" una fiesta. ¿Qué categoría describe esa mirada?' }, 'conceptual')).toBeNull()
  })

  it('en lo cuantitativo y lo mixto no marca nada', () => {
    expect(problemaDeArea({ type: 'numeric', question: 'Calculá $\\frac{3}{4} + \\frac{1}{4}$' }, 'cuantitativo')).toBeNull()
    expect(problemaDeArea({ type: 'numeric', question: 'Calculá la elasticidad.' }, 'mixto')).toBeNull()
  })
})
