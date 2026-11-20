import { describe, expect, it } from 'vitest'
import { SIMBOLOS, insertar, llevaBarra, textoALatex } from './notacion-matematica'

const simbolo = (clave: string) => SIMBOLOS.find((s) => s.clave === clave)!.simbolo

describe('L3 · la barra inserta en el cursor', () => {
  it('el producto, donde está el cursor', () => {
    expect(insertar('2^23', 3, 3, simbolo('producto'))).toEqual({ texto: '2^2·3', cursor: 4 })
  })

  it('la potencia deja el cursor listo para el exponente', () => {
    expect(insertar('2', 1, 1, simbolo('potencia'))).toEqual({ texto: '2^', cursor: 2 })
  })

  it('la raíz deja el cursor adentro, para el radicando', () => {
    expect(insertar('', 0, 0, simbolo('raiz'))).toEqual({ texto: '√()', cursor: 2 })
  })

  it('reemplaza lo seleccionado', () => {
    expect(insertar('2x3', 1, 2, simbolo('producto'))).toEqual({ texto: '2·3', cursor: 2 })
  })

  it('trae los diez símbolos del encargo', () => {
    expect(SIMBOLOS.map((s) => s.simbolo.inserta)).toEqual(['·', '^', '√()', '/', '()', 'π', '−', '≤', '≥', '≠'])
  })
})

describe('L3 · la vista previa', () => {
  it('2^2·3·5 se ve como potencia', () => {
    expect(textoALatex('2^2·3·5')).toBe('$2^{2} \\cdot 3 \\cdot 5$')
  })

  it('la x y el punto entre dígitos son producto, como en la corrección', () => {
    expect(textoALatex('2x2x3x5')).toBe('$2 \\cdot 2 \\cdot 3 \\cdot 5$')
    expect(textoALatex('2.2.3.5')).toBe('$2 \\cdot 2 \\cdot 3 \\cdot 5$')
  })

  it('raíces, superíndices, pi y comparaciones', () => {
    expect(textoALatex('√(16)')).toBe('$\\sqrt{16}$')
    expect(textoALatex('2²·3')).toBe('$2^{2} \\cdot 3$')
    expect(textoALatex('2π')).toBe('$2\\pi $')
    expect(textoALatex('x≤3')).toBe('$x \\le 3$')
    expect(textoALatex('2^(n+1)')).toBe('$2^{n+1}$')
  })

  it('las palabras quedan como texto', () => {
    expect(textoALatex('es 2^3')).toBe('$\\text{es}\\ 2^{3}$')
  })

  it('un número solo o una frase sin símbolos no tiene vista previa', () => {
    expect(textoALatex('60')).toBeNull()
    expect(textoALatex('3,5')).toBeNull()
    expect(textoALatex('es un número primo')).toBeNull()
    expect(textoALatex('')).toBeNull()
  })
})

describe('L3 · cuándo aparece la barra', () => {
  it('en respuesta corta, siempre', () => {
    expect(llevaBarra({ type: 'short_answer' })).toBe(true)
  })

  it('en una numérica con forma o con fracción', () => {
    expect(llevaBarra({ type: 'numeric', forma: 'factorizacion' })).toBe(true)
    expect(llevaBarra({ type: 'numeric', esFactorizacion: true })).toBe(true)
    expect(llevaBarra({ type: 'numeric', fraccion: { numerador: 3, denominador: 4 } })).toBe(true)
  })

  it('en una numérica de potencias, raíces o factorización', () => {
    expect(llevaBarra({ type: 'numeric', topicName: 'Potenciación y radicación' })).toBe(true)
    expect(llevaBarra({ type: 'numeric', topicName: 'Raíz cuadrada' })).toBe(true)
  })

  it('en una cuenta simple, no', () => {
    expect(llevaBarra({ type: 'numeric', topicName: 'Suma y resta de enteros' })).toBe(false)
    expect(llevaBarra({ type: 'multiple_choice' })).toBe(false)
  })
})
