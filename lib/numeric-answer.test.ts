import { describe, expect, it } from 'vitest'
import {
  defaultToleranceFor,
  formatNumericAnswer,
  isNumericallyEquivalent,
  parseNumericAnswer,
  MIN_ABSOLUTE_TOLERANCE,
} from './numeric-answer'

describe('parseNumericAnswer', () => {
  it('lee enteros y decimales con punto o con coma', () => {
    expect(parseNumericAnswer('13')).toBe(13)
    expect(parseNumericAnswer('3.5')).toBe(3.5)
    expect(parseNumericAnswer('3,5')).toBe(3.5)
    expect(parseNumericAnswer('  3,5  ')).toBe(3.5)
    expect(parseNumericAnswer('+3')).toBe(3)
    expect(parseNumericAnswer('-3,5')).toBe(-3.5)
    expect(parseNumericAnswer('.5')).toBe(0.5)
    expect(parseNumericAnswer(',5')).toBe(0.5)
  })

  it('lee fracciones, con y sin espacios alrededor de la barra', () => {
    expect(parseNumericAnswer('1/3')).toBeCloseTo(1 / 3, 12)
    expect(parseNumericAnswer('-2/4')).toBe(-0.5)
    expect(parseNumericAnswer('7 / 2')).toBe(3.5)
    expect(parseNumericAnswer('7/2')).toBe(3.5)
  })

  it('lee porcentajes como "dividido cien"', () => {
    expect(parseNumericAnswer('33%')).toBe(0.33)
    expect(parseNumericAnswer('50 %')).toBe(0.5)
    // La consecuencia buscada de esa convención: 50% y 1/2 son la misma respuesta.
    expect(parseNumericAnswer('50%')).toBe(parseNumericAnswer('1/2'))
  })

  it('lee LaTeX simple, con y sin delimitadores', () => {
    expect(parseNumericAnswer('\\frac{7}{4}')).toBe(1.75)
    expect(parseNumericAnswer('$\\frac{7}{4}$')).toBe(1.75)
    expect(parseNumericAnswer('$$\\dfrac{7}{4}$$')).toBe(1.75)
    expect(parseNumericAnswer('-\\frac{7}{4}')).toBe(-1.75)
    expect(parseNumericAnswer('\\frac{-7}{4}')).toBe(-1.75)
    expect(parseNumericAnswer('\\frac{3,5}{2}')).toBe(1.75)
    expect(parseNumericAnswer('$3,5$')).toBe(3.5)
  })

  it('devuelve null ante una división por cero en vez de Infinity', () => {
    expect(parseNumericAnswer('1/0')).toBeNull()
    expect(parseNumericAnswer('0/0')).toBeNull()
    expect(parseNumericAnswer('-5/0')).toBeNull()
    expect(parseNumericAnswer('\\frac{1}{0}')).toBeNull()
  })

  it('devuelve null ante entradas que no son un número', () => {
    expect(parseNumericAnswer('no sé')).toBeNull()
    expect(parseNumericAnswer('')).toBeNull()
    expect(parseNumericAnswer('   ')).toBeNull()
    expect(parseNumericAnswer('x')).toBeNull()
    expect(parseNumericAnswer('3x')).toBeNull()
    expect(parseNumericAnswer('-')).toBeNull()
    expect(parseNumericAnswer('/')).toBeNull()
    expect(parseNumericAnswer('%')).toBeNull()
    expect(parseNumericAnswer('7/2/2')).toBeNull()
    expect(parseNumericAnswer('1e3')).toBeNull()
  })

  it('no adivina separadores de miles: un separador siempre es decimal', () => {
    // Decisión documentada en el módulo. `1.234` se lee como uno coma dos tres
    // cuatro, igual que `1,234`, para que la regla sea una sola.
    expect(parseNumericAnswer('1.234')).toBe(1.234)
    expect(parseNumericAnswer('1,234')).toBe(1.234)
    // Con más de un separador no hay lectura consistente posible: se rechaza.
    expect(parseNumericAnswer('1.234.567')).toBeNull()
    expect(parseNumericAnswer('1,234,567')).toBeNull()
    expect(parseNumericAnswer('1.234,56')).toBeNull()
  })

  it('rechaza el número mixto en vez de leerlo mal', () => {
    // Si se ignoraran los espacios internos, "1 1/2" se leería 11/2 = 5,5.
    expect(parseNumericAnswer('1 1/2')).toBeNull()
    expect(parseNumericAnswer('1 5')).toBeNull()
  })
})

describe('acceptedAnswers reales de producción', () => {
  // Cada conjunto sale de la base: son las variantes que la IA generó para una
  // misma respuesta. El sistema tiene que reconocerlas entre sí, y además
  // reconocer lo que un alumno con teclado en español escribiría.
  const casos: Array<{ acepta: string[]; alumno: string[] }> = [
    { acepta: ['7/2', '3.5'], alumno: ['3,5', '7 / 2'] },
    { acepta: ['1/10', '0.1'], alumno: ['0,1', '10%'] },
    { acepta: ['7/4', '\\frac{7}{4}', '1.75'], alumno: ['1,75', '$\\frac{7}{4}$'] },
    { acepta: ['1/3'], alumno: ['0,33', '0,333', '0.3333'] },
  ]

  for (const { acepta, alumno } of casos) {
    it(`reconoce como equivalentes ${JSON.stringify(acepta)}`, () => {
      const valores = acepta.map((v) => parseNumericAnswer(v))
      expect(valores.every((v) => v !== null)).toBe(true)

      const esperado = valores[0] as number
      for (const valor of valores) {
        expect(isNumericallyEquivalent(valor as number, esperado)).toBe(true)
      }

      for (const escrito of alumno) {
        const valor = parseNumericAnswer(escrito)
        expect(valor, `no se pudo leer "${escrito}"`).not.toBeNull()
        expect(isNumericallyEquivalent(valor as number, esperado), `"${escrito}" debería dar correcto`).toBe(true)
      }
    })
  }
})

describe('defaultToleranceFor', () => {
  it('no tolera nada sobre un entero: no hay redondeo que perdonar', () => {
    expect(defaultToleranceFor(13)).toBe(0)
    expect(defaultToleranceFor(0)).toBe(0)
    expect(defaultToleranceFor(-4)).toBe(0)
  })

  it('usa el piso absoluto cuando el 1 % queda por debajo', () => {
    expect(defaultToleranceFor(1 / 3)).toBe(MIN_ABSOLUTE_TOLERANCE)
    expect(defaultToleranceFor(0.5)).toBe(MIN_ABSOLUTE_TOLERANCE)
  })

  it('escala con la magnitud cuando el 1 % supera el piso', () => {
    expect(defaultToleranceFor(250.5)).toBeCloseTo(2.505, 10)
    expect(defaultToleranceFor(-250.5)).toBeCloseTo(2.505, 10)
  })
})

describe('isNumericallyEquivalent', () => {
  it('acepta el redondeo a dos decimales de un periódico', () => {
    expect(isNumericallyEquivalent(0.33, 1 / 3)).toBe(true)
    expect(isNumericallyEquivalent(0.333, 1 / 3)).toBe(true)
    expect(isNumericallyEquivalent(0.34, 1 / 3)).toBe(false)
  })

  it('no perdona un entero contiguo', () => {
    expect(isNumericallyEquivalent(12, 13)).toBe(false)
    expect(isNumericallyEquivalent(13, 13)).toBe(true)
    expect(isNumericallyEquivalent(14, 13)).toBe(false)
  })

  it('la tolerancia explícita de la pregunta gana siempre, incluso si es 0', () => {
    // Sin tolerancia explícita, 3,48 entraría por el 1 % de 3,5.
    expect(isNumericallyEquivalent(3.48, 3.5)).toBe(true)
    expect(isNumericallyEquivalent(3.48, 3.5, 0)).toBe(false)
    // Y al revés: una tolerancia amplia habilita lo que el default rechazaría.
    expect(isNumericallyEquivalent(12, 13, 1)).toBe(true)
  })

  it('no se cuelga del ruido de punto flotante', () => {
    expect(isNumericallyEquivalent(0.1 + 0.2, 0.3, 0)).toBe(true)
    expect(isNumericallyEquivalent(7 / 4, 1.75, 0)).toBe(true)
    expect(isNumericallyEquivalent(1 / 10, 0.1, 0)).toBe(true)
  })

  it('rechaza valores no finitos en vez de propagarlos', () => {
    expect(isNumericallyEquivalent(NaN, 3)).toBe(false)
    expect(isNumericallyEquivalent(Infinity, 3)).toBe(false)
    expect(isNumericallyEquivalent(3, NaN)).toBe(false)
  })
})

describe('formatNumericAnswer', () => {
  it('usa coma decimal y no muestra decimales de más', () => {
    expect(formatNumericAnswer(3.5)).toBe('3,5')
    expect(formatNumericAnswer(13)).toBe('13')
    expect(formatNumericAnswer(100)).toBe('100')
    expect(formatNumericAnswer(-0.5)).toBe('-0,5')
    expect(formatNumericAnswer(0)).toBe('0')
    expect(formatNumericAnswer(1 / 3)).toBe('0,333333')
    expect(formatNumericAnswer(0.1 + 0.2)).toBe('0,3')
  })

  it('no agrupa los miles: lo que mostramos tiene que poder volver a entrar', () => {
    expect(formatNumericAnswer(1234.5)).toBe('1234,5')
    expect(parseNumericAnswer(formatNumericAnswer(1234.5))).toBe(1234.5)
  })

  it('no cae en notación científica ni imprime "0" para un valor chico', () => {
    expect(formatNumericAnswer(1e-7)).toBe('0,0000001')
    expect(formatNumericAnswer(1234567)).toBe('1234567')
  })

  it('devuelve string vacío para lo que no es un número', () => {
    expect(formatNumericAnswer(NaN)).toBe('')
    expect(formatNumericAnswer(Infinity)).toBe('')
  })

  it('sobrevive el viaje de ida y vuelta', () => {
    for (const valor of [3.5, -1.75, 0.1, 13, 0.25, 1234.5]) {
      expect(parseNumericAnswer(formatNumericAnswer(valor))).toBe(valor)
    }
  })
})
