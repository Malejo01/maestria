import { describe, expect, it } from 'vitest'
import { formasDeInecuacion, leerInecuacion, mismaInecuacion } from './inecuacion'
import { gradeShortAnswerLocally } from './short-answer-autograde'
import { NOTACION_DEL_ALUMNO } from './notacion-matematica'

/**
 * M2. Cuestionario 41 de producción: "3x + 4 ≤ 10" esperaba `x <= 2`. Todas
 * estas formas son el mismo conjunto; "2" solo, no.
 */
const FORMAS_DE_X_MENOR_O_IGUAL_QUE_2 = [
  'x <= 2',
  'x ≤ 2',
  'x =< 2',
  '2 >= x',
  '2 ≥ x',
  '(-∞; 2]',
  '(-∞, 2]',
  '(-inf, 2]',
  ']-∞; 2]',
  'x menor o igual que 2',
  'x es menor o igual a 2',
  'X ≤ 2',
  'S = (-∞; 2]',
  '{x ∈ R / x ≤ 2}',
  '$x \\leq 2$',
]

describe('leerInecuacion', () => {
  it.each(FORMAS_DE_X_MENOR_O_IGUAL_QUE_2)('%s es x ≤ 2', (forma) => {
    expect(leerInecuacion(forma)).toEqual({ inferior: null, superior: { valor: 2, incluido: true } })
  })

  it('un número solo no es un conjunto', () => {
    expect(leerInecuacion('2')).toBeNull()
    expect(leerInecuacion('x = 2')).toBeNull()
  })

  it('estrictas, hacia arriba y acotadas', () => {
    expect(leerInecuacion('x < 2')).toEqual({ inferior: null, superior: { valor: 2, incluido: false } })
    expect(leerInecuacion('x > -1,5')).toEqual({ inferior: { valor: -1.5, incluido: false }, superior: null })
    expect(leerInecuacion('[3; +∞)')).toEqual({ inferior: { valor: 3, incluido: true }, superior: null })
    expect(leerInecuacion('-1 < x ≤ 3')).toEqual({ inferior: { valor: -1, incluido: false }, superior: { valor: 3, incluido: true } })
    expect(leerInecuacion('(-1; 3]')).toEqual(leerInecuacion('-1 < x <= 3'))
  })

  it('intervalos imposibles o mal escritos no se leen', () => {
    expect(leerInecuacion('(3; 1]')).toBeNull()
    expect(leerInecuacion('(+∞; 2]')).toBeNull()
    expect(leerInecuacion('hola')).toBeNull()
  })
})

describe('mismaInecuacion', () => {
  it('mismo conjunto en otra forma: sí; otro conjunto: no; un número: no se sabe', () => {
    expect(mismaInecuacion('(-∞; 2]', ['x <= 2'])).toBe(true)
    expect(mismaInecuacion('x < 2', ['x <= 2'])).toBe(false)
    expect(mismaInecuacion('2', ['x <= 2'])).toBeNull()
    expect(mismaInecuacion('x <= 2', ['focos'])).toBeNull()
  })

  it('formasDeInecuacion vuelve a leerse como el mismo conjunto', () => {
    const intervalo = leerInecuacion('x <= 2')!
    for (const forma of formasDeInecuacion(intervalo)) {
      expect(mismaInecuacion(forma, ['x <= 2'])).toBe(true)
    }
  })
})

describe('el corrector de respuesta corta con las formas de la inecuación', () => {
  it.each(FORMAS_DE_X_MENOR_O_IGUAL_QUE_2)('"%s" está bien sin preguntarle a la IA', (forma) => {
    expect(gradeShortAnswerLocally(forma, ['x <= 2'])).toEqual({ resolved: true, isCorrect: true, via: expect.any(String) })
  })

  it('"2" no se da por bueno desde acá (lo corrige la IA, que sabe que no es el conjunto)', () => {
    expect(gradeShortAnswerLocally('2', ['x <= 2'])).toEqual({ resolved: false })
    expect(NOTACION_DEL_ALUMNO).toContain('un número solo ("2") NO es correcto')
  })

  it('el conjunto equivocado tampoco', () => {
    expect(gradeShortAnswerLocally('x < 2', ['x <= 2'])).toEqual({ resolved: false })
    expect(gradeShortAnswerLocally('x >= 2', ['x <= 2'])).toEqual({ resolved: false })
  })
})
