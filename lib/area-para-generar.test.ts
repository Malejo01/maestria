import { describe, expect, it } from 'vitest'
import { BLOQUE_LATEX, bloqueDeNotacion, contextoDeArea, descripcionDelModo, mezclaDelArea, seccionDeArea } from './area-para-generar'

const DIDACTICA = [
  { name: 'Unidad I: Números', caracter: 'cuantitativo', topics: [{ id: 'n1', name: 'Fracciones' }, { id: 'n2', name: 'Decimales' }] },
  { name: 'Unidad II: Enseñanza', caracter: 'conceptual', topics: [{ id: 'd1', name: 'Obstáculos' }, { id: 'd2', name: 'Secuencias' }] },
]

describe('contextoDeArea', () => {
  it('sólo cuentan las unidades de los temas elegidos', () => {
    const ctx = contextoDeArea({ area: 'educacion', unidades: DIDACTICA, temas: [{ id: 'd1', name: 'Obstáculos' }] })
    expect(ctx.caracteres).toEqual(['conceptual'])
    expect(ctx.bloques.latex).toBe(false)
  })

  it('con temas de las dos, pesa cada una por la cantidad de temas', () => {
    const ctx = contextoDeArea({
      area: 'educacion',
      unidades: DIDACTICA,
      temas: [{ name: 'Fracciones' }, { name: 'Decimales' }, { name: 'Obstáculos' }],
    })
    expect(ctx.pesos).toEqual([{ caracter: 'cuantitativo', temas: 2 }, { caracter: 'conceptual', temas: 1 }])
    expect(ctx.bloques.latex).toBe(true)
    const mezcla = mezclaDelArea(ctx, 'practico')
    expect(mezcla.numeric).toBeGreaterThan(20)
  })

  it('sin unidades (P4 manda sólo temas): el carácter del área', () => {
    const ctx = contextoDeArea({ area: 'psicologia', unidades: [], temas: [{ name: 'Apego' }] })
    expect(ctx.caracteres).toEqual(['conceptual'])
  })
})

describe('el prompt', () => {
  it('Antropología: "práctico" es análisis, sin cálculos, sin bloque de LaTeX', () => {
    const ctx = contextoDeArea({ area: 'sociales', unidades: [], temas: [] })
    expect(descripcionDelModo(ctx, 'practico')).toMatch(/^MODO PRÁCTICO: Análisis de situaciones/)
    expect(seccionDeArea(ctx, 'practico')).toContain('SIN cálculos')
    expect(bloqueDeNotacion(ctx.bloques)).toBe('')
  })

  it('matemática: el bloque de LaTeX de siempre y la descripción de siempre', () => {
    const ctx = contextoDeArea({ area: 'matematica', unidades: [], temas: [] })
    expect(bloqueDeNotacion(ctx.bloques)).toBe(BLOQUE_LATEX)
    expect(descripcionDelModo(ctx, 'practico')).toBe('MODO PRÁCTICO: Ejercicios de cálculo y resolución de problemas numéricos.')
    expect(descripcionDelModo(ctx, 'teorico')).toBe(
      'MODO TEÓRICO: Preguntas conceptuales sobre definiciones, teoremas y propiedades. Sin cálculos numéricos complejos.',
    )
  })

  it('informática: el bloque de código, sin LaTeX', () => {
    const ctx = contextoDeArea({ area: 'informatica', unidades: [], temas: [] })
    expect(bloqueDeNotacion(ctx.bloques)).toMatch(/^CÓDIGO:/)
  })

  it('en el mixto, la sección explica los dos modos', () => {
    const ctx = contextoDeArea({ area: 'derecho', unidades: [], temas: [] })
    const seccion = seccionDeArea(ctx, 'mixto')
    expect(seccion).toContain('- Teórico:')
    expect(seccion).toContain('- Práctico: Casos breves')
  })
})
