import { describe, expect, it } from 'vitest'
import { CONFIANZA_BAJA, inferirArea, inferirCaracterDeUnidad, separarMateriaDeContexto } from './inferir-area'
import type { AreaId } from './areas'

/** Nombres reales de materias de Argentina (planes de institutos y universidades). */
const MATERIAS: [string, AreaId][] = [
  ['Temas de Antropología Cultural en Psicología', 'sociales'],
  ['Matemática y su Didáctica', 'educacion'],
  ['Microeconomía', 'economia'],
  ['Marketing I', 'administracion'],
  ['Contabilidad Básica', 'contabilidad'],
  ['Enfermería Comunitaria', 'salud'],
  ['Derecho Civil', 'derecho'],
  ['Matemática I', 'matematica'],
  ['Análisis de Sistemas', 'informatica'],
  ['Análisis Matemático II', 'matematica'],
  ['Álgebra y Geometría Analítica', 'matematica'],
  ['Probabilidad y Estadística', 'estadistica'],
  ['Física I', 'fisica'],
  ['Química General e Inorgánica', 'quimica'],
  ['Biología Celular', 'biologia'],
  ['Programación I', 'informatica'],
  ['Base de Datos', 'informatica'],
  ['Macroeconomía', 'economia'],
  ['Administración General', 'administracion'],
  ['Psicología Evolutiva', 'psicologia'],
  ['Sociología', 'sociales'],
  ['Historia Argentina', 'sociales'],
  ['Filosofía', 'sociales'],
  ['Didáctica General', 'educacion'],
  ['Derecho Constitucional', 'derecho'],
  ['Lengua y Literatura', 'lengua'],
  ['Inglés Técnico', 'lengua'],
  ['Diseño Gráfico I', 'artes'],
  ['Matemática Financiera', 'contabilidad'],
  ['Farmacología', 'salud'],
  ['Costos', 'contabilidad'],
  ['Comercialización', 'administracion'],
  ['Prácticas del Lenguaje', 'lengua'],
  ['Geografía', 'sociales'],
  ['Estadística Aplicada a la Psicología', 'estadistica'],
  ['Fundamentos de Enfermería', 'salud'],
  ['Introducción al Derecho', 'derecho'],
  ['Didáctica de la Matemática', 'educacion'],
  ['Educ. Tecnológica', 'informatica'],
]

describe('inferirArea: 39 materias reales', () => {
  it.each(MATERIAS)('%s → %s', (materia, area) => {
    const inferida = inferirArea(materia)
    expect(inferida.area).toBe(area)
    expect(inferida.confianza).toBeGreaterThanOrEqual(CONFIANZA_BAJA)
  })
})

describe('inferirArea: lo que no se reconoce', () => {
  it('un nombre sin pistas es Otra, con confianza baja', () => {
    const inferida = inferirArea('Taller I')
    expect(inferida.area).toBe('otra')
    expect(inferida.confianza).toBeLessThan(CONFIANZA_BAJA)
  })

  it('sin pistas en el nombre, las unidades deciden con confianza baja', () => {
    const inferida = inferirArea('Taller I', null, [
      { name: 'Unidad 1: Cultura y sociedad', topics: [{ name: 'Etnocentrismo' }, { name: 'Antropología urbana' }] },
    ])
    expect(inferida.area).toBe('sociales')
    expect(inferida.confianza).toBeLessThan(CONFIANZA_BAJA)
  })

  it('la carrera sola no decide por la materia', () => {
    expect(inferirArea('Temas de Antropología Cultural en Psicología', 'Licenciatura en Psicología').area).toBe('sociales')
  })
})

describe('separarMateriaDeContexto', () => {
  it('"X en Y": X es la materia', () => {
    expect(separarMateriaDeContexto('Temas de Antropología Cultural en Psicología')).toEqual({
      nucleo: 'antropologia cultural',
      contexto: 'psicologia',
    })
  })
  it('sin conector, todo es materia', () => {
    expect(separarMateriaDeContexto('Microeconomía').contexto).toBe('')
  })
})

describe('el carácter de cada unidad', () => {
  it('Matemática y su Didáctica: números, geometría y estadística con cálculos; la enseñanza, conceptual', () => {
    const { area, caracteres } = inferirArea('Matemática y su Didáctica', 'Profesorado de Educación Primaria', [
      { name: 'Unidad 1: El campo de la didáctica de la matemática', topics: [{ name: 'Transposición didáctica' }, { name: 'Obstáculos' }] },
      { name: 'Unidad 2: Números naturales y sistema de numeración', topics: [{ name: 'Valor posicional' }, { name: 'Operaciones' }] },
      { name: 'Unidad 3: Números racionales', topics: [{ name: 'Fracciones' }, { name: 'Decimales' }] },
      { name: 'Unidad 4: Geometría y medida', topics: [{ name: 'Figuras' }, { name: 'Perímetro' }] },
      { name: 'Unidad 5: Estadística y probabilidad', topics: [{ name: 'Gráficos' }, { name: 'Azar' }] },
      { name: 'Unidad 6: La enseñanza de las fracciones', topics: [{ name: 'Errores frecuentes' }, { name: 'Secuencias' }] },
    ])
    expect(area).toBe('educacion')
    expect(caracteres).toEqual(['conceptual', 'cuantitativo', 'cuantitativo', 'cuantitativo', 'cuantitativo', 'conceptual'])
  })

  it('Antropología: todo conceptual', () => {
    const { caracteres } = inferirArea('Temas de Antropología Cultural en Psicología', null, [
      { name: 'Unidad 1', topics: [{ name: 'El concepto de cultura' }, { name: 'Etnocentrismo y relativismo' }] },
      { name: 'Unidad 2', topics: [{ name: 'Parentesco' }, { name: 'Rituales' }] },
    ])
    expect(caracteres).toEqual(['conceptual', 'conceptual'])
  })

  it('Matemática: todo cuantitativo, salvo una unidad de enseñanza', () => {
    expect(inferirCaracterDeUnidad('matematica', { name: 'Funciones lineales' })).toBe('cuantitativo')
    expect(inferirCaracterDeUnidad('matematica', { name: 'Historia de la matemática' })).toBe('conceptual')
  })

  it('una unidad de cálculos en un área conceptual queda mixta', () => {
    expect(
      inferirCaracterDeUnidad('administracion', { name: 'Unidad 4', topics: [{ name: 'Punto de equilibrio y cálculo de costos' }, { name: 'Porcentaje de margen' }] }),
    ).toBe('mixto')
  })

  it('economía, sin pistas, queda con el carácter del área', () => {
    expect(inferirCaracterDeUnidad('economia', { name: 'Unidad 2: Oferta y demanda' })).toBe('mixto')
  })
})
