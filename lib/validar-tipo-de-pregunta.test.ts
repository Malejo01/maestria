import { describe, expect, it } from 'vitest'
import { corregirTipoDePregunta, esPregunta, problemaDeTipo } from './validar-tipo-de-pregunta'

const vf = (question: string) => ({ type: 'true_false', question })
const num = (question: string) => ({ type: 'numeric', question })

describe('los cuatro reportes, literales', () => {
  it('#6 (Clarita, 20/11): verdadero o falso con "¿qué sucede…?" se regenera', () => {
    const q = vf(
      'Si al resolver una inecuación lineal multiplicamos ambos miembros por un número negativo, ¿qué sucede con el sentido de la desigualdad?',
    )
    expect(corregirTipoDePregunta(q)).toEqual({ accion: 'regenerar', problema: 'vf-pregunta-abierta' })
  })

  it('#4 (30/9): verdadero o falso con "¿por qué…?" se regenera', () => {
    const q = vf('¿por qué se considera que el error en matemática no debe ser sancionado sino analizado como parte del aprendizaje?')
    expect(corregirTipoDePregunta(q)).toEqual({ accion: 'regenerar', problema: 'vf-pregunta-abierta' })
  })

  it('#3 (30/9): numérica con "¿qué concepto matemático…?" se regenera', () => {
    const q = num('Un alumno reparte 24 caramelos en partes iguales entre 6 amigos: ¿qué concepto matemático se debe emplear?')
    expect(corregirTipoDePregunta(q)).toEqual({ accion: 'regenerar', problema: 'numerica-conceptual' })
  })

  it('#2 (30/9): numérica con "¿Qué procedimiento está aplicando?" se regenera', () => {
    const q = num('Martina escribe 3 × 4 = 4 + 4 + 4. ¿Qué procedimiento está aplicando?')
    expect(corregirTipoDePregunta(q)).toEqual({ accion: 'regenerar', problema: 'numerica-conceptual' })
  })
})

describe('los ejemplos de producción del 20 y 21/11', () => {
  it.each([
    'Según Pichon-Rivière, ante un grupo que se traba en la tarea, ¿cómo debe intervenir el docente?',
    'Para Ana Quiroga, ¿cómo influye el error en el proceso de aprendizaje?',
    'En la expresión 3 · (x + 2), ¿qué operación matemática representa el paréntesis?',
    'Las situaciones problemáticas abiertas, ¿favorecen o dificultan la construcción del conocimiento?',
  ])('%s', (question) => {
    expect(corregirTipoDePregunta(vf(question))).toEqual({ accion: 'regenerar', problema: 'vf-pregunta-abierta' })
  })
})

describe('afirmaciones válidas: no se tocan', () => {
  it.each([
    'El sentido de la desigualdad se invierte al multiplicar ambos miembros por un número negativo.',
    'Todo número primo mayor que 2 es impar.',
    '$\\sqrt{2}$ es un número racional.',
    'La suma de los ángulos interiores de un triángulo es 180°.',
    'Si $a > b$, entonces $a + c > b + c$ para todo $c$ real.',
  ])('%s', (question) => {
    expect(corregirTipoDePregunta(vf(question))).toEqual({ accion: 'ok' })
    expect(problemaDeTipo(vf(question))).toBeNull()
  })

  it('un "?" dentro de una fórmula no la vuelve pregunta', () => {
    expect(esPregunta('El conjunto $\\{x : x^2 = 4\\}$ tiene dos elementos.')).toBe(false)
  })
})

describe('sí o no: se reescribe cuando se puede', () => {
  it('orden sujeto-verbo: se le sacan los signos', () => {
    const q = vf('Si multiplicamos ambos miembros por −2, ¿el sentido de la desigualdad se invierte?')
    expect(corregirTipoDePregunta(q)).toEqual({
      accion: 'reescrita',
      problema: 'vf-pregunta-si-no',
      cambios: { question: 'Si multiplicamos ambos miembros por −2, el sentido de la desigualdad se invierte.' },
    })
  })

  it('"¿Es cierto que…?" queda en lo que afirma', () => {
    const q = vf('¿Es cierto que todo número natural tiene un siguiente?')
    expect(corregirTipoDePregunta(q)).toEqual({
      accion: 'reescrita',
      problema: 'vf-pregunta-si-no',
      cambios: { question: 'Todo número natural tiene un siguiente.' },
    })
  })

  it('"¿Es correcto afirmar que…?" con contexto antes', () => {
    const q = vf('Dado el conjunto A = {1, 2, 3}, ¿es correcto afirmar que A tiene 8 subconjuntos?')
    const r = corregirTipoDePregunta(q)
    expect(r).toMatchObject({ accion: 'reescrita', cambios: { question: 'Dado el conjunto A = {1, 2, 3}, A tiene 8 subconjuntos.' } })
  })

  it('orden verbo-sujeto ("¿Es…?", "¿Tiene…?", "¿Puede…?") se regenera', () => {
    for (const question of ['¿Es 7 un número primo?', '¿Tiene la función f(x) = x² un mínimo?', '¿Puede un triángulo tener dos ángulos rectos?']) {
      expect(corregirTipoDePregunta(vf(question))).toEqual({ accion: 'regenerar', problema: 'vf-pregunta-si-no' })
    }
  })
})

describe('numéricas que piden un nombre', () => {
  it('"¿cómo se llama…?" se regenera; un cálculo, no', () => {
    expect(problemaDeTipo(num('¿Cómo se llama el punto donde se cortan las medianas de un triángulo?'))).toBe('numerica-conceptual')
    expect(problemaDeTipo(num('Calculá el MCD(24, 36).'))).toBeNull()
    expect(problemaDeTipo(num('¿Cuántos lados tiene un hexágono?'))).toBeNull()
  })
})

describe('inecuaciones: el conjunto solución, no "el valor"', () => {
  const caso41 = {
    type: 'short_answer',
    question: 'Determine el valor de x que satisface 3x + 4 ≤ 10',
    acceptedAnswers: ['x <= 2'],
  }

  it('el caso del cuestionario 41: pide el conjunto y acepta todas las formas', () => {
    const r = corregirTipoDePregunta(caso41)
    expect(r.accion).toBe('reescrita')
    if (r.accion !== 'reescrita') return
    expect(r.problema).toBe('inecuacion-como-valor')
    expect(r.cambios.question).toBe('Determine el conjunto solución de 3x + 4 ≤ 10')
    expect(r.cambios.acceptedAnswers).toEqual(
      expect.arrayContaining(['x <= 2', 'x ≤ 2', '2 >= x', '(-∞; 2]', '(-∞, 2]', 'x menor o igual que 2']),
    )
    expect(problemaDeTipo(caso41)).toBe('inecuacion-como-valor')
  })

  it('si ya pide el conjunto, sólo se suman las formas (y no se avisa al docente)', () => {
    const q = { ...caso41, question: 'Hallá el conjunto solución de 3x + 4 ≤ 10' }
    const r = corregirTipoDePregunta(q)
    expect(r).toMatchObject({ accion: 'reescrita', problema: 'inecuacion-formas', cambios: { question: q.question } })
    expect(problemaDeTipo(q)).toBeNull()
  })

  it('una respuesta corta que no es una inecuación no se toca', () => {
    expect(corregirTipoDePregunta({ type: 'short_answer', question: '¿Cómo se llaman los focos?', acceptedAnswers: ['focos'] })).toEqual({
      accion: 'ok',
    })
  })
})

describe('falsos positivos que encontró el script en staging', () => {
  it('"…. ¿Verdadero o Falso?" al final: se saca y queda la afirmación', () => {
    expect(corregirTipoDePregunta(vf('La directriz de una parábola es una recta perpendicular al eje focal. ¿Verdadero o Falso?'))).toEqual({
      accion: 'reescrita',
      problema: 'vf-pregunta-si-no',
      cambios: { question: 'La directriz de una parábola es una recta perpendicular al eje focal.' },
    })
    expect(
      corregirTipoDePregunta(vf('El producto de dos números irracionales siempre resulta en un número irracional. ¿Es esta afirmación verdadera o falsa?')),
    ).toMatchObject({ accion: 'reescrita', cambios: { question: 'El producto de dos números irracionales siempre resulta en un número irracional.' } })
  })

  it('una "o" en el medio de una pregunta de sí o no no la vuelve abierta', () => {
    expect(corregirTipoDePregunta(vf('¿Una sucesión es siempre una lista ordenada de números que sigue una regla o patrón específico?'))).toMatchObject({
      accion: 'reescrita',
      cambios: { question: 'Una sucesión es siempre una lista ordenada de números que sigue una regla o patrón específico.' },
    })
  })

  it('"¿Es cierto que…?" después de una oración empieza otra', () => {
    expect(corregirTipoDePregunta(vf('La ecuación de una parábola es $x^2 = 16y$. ¿Es cierto que su foco se encuentra en el punto $(0, 4)$?'))).toMatchObject({
      accion: 'reescrita',
      cambios: { question: 'La ecuación de una parábola es $x^2 = 16y$. Su foco se encuentra en el punto $(0, 4)$.' },
    })
    expect(corregirTipoDePregunta(vf('Si tenemos dos funciones $f$ y $g$, ¿es siempre cierto que $f(g(x))$ es igual a $g(f(x))$?'))).toMatchObject({
      accion: 'reescrita',
      cambios: { question: 'Si tenemos dos funciones $f$ y $g$, $f(g(x))$ es igual a $g(f(x))$.' },
    })
  })
})
