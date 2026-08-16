import { describe, expect, it } from 'vitest'
import {
  buildReport,
  countByDimension,
  countBySeverity,
  evidenceBasis,
  reportPath,
  sortFindings,
  withProvenance,
} from './report'
import { assertRubricComplete, dimensionsFor, validateFindings, type Finding } from './rubric'
import { assertPersonaGrados, materiasParaCorrida, personaById, PERSONAS } from './personas'

const NOW = new Date('2026-08-15T22:30:00.000Z')

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    dimension: 'adecuacion_programa',
    severity: 'critical',
    questionIndex: 0,
    justification: 'x',
    source: 'model',
    ...overrides,
  }
}

describe('sortFindings', () => {
  it('ordena por severidad y después por número de pregunta', () => {
    const sorted = sortFindings([
      finding({ severity: 'minor', questionIndex: 0 }),
      finding({ severity: 'critical', questionIndex: 5 }),
      finding({ severity: 'major', questionIndex: 1 }),
      finding({ severity: 'critical', questionIndex: 2 }),
    ])
    expect(sorted.map((f) => [f.severity, f.questionIndex])).toEqual([
      ['critical', 2],
      ['critical', 5],
      ['major', 1],
      ['minor', 0],
    ])
  })
})

describe('evidenceBasis', () => {
  it('clasifica según la mezcla', () => {
    expect(evidenceBasis({ real: 0, synthetic: 0 })).toBe('generated')
    expect(evidenceBasis({ real: 3, synthetic: 0 })).toBe('real')
    expect(evidenceBasis({ real: 0, synthetic: 3 })).toBe('synthetic')
    expect(evidenceBasis({ real: 3, synthetic: 3 })).toBe('mixed')
  })
})

describe('withProvenance', () => {
  it('antepone la advertencia cuando la evidencia es fabricada', () => {
    const summary = withProvenance('El agente detectó todo.', { real: 0, synthetic: 6 })
    expect(summary.startsWith('⚠ EVIDENCIA SINTÉTICA')).toBe(true)
    expect(summary).toContain('El agente detectó todo.')
  })

  it('avisa también cuando la evidencia es mixta', () => {
    expect(withProvenance('ok', { real: 2, synthetic: 4 })).toContain('EVIDENCIA MIXTA')
  })

  it('no ensucia el resumen cuando toda la evidencia es real', () => {
    expect(withProvenance('  ok  ', { real: 5, synthetic: 0 })).toBe('ok')
  })

  it('no ensucia el resumen de una corrida sobre generación nueva', () => {
    expect(withProvenance('ok', { real: 0, synthetic: 0 })).toBe('ok')
  })
})

describe('buildReport', () => {
  it('respeta el shape acordado y suma los aditivos', () => {
    const report = buildReport({
      persona: 'superior-matematica-sistemas',
      kind: 'run',
      findings: [finding()],
      summary: 'Resumen.',
      model: 'claude-opus-5',
      effort: 'high',
      questionCount: 10,
      dimensionsEvaluated: dimensionsFor('Superior'),
      evidenceCounts: { real: 0, synthetic: 0 },
      now: NOW,
    })

    expect(report.persona).toBe('superior-matematica-sistemas')
    expect(report.timestamp).toBe('2026-08-15T22:30:00.000Z')
    expect(report.findings).toHaveLength(1)
    expect(report.summary).toBe('Resumen.')
    expect(report.dimensionsEvaluated).toContain('situacion_profesional')
    expect(report.evidence).toBe('generated')
    expect(report.generationCacheKey).toBeNull()
  })

  it('deja fuera situacion_profesional cuando no es Superior', () => {
    const report = buildReport({
      persona: 'secundario-historia',
      kind: 'run',
      findings: [],
      summary: '',
      model: 'claude-opus-5',
      effort: 'high',
      questionCount: 10,
      dimensionsEvaluated: dimensionsFor('Secundario'),
      evidenceCounts: { real: 0, synthetic: 0 },
      now: NOW,
    })
    expect(report.dimensionsEvaluated).not.toContain('situacion_profesional')
  })
})

describe('countBySeverity / countByDimension', () => {
  it('cuenta por severidad', () => {
    expect(countBySeverity([finding(), finding({ severity: 'minor' })])).toEqual({ critical: 1, minor: 1 })
  })

  it('incluye en cero las dimensiones evaluadas sin hallazgos', () => {
    const counts = countByDimension([finding()], dimensionsFor('Secundario'))
    expect(counts.adecuacion_programa).toBe(1)
    expect(counts.correccion_disciplinar).toBe(0)
    expect(counts).not.toHaveProperty('situacion_profesional')
  })
})

describe('reportPath', () => {
  it('agrupa por fecha y distingue calibración de corrida', () => {
    expect(reportPath('secundario-lengua', 'run', NOW)).toBe('qa-reports/2026-08-15/secundario-lengua.json')
    expect(reportPath('secundario-lengua', 'calibration', NOW)).toBe(
      'qa-reports/2026-08-15/calibration-secundario-lengua.json'
    )
  })
})

describe('validateFindings', () => {
  it('descarta índices que no apuntan a ninguna pregunta', () => {
    const { valid, dropped } = validateFindings(
      [finding({ questionIndex: 0 }), finding({ questionIndex: 12 }), finding({ questionIndex: -1 })],
      10
    )
    expect(valid).toHaveLength(1)
    expect(dropped).toHaveLength(2)
  })
})

describe('personas', () => {
  it('las cinco personas usan etiquetas de grado que existen en curriculum', () => {
    expect(() => assertPersonaGrados()).not.toThrow()
  })

  it('sólo la persona de Superior lleva carrera', () => {
    const conCarrera = PERSONAS.filter((persona) => persona.carrera !== null)
    expect(conCarrera).toHaveLength(1)
    expect(conCarrera[0].nivel).toBe('Superior')
  })

  it('ninguna persona usa "Grado" en la etiqueta: curriculum usa "Año"', () => {
    // El bug silencioso que esto previene: "1er Grado" devuelve cero filas de
    // ground truth y adecuacion_programa se evalúa a ciegas, con un verde.
    for (const persona of PERSONAS) {
      expect(persona.grado).not.toContain('Grado')
    }
  })

  it('rota las materias de la persona multi-materia de forma determinista', () => {
    const docente = personaById('primario-docente-multimateria')
    expect(materiasParaCorrida(docente, 0)).toEqual(['Matemática', 'Lengua'])
    expect(materiasParaCorrida(docente, 2)).toEqual(['Ciencias Naturales', 'Ciencias Sociales'])
    // Determinista: la misma corrida se repite igual.
    expect(materiasParaCorrida(docente, 0)).toEqual(materiasParaCorrida(docente, 0))
    // Y da la vuelta sin salirse del array.
    expect(materiasParaCorrida(docente, 5)).toEqual(['Educación Artística', 'Matemática'])
  })

  it('las personas de una sola materia no rotan', () => {
    const lengua = personaById('secundario-lengua')
    expect(materiasParaCorrida(lengua, 0)).toEqual(['Lengua y Literatura'])
    expect(materiasParaCorrida(lengua, 7)).toEqual(['Lengua y Literatura'])
  })

  it('los ids son únicos', () => {
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(PERSONAS.length)
  })
})

describe('rubric', () => {
  it('toda dimensión evaluable tiene su texto', () => {
    expect(() => assertRubricComplete()).not.toThrow()
  })

  it('situacion_profesional sólo aplica a Superior', () => {
    expect(dimensionsFor('Superior')).toContain('situacion_profesional')
    expect(dimensionsFor('Primario')).not.toContain('situacion_profesional')
    expect(dimensionsFor('Secundario')).not.toContain('situacion_profesional')
  })
})
