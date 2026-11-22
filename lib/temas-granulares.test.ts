import { describe, expect, it } from 'vitest'
import { LARGO_MAXIMO_DE_TEMA, REGLAS_DE_TEMAS, divisionFiel, granularizarUnidades, partirTema, separarTemaLargo, temasPorDividir } from './temas-granulares'

/** Un párrafo sintético con la forma de los programas universitarios de la 07, 08 y 09. */
const PARRAFO =
  'Sistemas de m ecuaciones lineales con n incógnitas. Reducción a la forma escalonada (Método de Gauss): discusión y resolución de sistemas homogéneos y no homogéneos. Solución general. Interpretación geométrica en R2 y R3. Forma matricial de un sistema. Rango de una matriz. Teorema de Rouché-Frobenius. Problemas de aplicación'

describe('partirTema (I2)', () => {
  it('un párrafo de conceptos encadenados por punto se parte en temas', () => {
    const temas = partirTema(PARRAFO)
    expect(temas).toEqual([
      'Sistemas de m ecuaciones lineales con n incógnitas',
      'Reducción a la forma escalonada (Método de Gauss): discusión y resolución de sistemas homogéneos y no homogéneos',
      'Solución general',
      'Interpretación geométrica en R2 y R3',
      'Forma matricial de un sistema',
      'Rango de una matriz',
      'Teorema de Rouché-Frobenius',
      'Problemas de aplicación',
    ])
    // Nada inventado: cada tema es texto del párrafo.
    for (const tema of temas) expect(PARRAFO).toContain(tema)
  })

  it('también por punto y coma', () => {
    expect(partirTema('Conjuntos numéricos y sus propiedades en la recta real; operaciones con intervalos; valor absoluto y distancia entre dos puntos')).toEqual([
      'Conjuntos numéricos y sus propiedades en la recta real',
      'operaciones con intervalos',
      'valor absoluto y distancia entre dos puntos',
    ])
  })

  it('un tema corto no se toca, aunque tenga comas o puntos', () => {
    expect(partirTema('Figuras geométricas planas, perímetro, área')).toEqual(['Figuras geométricas planas, perímetro, área'])
    expect(partirTema('Números reales. Intervalos.')).toEqual(['Números reales. Intervalos.'])
  })

  it('no corta en decimales ni en notación como R2.3', () => {
    const largo = 'Aproximación de 3.14 y de 2.71 como números irracionales en la recta numérica y su error relativo porcentual'
    expect(largo.length).toBeGreaterThan(LARGO_MAXIMO_DE_TEMA)
    expect(partirTema(largo)).toEqual([largo])
  })
})

describe('granularizarUnidades', () => {
  it('parte los temas de cada unidad y no repite dentro de la misma', () => {
    const [unidad] = granularizarUnidades([
      { name: 'Unidad III', topics: [{ name: PARRAFO }, { name: 'Rango de una matriz' }] },
    ])
    expect(unidad.topics.length).toBeGreaterThanOrEqual(4)
    expect(unidad.topics.filter((t) => t.name === 'Rango de una matriz')).toHaveLength(1)
    expect(Math.max(...unidad.topics.map((t) => t.name.length))).toBeLessThanOrEqual(120)
  })
})

describe('REGLAS_DE_TEMAS', () => {
  it('pide conceptos separados, el largo máximo y no inventar', () => {
    expect(REGLAS_DE_TEMAS).toContain('enseñar y evaluar por separado')
    expect(REGLAS_DE_TEMAS).toContain(`${LARGO_MAXIMO_DE_TEMA} caracteres`)
    expect(REGLAS_DE_TEMAS).toContain('No inventes')
  })
})

describe('D1 · separarTemaLargo (la Unidad 1 que quedó como un tema de ~600 caracteres)', () => {
  // Texto de ejemplo, escrito para el test (no es el programa de Silvana).
  const UNIDAD_EN_COMAS =
    'La antropología como disciplina científica y su objeto de estudio, el trabajo de campo y la observación participante, ' +
    'el concepto de cultura en sus distintas definiciones, la diversidad cultural y sus formas de explicación, ' +
    'etnocentrismo y relativismo cultural como posiciones frente al otro, la construcción social de la identidad y la alteridad, ' +
    'el lugar de la antropología en la formación del psicólogo, los aportes de la antropología a la comprensión del sufrimiento psíquico, ' +
    'cultura, salud y enfermedad en distintas sociedades, los rituales y su función social'

  it('un párrafo largo en comas se parte (seguro): cada pedazo es un tema', () => {
    const r = separarTemaLargo(UNIDAD_EN_COMAS)
    expect(UNIDAD_EN_COMAS.length).toBeGreaterThan(500)
    expect(r.seguro).toBe(true)
    expect(r.pedazos.length).toBeGreaterThanOrEqual(8)
    expect(r.pedazos).toContain('etnocentrismo y relativismo cultural como posiciones frente al otro')
    for (const p of r.pedazos) expect(p.length).toBeLessThanOrEqual(LARGO_MAXIMO_DE_TEMA)
  })

  it('con punto y minúscula, viñetas, guiones e ítems numerados', () => {
    expect(separarTemaLargo('El concepto de cultura y sus definiciones clásicas. etnocentrismo y relativismo cultural frente a la diversidad').pedazos).toHaveLength(2)
    expect(separarTemaLargo('Parentesco y familia en distintas sociedades • Rituales y ritos de paso • El cuerpo como construcción cultural').pedazos).toHaveLength(3)
    expect(separarTemaLargo('Parentesco y familia en distintas sociedades - Rituales y ritos de paso - El cuerpo como construcción cultural').pedazos).toHaveLength(3)
    expect(separarTemaLargo('1) Parentesco y familia en distintas sociedades 2) Rituales y ritos de paso 3) El cuerpo como construcción cultural').pedazos).toHaveLength(3)
  })

  it('un tema corto con comas no se toca; uno largo sin dónde cortar no es seguro (va a la IA)', () => {
    expect(separarTemaLargo('Figuras planas, perímetro y área')).toEqual({ pedazos: ['Figuras planas, perímetro y área'], seguro: true })
    const largo = 'La relación entre la experiencia subjetiva del padecimiento y los modos en que cada sociedad organiza sus respuestas frente a la enfermedad y la muerte'
    expect(separarTemaLargo(largo).seguro).toBe(false)
    expect(temasPorDividir([{ topics: [{ name: largo }, { name: 'Corto' }] }])).toEqual([largo])
  })

  it('la división de la IA sólo vale si sale del párrafo', () => {
    const parrafo = 'La relación entre la experiencia subjetiva del padecimiento y los modos sociales de respuesta frente a la enfermedad'
    expect(divisionFiel(parrafo, ['La experiencia subjetiva del padecimiento', 'Los modos sociales de respuesta frente a la enfermedad'])).toBe(true)
    expect(divisionFiel(parrafo, ['El complejo de Edipo', 'Los modos sociales de respuesta'])).toBe(false)
    expect(divisionFiel(parrafo, ['Un solo pedazo'])).toBe(false)
  })

  it('granularizarUnidades usa las divisiones de la IA cuando las hay', () => {
    const largo = 'Un párrafo largo que no se puede partir con certeza porque no tiene puntos ni comas ni marcas de ningún tipo en todo su texto'
    const r = granularizarUnidades([{ name: 'Unidad 1', topics: [{ name: largo }] }], new Map([[largo, ['Uno', 'Dos']]]))
    expect(r[0].topics.map((t) => t.name)).toEqual(['Uno', 'Dos'])
  })
})
