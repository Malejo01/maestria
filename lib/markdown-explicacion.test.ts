import { describe, expect, it } from 'vitest'
import { parsearEnLinea, parsearMarkdown, textoVisible } from './markdown-explicacion'

/**
 * Las explicaciones del error se imprimían con `whitespace-pre-wrap`: el
 * alumno leía "## 1. ¿Por qué elegiste esta opción?" y "**¡Atención!**" con
 * los símbolos a la vista. Estos tests fijan los cuatro casos del encargo
 * (encabezado, negrita, lista, fórmula) y lo que hace que convivan.
 */

describe('parsearMarkdown: los cuatro casos', () => {
  it('encabezado: el ## no llega al texto', () => {
    const bloques = parsearMarkdown('## 1. ¿Por qué elegiste esta opción?')
    expect(bloques).toEqual([
      {
        tipo: 'encabezado',
        nivel: 2,
        contenido: [{ tipo: 'texto', texto: '1. ¿Por qué elegiste esta opción?' }],
      },
    ])
  })

  it('negrita: los ** no llegan al texto', () => {
    const [parrafo] = parsearMarkdown('Es **muy común** confundirse acá.')
    expect(parrafo).toEqual({
      tipo: 'parrafo',
      contenido: [
        { tipo: 'texto', texto: 'Es ' },
        { tipo: 'negrita', hijos: [{ tipo: 'texto', texto: 'muy común' }] },
        { tipo: 'texto', texto: ' confundirse acá.' },
      ],
    })
  })

  it('lista con viñetas y lista numerada', () => {
    const bloques = parsearMarkdown('- uno\n- dos\n\n1. primero\n2. segundo')
    expect(bloques).toHaveLength(2)
    expect(bloques[0]).toMatchObject({ tipo: 'lista', ordenada: false })
    expect(bloques[1]).toMatchObject({ tipo: 'lista', ordenada: true, inicio: 1 })
    expect(textoVisible(bloques)).toContain('uno')
    expect(textoVisible(bloques)).not.toMatch(/^- /m)
  })

  it('fórmula: se aparta cruda, con sus delimitadores, para LaTeXRenderer', () => {
    const [parrafo] = parsearMarkdown('La pendiente es $\\frac{a}{b}$ siempre.')
    expect(parrafo).toMatchObject({
      contenido: [
        { tipo: 'texto', texto: 'La pendiente es ' },
        { tipo: 'formula', crudo: '$\\frac{a}{b}$' },
        { tipo: 'texto', texto: ' siempre.' },
      ],
    })
  })

  it('los cuatro juntos, como los devuelve el modelo: no queda ningún ## ni **', () => {
    const fuente = [
      '## 1. ¿Por qué elegiste esta opción?',
      '**¡Casi!** Sumaste los exponentes en $x^2 \\cdot x^3$.',
      '',
      '## 2. Explicación paso a paso',
      '- Primero: **misma base**.',
      '- Después: $x^{2+3} = x^5$.',
      '',
      '### Tip',
      'Usá `x**5` sólo en código.',
    ].join('\n')
    const bloques = parsearMarkdown(fuente)
    expect(bloques.map((b) => b.tipo)).toEqual([
      'encabezado',
      'parrafo',
      'encabezado',
      'lista',
      'encabezado',
      'parrafo',
    ])
    // El único ** que sobrevive es el que está dentro de código, a propósito.
    expect(textoVisible(bloques).replace('x**5', '')).not.toMatch(/##|\*\*/)
  })
})

describe('Markdown y LaTeX no se pisan', () => {
  it('los _ y * de una fórmula no son cursiva', () => {
    const nodos = parsearEnLinea('Sea $a_1 * b_2$ y $c_3 * d_4$.')
    expect(nodos.filter((n) => n.tipo === 'formula')).toEqual([
      { tipo: 'formula', crudo: '$a_1 * b_2$' },
      { tipo: 'formula', crudo: '$c_3 * d_4$' },
    ])
    expect(nodos.some((n) => n.tipo === 'cursiva')).toBe(false)
  })

  it('una fórmula dentro de negrita sigue siendo fórmula', () => {
    expect(parsearEnLinea('**da $x^2$**')).toEqual([
      {
        tipo: 'negrita',
        hijos: [
          { tipo: 'texto', texto: 'da ' },
          { tipo: 'formula', crudo: '$x^2$' },
        ],
      },
    ])
  })

  it('un ** adentro de una fórmula no cierra la negrita de afuera', () => {
    const nodos = parsearEnLinea('**potencia $2**3$ lista**')
    expect(nodos).toHaveLength(1)
    expect(nodos[0]).toMatchObject({ tipo: 'negrita' })
  })

  it('un renglón que empieza con "-" dentro de $$…$$ no es un ítem de lista', () => {
    const bloques = parsearMarkdown('$$\nx = \\frac{\n- b}{2a}\n$$')
    expect(bloques).toEqual([{ tipo: 'formula', crudo: '$$\nx = \\frac{\n- b}{2a}\n$$' }])
  })
})

describe('lo que NO es formato', () => {
  it('una multiplicación con asteriscos queda como está', () => {
    expect(parsearEnLinea('2 * 3 * 4 = 24')).toEqual([{ tipo: 'texto', texto: '2 * 3 * 4 = 24' }])
  })

  it('snake_case no es cursiva', () => {
    expect(parsearEnLinea('la variable mi_valor_total')).toEqual([
      { tipo: 'texto', texto: 'la variable mi_valor_total' },
    ])
  })

  it('un número negativo al principio del renglón no es un ítem', () => {
    expect(parsearMarkdown('-5 es menor que 3')[0].tipo).toBe('parrafo')
  })

  it('#hashtag no es un encabezado', () => {
    expect(parsearMarkdown('#etiqueta')[0].tipo).toBe('parrafo')
  })
})

describe('texto a medio escribir (el modal lo revela de a poco)', () => {
  const completo = '## Paso 1\nEs **muy común** sumar `a + b` y listo.\n\n- uno\n- **dos**'

  it('ningún prefijo del texto deja un ## ni un ** a la vista', () => {
    for (let corte = 1; corte <= completo.length; corte++) {
      const visible = textoVisible(parsearMarkdown(completo.slice(0, corte)))
      expect(visible, `prefijo de ${corte} caracteres`).not.toMatch(/##|\*\*|`/)
    }
  })

  it('una negrita sin cerrar conserva su texto', () => {
    expect(textoVisible(parsearMarkdown('Es **muy com'))).toBe('Es muy com')
  })
})

describe('estructura', () => {
  it('lista anidada por sangría', () => {
    const [lista] = parsearMarkdown('- fruta\n  - manzana\n  - pera\n- verdura')
    expect(lista).toMatchObject({ tipo: 'lista', items: [{ sublistas: [{ items: [{}, {}] }] }, { sublistas: [] }] })
  })

  it('una lista numerada que arranca en 3 conserva su número', () => {
    expect(parsearMarkdown('3. tercero\n4. cuarto')[0]).toMatchObject({ ordenada: true, inicio: 3 })
  })

  it('bloque de código: su contenido no se interpreta', () => {
    expect(parsearMarkdown('```js\nconst a = **b**\n```')).toEqual([
      { tipo: 'codigo', texto: 'const a = **b**' },
    ])
  })

  it('los saltos de línea simples de un párrafo se conservan', () => {
    const [parrafo] = parsearMarkdown('Paso 1: restar.\nPaso 2: dividir.')
    expect(parrafo).toMatchObject({ contenido: [{ tipo: 'texto', texto: 'Paso 1: restar.\nPaso 2: dividir.' }] })
  })

  it('separador y cita', () => {
    expect(parsearMarkdown('---\n> ojo con el signo').map((b) => b.tipo)).toEqual(['separador', 'cita'])
  })
})
