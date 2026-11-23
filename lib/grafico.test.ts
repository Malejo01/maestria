import { describe, expect, it } from 'vitest'
import { aFormula, armarGrafico, descripcionDelGrafico, evaluarEn, limpiarGrafico, pasoDeMarcas, svgDelGrafico, temasDeFunciones } from './grafico'

describe('aFormula: como se escribe → el evaluador seguro', () => {
  const vale = (e: string, x: number) => evaluarEn(aFormula(e), x)
  it('potencias, multiplicación implícita y funciones', () => {
    expect(vale('x^2 - 1', 3)).toBe(8)
    expect(vale('2x^2 - 3x + 1', 2)).toBe(3)
    expect(vale('(x+1)^2', 2)).toBe(9)
    expect(vale('-x^2', 3)).toBe(-9)
    expect(vale('2^x', 3)).toBe(8)
    expect(vale('x^2^3', 2)).toBe(256)
    expect(vale('sqrt(x)^2', 4)).toBeCloseTo(4)
    expect(vale('2sin(x)', Math.PI / 2)).toBeCloseTo(2)
    expect(vale('3(x-1)', 2)).toBe(3)
    expect(vale('exp(x)', 0)).toBe(1)
    expect(vale('x²', 5)).toBe(25)
    expect(vale('log10(x)', 100)).toBe(2)
  })
  it('donde no está definida da null; lo que no entiende, lanza al limpiar', () => {
    expect(vale('sqrt(x)', -1)).toBeNull()
    expect(vale('1/x', 0)).toBeNull()
    expect(limpiarGrafico({ expresiones: ['x$2'], dominio: [-1, 1] })).toBeNull()
  })
})

describe('limpiarGrafico', () => {
  it('se queda con lo que sirve', () => {
    expect(limpiarGrafico({ expresiones: ['x^2', ' '], dominio: [-3, 3], puntos: [{ x: 1, y: 1, etiqueta: 'A' }, { x: 9, y: 0 }] })).toEqual({
      expresiones: ['x^2'],
      dominio: [-3, 3],
      puntos: [{ x: 1, y: 1, etiqueta: 'A' }],
    })
  })
  it('descarta un dominio al revés, enorme o una curva casi sin dibujar', () => {
    expect(limpiarGrafico({ expresiones: ['x'], dominio: [3, -3] })).toBeNull()
    expect(limpiarGrafico({ expresiones: ['x'], dominio: [0, 5000] })).toBeNull()
    expect(limpiarGrafico({ expresiones: ['sqrt(x)'], dominio: [-10, 1] })).toBeNull()
    expect(limpiarGrafico(null)).toBeNull()
  })
})

describe('armarGrafico', () => {
  it('ejes, marcas y un camino por curva', () => {
    const geo = armarGrafico({ expresiones: ['x^2 - 1', 'x'], dominio: [-3, 3], puntos: [{ x: 1, y: 0 }] })
    expect(geo.caminos).toHaveLength(2)
    expect(geo.caminos[0].startsWith('M')).toBe(true)
    expect(geo.ejeX).not.toBeNull()
    expect(geo.ejeY).toBe(160)
    expect(geo.marcasX.map((m) => m.valor)).toContain(0)
    expect(geo.puntos[0].etiqueta).toBe('(1; 0)')
  })
  it('una asíntota corta el camino y no aplasta el resto', () => {
    const geo = armarGrafico({ expresiones: ['1/x'], dominio: [-4, 4] })
    expect((geo.caminos[0].match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(geo.rangoY[1]).toBeLessThan(100)
  })
  it('el paso de las marcas es 1, 2 o 5 por una potencia de 10', () => {
    expect(pasoDeMarcas(6)).toBe(1)
    expect(pasoDeMarcas(40)).toBe(5)
    expect(pasoDeMarcas(0.3)).toBeCloseTo(0.05)
  })
})

describe('lo accesible y lo exportable', () => {
  const g = { expresiones: ['x^2'], dominio: [-2, 2] as [number, number], puntos: [{ x: 0, y: 0, etiqueta: 'Vértice' }] }
  it('la descripción dice las funciones, el dominio y los puntos', () => {
    expect(descripcionDelGrafico(g)).toBe('Gráfico de y = x^2, con x entre -2 y 2. Puntos marcados: Vértice (0; 0).')
  })
  it('el SVG es texto plano, con title y sin colores propios', () => {
    const svg = svgDelGrafico(g)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/)
    expect(svg).toContain('<title>Gráfico de y = x^2')
    expect(svg).not.toMatch(/#[0-9a-f]{3,6}/i)
  })
  it('los temas de funciones', () => {
    expect(temasDeFunciones(['Función cuadrática'])).toBe(true)
    expect(temasDeFunciones(['Límites y continuidad'])).toBe(true)
    expect(temasDeFunciones(['Fracciones equivalentes'])).toBe(false)
  })
})
