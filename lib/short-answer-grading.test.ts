import { describe, expect, it } from 'vitest'
import { matchesAcceptedAnswer, normalizeAnswerText } from './short-answer-grading'

/**
 * La primera tanda de casos salió tal cual de producción: 225 de 238 respuestas
 * cortas marcadas como incorrectas. Están acá para que un cambio de
 * normalización no las vuelva a romper en ninguna de las dos direcciones.
 */
describe('matchesAcceptedAnswer — casos reales de producción', () => {
  it('acepta la respuesta idéntica', () => {
    expect(matchesAcceptedAnswer('9', ['9'])).toBe(true)
  })

  it('acepta "parabola\\n" contra ["Parábola", "Parabola"] (salto de línea, mayúscula y tilde)', () => {
    expect(matchesAcceptedAnswer('parabola\n', ['Parábola', 'Parabola'])).toBe(true)
  })

  it('rechaza una respuesta que nombra el procedimiento en vez del resultado', () => {
    expect(matchesAcceptedAnswer('Factorizar ', ['$(x+1)^2$', '$x^2+2x+1$'])).toBe(false)
  })

  it('rechaza "no sé"', () => {
    expect(matchesAcceptedAnswer('no sé', ['8', 'ocho'])).toBe(false)
  })

  it('rechaza "no lo se"', () => {
    expect(matchesAcceptedAnswer('no lo se', ['7/2', '3.5'])).toBe(false)
  })

  it('rechaza un número parecido pero distinto', () => {
    expect(matchesAcceptedAnswer('12', ['13'])).toBe(false)
  })

  it('rechaza un concepto distinto del esperado', () => {
    expect(matchesAcceptedAnswer('neutro', ['Propiedad conmutativa', 'Conmutativa'])).toBe(false)
  })

  it('nunca acepta una respuesta vacía o en blanco', () => {
    expect(matchesAcceptedAnswer('', ['9'])).toBe(false)
    expect(matchesAcceptedAnswer('   ', ['9'])).toBe(false)
    expect(matchesAcceptedAnswer('\n\t ', ['9'])).toBe(false)
    // Ni siquiera si la lista de aceptadas también viene vacía o con basura.
    expect(matchesAcceptedAnswer('', [''])).toBe(false)
    expect(matchesAcceptedAnswer('   ', ['', '   '])).toBe(false)
    expect(matchesAcceptedAnswer('.', ['9'])).toBe(false)
  })
})

describe('matchesAcceptedAnswer — forma de la comparación', () => {
  it('alcanza con coincidir con una de las aceptadas', () => {
    expect(matchesAcceptedAnswer('Parabola', ['Hipérbola', 'Parábola', 'Elipse'])).toBe(true)
  })

  it('no acepta subcadenas ni respuestas "parecidas"', () => {
    expect(matchesAcceptedAnswer('conmutativa y asociativa', ['Conmutativa'])).toBe(false)
    expect(matchesAcceptedAnswer('parab', ['Parábola'])).toBe(false)
    expect(matchesAcceptedAnswer('Parábolas', ['Parábola'])).toBe(false)
  })

  it('tolera una lista de aceptadas vacía o inválida sin romperse', () => {
    expect(matchesAcceptedAnswer('9', [])).toBe(false)
    expect(matchesAcceptedAnswer('9', undefined as unknown as string[])).toBe(false)
    expect(matchesAcceptedAnswer('9', [null, 9, '9'] as unknown as string[])).toBe(true)
  })

  it('NO resuelve equivalencia numérica — eso es de numeric-answer.ts', () => {
    expect(matchesAcceptedAnswer('3,5', ['3.5'])).toBe(false)
    expect(matchesAcceptedAnswer('7/2', ['3.5'])).toBe(false)
    expect(matchesAcceptedAnswer('50%', ['0.5'])).toBe(false)
  })
})

describe('normalizeAnswerText', () => {
  it('recorta extremos y colapsa espacios internos, tabs y saltos de línea', () => {
    expect(normalizeAnswerText('  la\t\tpropiedad \n conmutativa  ')).toBe('la propiedad conmutativa')
    expect(normalizeAnswerText('parabola\n')).toBe('parabola')
  })

  it('pasa a minúsculas', () => {
    expect(normalizeAnswerText('CONMUTATIVA')).toBe('conmutativa')
  })

  it('saca tildes y diéresis de las vocales', () => {
    expect(normalizeAnswerText('Parábola')).toBe('parabola')
    expect(normalizeAnswerText('ÁÉÍÓÚÜ')).toBe('aeiouu')
    expect(normalizeAnswerText('pingüino')).toBe('pinguino')
  })

  it('NO toca la ñ: "año" y "ano" son palabras distintas', () => {
    expect(normalizeAnswerText('Año')).toBe('año')
    expect(normalizeAnswerText('año')).not.toBe(normalizeAnswerText('ano'))
    expect(matchesAcceptedAnswer('ano', ['año'])).toBe(false)
  })

  it('normaliza la ñ compuesta y la precompuesta a la misma cadena', () => {
    // La misma palabra tipeada como U+00F1 y como "n" + U+0303.
    expect(normalizeAnswerText('an\u0303o')).toBe(normalizeAnswerText('a\u00F1o'))
  })

  it('saca los delimitadores de LaTeX que envuelven la respuesta', () => {
    expect(normalizeAnswerText('$9$')).toBe('9')
    expect(normalizeAnswerText('$$x^2$$')).toBe('x^2')
    expect(normalizeAnswerText('$(x+1)^2$')).toBe('(x+1)^2')
    expect(normalizeAnswerText('\\(x+1\\)')).toBe('x+1')
    expect(normalizeAnswerText('\\[x+1\\]')).toBe('x+1')
    expect(normalizeAnswerText('\\text{Parábola}')).toBe('parabola')
    expect(normalizeAnswerText('$\\text{Parábola}$')).toBe('parabola')
  })

  it('permite que el alumno escriba sin LaTeX lo que la aceptada trae con LaTeX', () => {
    expect(matchesAcceptedAnswer('x^2+2x+1', ['$(x+1)^2$', '$x^2+2x+1$'])).toBe(true)
    expect(matchesAcceptedAnswer('parabola', ['$\\text{Parábola}$'])).toBe(true)
  })

  it('no borra delimitadores que no envuelven toda la respuesta', () => {
    // Acá los $ separan dos expresiones; borrarlos cambiaría el contenido.
    expect(normalizeAnswerText('$a$ y $b$')).toBe('$a$ y $b$')
    expect(normalizeAnswerText('\\text{a} y \\text{b}')).toBe('\\text{a} y \\text{b}')
  })

  it('saca la puntuación final que no cambia el significado', () => {
    expect(normalizeAnswerText('Parábola.')).toBe('parabola')
    expect(normalizeAnswerText('9,')).toBe('9')
    expect(normalizeAnswerText('conmutativa;')).toBe('conmutativa')
    expect(normalizeAnswerText('conmutativa:')).toBe('conmutativa')
    expect(matchesAcceptedAnswer('Parábola.', ['Parabola'])).toBe(true)
  })

  it('saca el signo de pregunta: en un teclado de celular es ruido, no duda', () => {
    expect(normalizeAnswerText('conmutativa?')).toBe('conmutativa')
    expect(normalizeAnswerText('¿conmutativa?')).toBe('conmutativa')
    expect(matchesAcceptedAnswer('Parábola?', ['Parabola'])).toBe(true)
    expect(matchesAcceptedAnswer('9?', ['9'])).toBe(true)
    // Y sigue sin acercar respuestas distintas: sacar el signo no es parecerse.
    expect(matchesAcceptedAnswer('12?', ['13'])).toBe(false)
  })

  it('saca los signos de apertura, por la misma razón que los de cierre', () => {
    expect(normalizeAnswerText('¡Conmutativa!')).toBe('conmutativa')
    expect(matchesAcceptedAnswer('¡9!', ['9'])).toBe(true)
  })

  it('NO saca la puntuación interna: "1,5" no puede volverse "15"', () => {
    expect(normalizeAnswerText('1,5')).toBe('1,5')
    expect(matchesAcceptedAnswer('1,5', ['15'])).toBe(false)
  })

  it('normaliza comillas tipográficas a rectas', () => {
    expect(normalizeAnswerText('“x”')).toBe('"x"')
    expect(normalizeAnswerText('el ’90')).toBe("el '90")
    expect(matchesAcceptedAnswer('“eje” de simetria', ['"eje" de simetría'])).toBe(true)
  })

  it('normaliza el guion largo y el menos unicode a "-"', () => {
    expect(normalizeAnswerText('−3')).toBe('-3')
    expect(normalizeAnswerText('–3')).toBe('-3')
    expect(normalizeAnswerText('—3')).toBe('-3')
    expect(matchesAcceptedAnswer('-3', ['$-3$'])).toBe(true)
  })

  it('ignora espacios de ancho cero y no separables', () => {
    expect(normalizeAnswerText('\u200Bparabola\uFEFF')).toBe('parabola')
    expect(normalizeAnswerText('propiedad\u00A0conmutativa')).toBe('propiedad conmutativa')
  })

  it('devuelve cadena vacía para entradas no textuales', () => {
    expect(normalizeAnswerText(null as unknown as string)).toBe('')
    expect(normalizeAnswerText(undefined as unknown as string)).toBe('')
    expect(normalizeAnswerText(9 as unknown as string)).toBe('')
  })

  it('no colapsa respuestas conceptualmente distintas', () => {
    const distintas = ['conmutativa', 'asociativa', 'distributiva', 'neutro', '12', '13', 'x+1', 'x-1']
    expect(new Set(distintas.map(normalizeAnswerText)).size).toBe(distintas.length)
  })
})
