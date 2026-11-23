import { describe, expect, it } from 'vitest'
import { correccionConfirmada, ensayoValido, limpiarRespuesta, limpiarRubrica, notaDeLosCriterios, rubricaValida, sugerenciaValida } from './ensayo'

const RUBRICA = [{ criterio: 'Define el concepto' }, { criterio: 'Da un ejemplo propio' }, { criterio: 'Relaciona con el texto' }]

describe('la rúbrica (W5)', () => {
  it('de 3 a 5 criterios distintos', () => {
    expect(rubricaValida(RUBRICA)).toBe(true)
    expect(rubricaValida(RUBRICA.slice(0, 2))).toBe(false)
    expect(rubricaValida([...RUBRICA, { criterio: 'a1b' }, { criterio: 'c2d' }, { criterio: 'e3f' }])).toBe(false)
    expect(rubricaValida([...RUBRICA.slice(0, 2), { criterio: 'define el concepto' }])).toBe(false)
  })
  it('limpia lo que escribió el docente', () => {
    expect(limpiarRubrica(['  Define  el concepto ', 'x', 'Define el concepto', 'Ejemplo propio', 'Usa el vocabulario', 'Cita el texto', 'Concluye'])).toEqual([
      { criterio: 'Define el concepto' },
      { criterio: 'Ejemplo propio' },
      { criterio: 'Usa el vocabulario' },
      { criterio: 'Cita el texto' },
      { criterio: 'Concluye' },
    ])
  })
})

describe('la nota', () => {
  it('sale de los niveles (logrado 1, parcial ½)', () => {
    expect(notaDeLosCriterios([{ nivel: 'logrado' }, { nivel: 'parcial' }, { nivel: 'no_logrado' }])).toBe(5)
    expect(notaDeLosCriterios([{ nivel: 'logrado' }, { nivel: 'logrado' }, { nivel: 'parcial' }])).toBe(8.3)
    expect(notaDeLosCriterios([])).toBe(0)
  })
})

describe('la sugerencia de la IA', () => {
  const buena = {
    criterios: [
      { nivel: 'logrado', devolucion: 'Bien definido.' },
      { nivel: 'parcial', devolucion: 'El ejemplo es del texto, no propio.' },
      { nivel: 'no_logrado', devolucion: 'Falta relacionarlo.' },
    ],
    nota: 5.5,
    devolucion: 'Vas bien; sumá un ejemplo tuyo.',
  }
  it('se acepta con un criterio por cada uno de la rúbrica', () => {
    expect(sugerenciaValida(buena, RUBRICA)).toMatchObject({ nota: 5.5, criterios: [{ criterio: 'Define el concepto', nivel: 'logrado' }, {}, {}] })
  })
  it('una nota que no cierra con los niveles se reemplaza', () => {
    expect(sugerenciaValida({ ...buena, nota: 9 }, RUBRICA)?.nota).toBe(5)
  })
  it('mal armada, null', () => {
    expect(sugerenciaValida({ ...buena, criterios: buena.criterios.slice(0, 2) }, RUBRICA)).toBeNull()
    expect(sugerenciaValida({ ...buena, criterios: [{ nivel: 'excelente' }, ...buena.criterios.slice(1)] }, RUBRICA)).toBeNull()
    expect(sugerenciaValida(null, RUBRICA)).toBeNull()
  })
})

describe('lo que confirma el docente', () => {
  it('nota entre 0 y 10; los criterios con nivel válido', () => {
    expect(correccionConfirmada({ nota: 7.25, devolucion: ' Bien ', criterios: [{ nivel: 'logrado' }, { nivel: 'otro' }] }, RUBRICA)).toEqual({
      nota: 7.3,
      devolucion: 'Bien',
      criterios: [{ criterio: 'Define el concepto', nivel: 'logrado', devolucion: '' }],
    })
    expect(correccionConfirmada({ nota: 11 }, RUBRICA)).toBeNull()
    expect(correccionConfirmada({ nota: 'x' }, RUBRICA)).toBeNull()
  })
})

describe('la pregunta y la respuesta', () => {
  it('un ensayo bien armado tiene consigna y rúbrica', () => {
    expect(ensayoValido({ question: 'Explicá qué es el etnocentrismo.', rubrica: RUBRICA })).toBe(true)
    expect(ensayoValido({ question: 'Corta', rubrica: RUBRICA })).toBe(false)
    expect(ensayoValido({ question: 'Explicá qué es el etnocentrismo.', rubrica: [] })).toBe(false)
  })
  it('la respuesta se limpia y tiene tope', () => {
    expect(limpiarRespuesta('  hola\r\nchau  ')).toBe('hola\nchau')
    expect(limpiarRespuesta('a'.repeat(7000))).toHaveLength(6000)
  })
})

describe('tiposSugeridosDelArea', () => {
  it('sugiere el ensayo en un área conceptual y no en una cuantitativa', async () => {
    const { tiposSugeridosDelArea, PERFILES, AREA_IDS } = await import('@/lib/areas')
    const conceptual = AREA_IDS.find((a) => PERFILES[a].caracter === 'conceptual')!
    const cuantitativa = AREA_IDS.find((a) => PERFILES[a].caracter === 'cuantitativo')!
    expect(tiposSugeridosDelArea(conceptual)).toEqual(['essay'])
    expect(tiposSugeridosDelArea(cuantitativa)).toEqual([])
  })
})
