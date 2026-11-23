import { describe, expect, it } from 'vitest'
import { comodinesDe, ErrorDeFormula, evaluarFormula } from './evaluar-formula'

describe('F7 · evaluarFormula (sin eval)', () => {
  it('las cuentas, la precedencia, los paréntesis y el menos unario', () => {
    expect(evaluarFormula('{a} + {b} * 2', { a: 1, b: 3 })).toBe(7)
    expect(evaluarFormula('({a} + {b}) * 2', { a: 1, b: 3 })).toBe(8)
    expect(evaluarFormula('-{a} - -2', { a: 5 })).toBe(-3)
    expect(evaluarFormula('{p} * {q} / 100', { p: 20, q: 150 })).toBe(30)
    expect(evaluarFormula('1.5e2 + .5', {})).toBe(150.5)
  })

  it('las funciones de Moodle', () => {
    expect(evaluarFormula('pow({a}, 2) + sqrt(16)', { a: 3 })).toBe(13)
    expect(evaluarFormula('round({x}, 2)', { x: 3.14159 })).toBe(3.14)
    expect(evaluarFormula('abs(-2) + min(4, 1, 3) + max(1, 9)', {})).toBe(12)
    expect(evaluarFormula('pi()', {})).toBeCloseTo(Math.PI)
    expect(evaluarFormula('log(exp(2))', {})).toBeCloseTo(2)
  })

  it('lo que no es una fórmula de Moodle es un error, nunca un número', () => {
    for (const mala of ['{a} ^ 2', 'alert(1)', 'constructor', '{a} +', '(1 + 2', '1 2', '{a', 'sqrt', 'pow(1)', '1 / 0', 'sqrt(-1)', '{a} ; 1', '$a']) {
      expect(() => evaluarFormula(mala, { a: 2 }), mala).toThrow(ErrorDeFormula)
    }
    expect(() => evaluarFormula('{a} + {b}', { a: 1 })).toThrow('{b} no tiene valor')
  })

  it('los comodines, sin repetir', () => {
    expect(comodinesDe('{a} * {b} + {a}')).toEqual(['a', 'b'])
  })
})
