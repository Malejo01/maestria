import { describe, it, expect } from 'vitest'
import {
  CHANCE_FLOOR,
  DIAGNOSTIC_UNIT_PROGRAM_MAP,
  RELIABLE_QUESTION_TYPES,
  accuracy,
  chanceVerdict,
  programLinkFor,
  suggestStrategy,
  summarizeDispersion,
} from './diagnostic-report'

describe('tipos confiables', () => {
  it('deja short_answer afuera', () => {
    expect(RELIABLE_QUESTION_TYPES).not.toContain('short_answer')
    expect(RELIABLE_QUESTION_TYPES).toEqual(['multiple_choice', 'true_false', 'numeric'])
  })

  it('el piso de azar de numeric es cero y el de true_false es la mitad', () => {
    expect(CHANCE_FLOOR.numeric).toBe(0)
    expect(CHANCE_FLOOR.true_false).toBe(0.5)
    expect(CHANCE_FLOOR.multiple_choice).toBe(0.25)
  })
})

describe('accuracy', () => {
  it('devuelve null sin respuestas en vez de 0', () => {
    // Un 0% y un "no contestó nada" no son lo mismo y no pueden mostrarse igual.
    expect(accuracy({ total: 0, correct: 0 })).toBeNull()
  })

  it('calcula la proporción', () => {
    expect(accuracy({ total: 4, correct: 1 })).toBe(0.25)
  })
})

describe('chanceVerdict', () => {
  it('numeric no tiene piso que descontar', () => {
    expect(chanceVerdict('numeric', { total: 50, correct: 4 })).toBe('sin_piso')
  })

  it('sin respuestas informa sin_datos', () => {
    expect(chanceVerdict('multiple_choice', { total: 0, correct: 0 })).toBe('sin_datos')
  })

  it('un 30% en múltiple choice con n grande sigue siendo azar', () => {
    // El caso que motiva todo el módulo: 30% parece "regular" y no lo es.
    expect(chanceVerdict('multiple_choice', { total: 100, correct: 30 })).toBe('azar')
  })

  it('un 28% sobre 257 respuestas —el dato real de Geometría— es azar', () => {
    expect(chanceVerdict('multiple_choice', { total: 257, correct: 72 })).toBe('azar')
  })

  it('un 46% sobre 282 —el dato real de Números y Operaciones— supera el azar', () => {
    expect(chanceVerdict('multiple_choice', { total: 282, correct: 130 })).toBe('sobre_azar')
  })

  it('detecta estar por debajo del piso', () => {
    // Peor que adivinar: hay distractores que atraen activamente.
    expect(chanceVerdict('true_false', { total: 200, correct: 60 })).toBe('bajo_azar')
  })

  it('exige más evidencia cuando el n es chico', () => {
    // Misma proporción (60%), veredicto distinto según cuántas respuestas la
    // sostienen. Es justamente lo que un umbral fijo de porcentaje no haría.
    expect(chanceVerdict('true_false', { total: 10, correct: 6 })).toBe('azar')
    expect(chanceVerdict('true_false', { total: 1000, correct: 600 })).toBe('sobre_azar')
  })
})

describe('summarizeDispersion', () => {
  it('devuelve null sin alumnos', () => {
    expect(summarizeDispersion([])).toBeNull()
  })

  it('no produce NaN con un solo alumno', () => {
    const resultado = summarizeDispersion([0.5])
    expect(resultado?.stdDev).toBe(0)
    expect(resultado?.median).toBe(0.5)
  })

  it('calcula la mediana con n par', () => {
    expect(summarizeDispersion([0.2, 0.4, 0.6, 0.8])?.median).toBeCloseTo(0.5)
  })

  it('cuenta los extremos que deciden la estrategia', () => {
    const resultado = summarizeDispersion([0.1, 0.3, 0.34, 0.62, 0.7, 0.9])
    expect(resultado?.below35).toBe(3)
    expect(resultado?.atOrAbove60).toBe(3)
  })

  it('separa dos cursos con el mismo promedio y distinto reparto', () => {
    const parejo = summarizeDispersion([0.4, 0.4, 0.4, 0.4, 0.4, 0.4])
    const partido = summarizeDispersion([0.1, 0.1, 0.1, 0.7, 0.7, 0.7])

    expect(parejo?.mean).toBeCloseTo(partido?.mean ?? 0)
    expect(partido?.stdDev).toBeGreaterThan(parejo?.stdDev ?? 0)
  })
})

describe('suggestStrategy', () => {
  it('sin pares que sepan, pide frontal', () => {
    // Probabilidad y Estadística real: ningún alumno pasó el 56%.
    const dispersion = summarizeDispersion([0.12, 0.2, 0.28, 0.31, 0.35, 0.4, 0.45, 0.5, 0.56])
    expect(suggestStrategy(dispersion)).toBe('frontal')
  })

  it('con pares que saben, sugiere trabajo entre pares', () => {
    const dispersion = summarizeDispersion([0.19, 0.25, 0.3, 0.33, 0.62, 0.7, 0.81])
    expect(suggestStrategy(dispersion)).toBe('pares')
  })

  it('no arriesga estrategia con menos de 5 alumnos', () => {
    expect(suggestStrategy(summarizeDispersion([0.8, 0.9]))).toBe('sin_datos')
  })

  it('reconoce el tema que el curso ya tiene', () => {
    expect(suggestStrategy(summarizeDispersion([0.62, 0.7, 0.75, 0.8, 0.9]))).toBe('repaso_puntual')
  })
})

describe('mapeo contra el programa', () => {
  it('sólo dos de las cuatro unidades del diagnóstico entran en el programa', () => {
    const conProgama = Object.values(DIAGNOSTIC_UNIT_PROGRAM_MAP).filter(
      (link) => link.programUnit !== null,
    )
    expect(conProgama).toHaveLength(2)
  })

  it('cónicas y probabilidad quedan explícitamente fuera', () => {
    expect(programLinkFor('Geometría y Medida').programUnit).toBeNull()
    expect(programLinkFor('Probabilidad y Estadística').programUnit).toBeNull()
  })

  it('números reales apunta a la Unidad 3 y funciones a la Unidad 5', () => {
    expect(programLinkFor('Números y Operaciones').programUnit).toContain('Unidad 3')
    expect(programLinkFor('Álgebra y Funciones').programUnit).toContain('Unidad 5')
  })

  it('una unidad desconocida no rompe: no se inventa vínculo con el programa', () => {
    const link = programLinkFor('Trigonometría Esférica')
    expect(link.programUnit).toBeNull()
    expect(link.rationale).toBeTruthy()
  })
})
