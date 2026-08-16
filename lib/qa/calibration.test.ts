import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRECISION_THRESHOLD,
  evaluateGate,
  scoreCalibration,
  type CalibrationCase,
} from './calibration'
import type { Finding } from './rubric'
import type { Question } from '@/lib/types'

/** La pregunta real id 291 del diagnóstico: matemática correcta, tema fuera de programa. */
const conica: Question = {
  id: 'q1',
  topic: 't',
  topicName: 'Ecuación de la parábola',
  question: 'Una parábola tiene su foco en $(0, 3)$ y su directriz es $y = -3$. ¿Cuál es su ecuación?',
  explanation: 'El vértice está en el origen y $p = 3$.',
  type: 'multiple_choice',
  options: ['$x^2 = 6y$', '$y^2 = 6x$', '$x^2 = 12y$', '$y^2 = 12x$'],
  correctAnswer: 2,
}

function testCase(overrides: Partial<CalibrationCase>): CalibrationCase {
  return {
    id: 'quiz_answers.291',
    provenance: 'real',
    persona: 'superior-matematica-sistemas',
    question: conica,
    expected: { dimension: 'adecuacion_programa', minSeverity: 'critical' },
    mustNotFlag: ['correccion_disciplinar'],
    note: 'Cónicas fuera del programa de la Tecnicatura; la matemática está bien (x²=12y).',
    ...overrides,
  }
}

function modelFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    dimension: 'adecuacion_programa',
    severity: 'critical',
    questionIndex: 0,
    justification: 'Cónicas no está en ninguna de las 7 unidades.',
    source: 'model',
    ...overrides,
  }
}

describe('scoreCalibration — recall sobre defectos conocidos', () => {
  it('cuenta detectado cuando el modelo marca la dimensión esperada', () => {
    const score = scoreCalibration('p', [testCase({})], [modelFinding()])
    expect(score.recallReal).toBe(1)
    expect(score.outcomes[0].detected).toBe(true)
  })

  it('cuenta detectado cuando lo atrapa el lint en vez del modelo', () => {
    const score = scoreCalibration(
      'p',
      [testCase({ expected: { dimension: 'higiene_formato', minSeverity: 'critical' }, mustNotFlag: undefined })],
      [modelFinding({ dimension: 'higiene_formato', source: 'lint' })]
    )
    expect(score.recallReal).toBe(1)
  })

  it('NO cuenta detectado cuando la dimensión no es la esperada', () => {
    const score = scoreCalibration('p', [testCase({})], [modelFinding({ dimension: 'calidad_distractores' })])
    expect(score.recallReal).toBe(0)
  })

  it('NO cuenta detectado cuando la severidad es más floja que la exigida', () => {
    const score = scoreCalibration('p', [testCase({})], [modelFinding({ severity: 'major' })])
    expect(score.recallReal).toBe(0)
  })

  it('acepta una severidad más grave que la exigida', () => {
    const score = scoreCalibration(
      'p',
      [testCase({ expected: { dimension: 'adecuacion_programa', minSeverity: 'major' } })],
      [modelFinding({ severity: 'critical' })]
    )
    expect(score.recallReal).toBe(1)
  })
})

describe('scoreCalibration — precisión por dimensión sobre el mismo caso', () => {
  it('un caso malo aporta precisión en las dimensiones donde se le exige silencio', () => {
    // El caso 291 está fuera de programa Y su matemática es correcta: el agente
    // tiene que marcar lo primero y callarse sobre lo segundo.
    const score = scoreCalibration('p', [testCase({})], [modelFinding()])
    expect(score.recallReal).toBe(1)
    expect(score.precisionReal).toBe(1)
    expect(score.counts).toMatchObject({ realBad: 1, realGood: 1 })
  })

  it('detecta al agente que inventa un error disciplinar para justificar la mala nota', () => {
    const score = scoreCalibration(
      'p',
      [testCase({})],
      [modelFinding(), modelFinding({ dimension: 'correccion_disciplinar', severity: 'critical' })]
    )
    expect(score.recallReal).toBe(1)
    expect(score.precisionReal).toBe(0)
    expect(score.outcomes[0].falsePositiveDimensions).toEqual(['correccion_disciplinar'])
  })

  it('un minor no cuenta como falso positivo', () => {
    const score = scoreCalibration(
      'p',
      [testCase({})],
      [modelFinding(), modelFinding({ dimension: 'correccion_disciplinar', severity: 'minor' })]
    )
    expect(score.precisionReal).toBe(1)
  })

  it('un hallazgo en una dimensión fuera de mustNotFlag no penaliza', () => {
    const score = scoreCalibration(
      'p',
      [testCase({})],
      [modelFinding(), modelFinding({ dimension: 'calidad_distractores', severity: 'major' })]
    )
    expect(score.precisionReal).toBe(1)
  })
})

describe('scoreCalibration — casos conocidos como buenos', () => {
  const goodCase = testCase({
    id: 'quiz_answers.291@secundario',
    expected: null,
    mustNotFlag: undefined,
    note: 'La misma pregunta bajo Secundario 4to: cónicas SÍ está en ese programa.',
  })

  it('exige silencio total y pasa cuando el modelo se calla', () => {
    const score = scoreCalibration('p', [goodCase], [])
    expect(score.precisionReal).toBe(1)
    expect(score.outcomes[0].detected).toBeNull()
  })

  it('falla ante cualquier major', () => {
    const score = scoreCalibration('p', [goodCase], [modelFinding({ severity: 'major' })])
    expect(score.precisionReal).toBe(0)
  })

  it('tolera un minor: no todo hallazgo es un falso positivo', () => {
    const score = scoreCalibration('p', [goodCase], [modelFinding({ severity: 'minor' })])
    expect(score.precisionReal).toBe(1)
  })

  it('cuenta aparte los falsos positivos del lint', () => {
    const score = scoreCalibration('p', [goodCase], [modelFinding({ source: 'lint', severity: 'critical' })])
    expect(score.lintFalsePositives).toBe(1)
    // No contamina la precisión del modelo: son métricas de cosas distintas.
    expect(score.precisionReal).toBe(1)
  })
})

describe('scoreCalibration — control negativo cruzado', () => {
  it('la misma pregunta es critical bajo Superior y limpia bajo Secundario', () => {
    // Es la prueba de que la rúbrica discrimina por programa y no por "parece difícil".
    const superior = scoreCalibration('superior-matematica-sistemas', [testCase({})], [modelFinding()])
    const control = scoreCalibration(
      'control-secundario-matematica',
      [testCase({ id: 'quiz_answers.291@control', expected: null, mustNotFlag: undefined })],
      []
    )

    expect(superior.recallReal).toBe(1)
    expect(control.precisionReal).toBe(1)
  })

  it('un agente que marca todo pasa el recall pero cae en el control', () => {
    const marcaTodo = [modelFinding({ severity: 'critical' })]
    const superior = scoreCalibration('superior', [testCase({})], marcaTodo)
    const control = scoreCalibration(
      'control',
      [testCase({ id: 'control', expected: null, mustNotFlag: undefined })],
      marcaTodo
    )

    expect(superior.recallReal).toBe(1)
    expect(control.precisionReal).toBe(0)
  })
})

describe('scoreCalibration — separación real/sintético', () => {
  it('mide los sintéticos por separado', () => {
    const cases = [
      testCase({ id: 'real-bad' }),
      testCase({ id: 'synth-bad', provenance: 'synthetic', mustNotFlag: undefined }),
      testCase({ id: 'synth-good', provenance: 'synthetic', expected: null, mustNotFlag: undefined }),
    ]
    const score = scoreCalibration('p', cases, [modelFinding({ questionIndex: 0 })])

    expect(score.counts).toEqual({ realBad: 1, realGood: 1, syntheticBad: 1, syntheticGood: 1 })
    expect(score.recallReal).toBe(1)
    expect(score.recallSynthetic).toBe(0)
    expect(score.precisionSynthetic).toBe(1)
  })
})

describe('evaluateGate', () => {
  const passing = () => scoreCalibration('p', [testCase({})], [modelFinding()])

  it('aprueba con recall 1,0 y precisión sobre el umbral', () => {
    expect(evaluateGate(passing())).toEqual({ passed: true, reasons: [] })
  })

  it('reprueba si se le escapó un caso real malo, y dice cuál', () => {
    const gate = evaluateGate(scoreCalibration('p', [testCase({})], []))
    expect(gate.passed).toBe(false)
    expect(gate.reasons.join(' ')).toContain('quiz_answers.291')
  })

  it('reprueba por precisión baja y nombra la dimensión del falso positivo', () => {
    const cases = [
      testCase({ id: 'a' }),
      testCase({ id: 'b' }),
      testCase({ id: 'c' }),
      testCase({ id: 'd' }),
    ]
    const findings = [
      ...cases.map((_, index) => modelFinding({ questionIndex: index })),
      // Falso positivo disciplinar en dos de los cuatro → precisión 0,5.
      modelFinding({ questionIndex: 0, dimension: 'correccion_disciplinar' }),
      modelFinding({ questionIndex: 1, dimension: 'correccion_disciplinar' }),
    ]
    const gate = evaluateGate(scoreCalibration('p', cases, findings))
    expect(gate.passed).toBe(false)
    expect(gate.reasons.join(' ')).toContain('Precisión real')
    expect(gate.reasons.join(' ')).toContain('correccion_disciplinar')
  })

  it('NO aprueba un agente que sólo tiene evidencia sintética', () => {
    // Personas 1, 2, 3 y 5 al día de hoy: las 1.680 respuestas del 10/08 son
    // todas de Matemática, así que no tienen ni un caso real.
    const score = scoreCalibration(
      'secundario-historia',
      [testCase({ id: 'synth-bad', provenance: 'synthetic' })],
      [modelFinding({ questionIndex: 0 })]
    )
    const gate = evaluateGate(score)
    expect(score.recallSynthetic).toBe(1)
    expect(gate.passed).toBe(false)
    expect(gate.reasons.join(' ')).toContain('Sin casos reales')
  })

  it('NO aprueba a un agente sin ninguna exigencia de silencio', () => {
    // Sin esto, marcar todo critical daría recall 1,0 y gate verde.
    const score = scoreCalibration('p', [testCase({ mustNotFlag: undefined })], [modelFinding()])
    const gate = evaluateGate(score)
    expect(score.recallReal).toBe(1)
    expect(gate.passed).toBe(false)
    expect(gate.reasons.join(' ')).toContain('Sin evidencia real de precisión')
  })

  it('los sintéticos no bloquean cuando además hay evidencia real', () => {
    const cases = [
      testCase({ id: 'real-bad' }),
      testCase({ id: 'synth-bad', provenance: 'synthetic', mustNotFlag: undefined }),
    ]
    // El sintético queda sin detectar y aun así el gate pasa.
    const gate = evaluateGate(scoreCalibration('p', cases, [modelFinding({ questionIndex: 0 })]))
    expect(gate.passed).toBe(true)
  })

  it('un falso positivo del lint bloquea y manda a arreglar la regex', () => {
    const findings = [
      modelFinding(),
      modelFinding({ dimension: 'correccion_disciplinar', source: 'lint' }),
    ]
    const gate = evaluateGate(scoreCalibration('p', [testCase({})], findings))
    expect(gate.passed).toBe(false)
    expect(gate.reasons.join(' ')).toContain('lint-questions.ts')
  })

  it('el umbral por defecto es el acordado', () => {
    expect(DEFAULT_PRECISION_THRESHOLD).toBe(0.9)
  })
})
