/**
 * Lectura del diagnóstico del 2026-08-10.
 *
 * Este módulo existe porque los datos de ese día NO se pueden leer como se lee
 * un cuestionario cualquiera, y las tres razones son irreversibles:
 *
 * 1. `short_answer` no es interpretable. El bug de `maxOutputTokens` cortaba el
 *    JSON de Gemini antes del veredicto y el cliente guardaba `false` en
 *    silencio: 224 de 235 quedaron marcadas incorrectas sin forma de
 *    distinguirlas de un error real (la migración 021, que hizo `is_correct`
 *    nullable, es posterior). No se excluyen por prolijidad — se excluyen
 *    porque usarlas para evaluar a alguien sería inventar.
 *
 * 2. El piso de azar cambia por tipo de pregunta. Un 30% en múltiple choice de
 *    4 opciones está POR DEBAJO del 25% que da tirar una moneda cargada, y un
 *    55% en verdadero/falso es indistinguible de adivinar. Reportar los tres
 *    tipos en una sola columna de "porcentaje" convierte ruido en diagnóstico.
 *    `numeric` es el único sin piso: es lo que el alumno puede producir.
 *
 * 3. Los alumnos estaban registrados como Secundario 4to, así que la mitad del
 *    diagnóstico midió temas que no están en el programa de la carrera. Un
 *    reporte que no separe lo que entra de lo que no, preocupa a un alumno por
 *    un 24% en cónicas que nadie le va a tomar.
 */

/** Día del diagnóstico. Los intentos de esa fecha tienen `classroom_id` NULL. */
export const DIAGNOSTIC_DATE = '2026-08-10'

export type ReliableQuestionType = 'multiple_choice' | 'true_false' | 'numeric'

export const RELIABLE_QUESTION_TYPES: ReliableQuestionType[] = [
  'multiple_choice',
  'true_false',
  'numeric',
]

/**
 * Probabilidad de acertar sin saber nada. El múltiple choice del 10/08 fue
 * siempre de 4 opciones (verificado: las 862 filas tienen 4 elementos en
 * `options`), así que 0,25 no es un supuesto sino el dato.
 */
export const CHANCE_FLOOR: Record<ReliableQuestionType, number> = {
  multiple_choice: 0.25,
  true_false: 0.5,
  numeric: 0,
}

export const QUESTION_TYPE_LABEL: Record<ReliableQuestionType, string> = {
  multiple_choice: 'Múltiple choice',
  true_false: 'Verdadero / Falso',
  numeric: 'Numérica',
}

/**
 * Cómo se relaciona cada unidad del diagnóstico con el programa de la materia.
 *
 * Las claves son los `eje` de `curriculum` para Secundario 4to Matemática, que
 * es lo que efectivamente se sirvió. Sólo dos de las cuatro tienen algo que ver
 * con la carrera; decirlo explícitamente es la mitad del valor del reporte.
 */
export interface ProgramLink {
  /** Unidad del programa de la carrera, o null si el tema no se dicta. */
  programUnit: string | null
  /** Por qué. Se muestra tal cual al alumno y al docente. */
  rationale: string
}

export const DIAGNOSTIC_UNIT_PROGRAM_MAP: Record<string, ProgramLink> = {
  'Números y Operaciones': {
    programUnit: 'Unidad 3 — Álgebra y Ecuaciones para Sistemas de Información',
    rationale:
      'Números reales y sus propiedades son la base sobre la que se apoya el álgebra de la Unidad 3.',
  },
  'Álgebra y Funciones': {
    programUnit: 'Unidad 5 — Funciones y Modelización Matemática',
    rationale: 'Función, dominio, imagen y tipos de función se retoman y extienden en la Unidad 5.',
  },
  'Geometría y Medida': {
    programUnit: null,
    rationale:
      'Cónicas y geometría analítica no forman parte del programa de la carrera. No se va a dictar.',
  },
  'Probabilidad y Estadística': {
    programUnit: null,
    rationale:
      'Combinatoria y probabilidad no forman parte del programa de la carrera. No se va a dictar.',
  },
}

export function programLinkFor(unit: string): ProgramLink {
  return (
    DIAGNOSTIC_UNIT_PROGRAM_MAP[unit] ?? {
      programUnit: null,
      rationale: 'Esta unidad no está mapeada contra el programa de la carrera.',
    }
  )
}

export interface TypeTally {
  total: number
  correct: number
}

export function accuracy(tally: TypeTally): number | null {
  return tally.total > 0 ? tally.correct / tally.total : null
}

/**
 * Veredicto de una tanda contra su piso de azar.
 *
 * `sin_datos`      — no hay respuestas de ese tipo.
 * `sin_piso`       — numérica: no hay nada que descontar, el porcentaje se lee tal cual.
 * `azar`           — no se distingue de adivinar (z < 2 sobre el piso).
 * `sobre_azar`     — supera el piso con margen.
 * `bajo_azar`      — está por DEBAJO del piso, que es información: sugiere
 *                    distractores que atraen activamente, no desconocimiento neutro.
 */
export type ChanceVerdict = 'sin_datos' | 'sin_piso' | 'azar' | 'sobre_azar' | 'bajo_azar'

/**
 * Se usa z ≥ 2 (≈95%) y no una diferencia fija de porcentaje porque el n varía
 * muchísimo entre unidades: 257 respuestas de múltiple choice en Geometría
 * contra 72 en Probabilidad. Un umbral fijo declararía "sobre el azar" un ruido
 * de muestra chica y callaría una señal real de muestra grande.
 */
export const Z_THRESHOLD = 2

export function chanceVerdict(type: ReliableQuestionType, tally: TypeTally): ChanceVerdict {
  if (tally.total === 0) return 'sin_datos'

  const floor = CHANCE_FLOOR[type]
  if (floor <= 0) return 'sin_piso'

  const observed = tally.correct / tally.total
  // Error estándar de la proporción BAJO LA HIPÓTESIS NULA (p = piso), que es
  // contra lo que se compara. Usar la proporción observada acá inflaría el z
  // justo cuando el resultado es extremo.
  const standardError = Math.sqrt((floor * (1 - floor)) / tally.total)
  const z = (observed - floor) / standardError

  if (z >= Z_THRESHOLD) return 'sobre_azar'
  if (z <= -Z_THRESHOLD) return 'bajo_azar'
  return 'azar'
}

export const CHANCE_VERDICT_LABEL: Record<ChanceVerdict, string> = {
  sin_datos: 'Sin datos',
  sin_piso: 'Sin piso de azar',
  azar: 'Indistinguible del azar',
  sobre_azar: 'Por encima del azar',
  bajo_azar: 'Por debajo del azar',
}

export interface UnitBreakdown {
  unit: string
  byType: Record<ReliableQuestionType, TypeTally>
  /** Respuestas `short_answer` que se dejaron fuera. Se informa, no se esconde. */
  excludedShortAnswers: number
}

/**
 * Reparto del curso en una unidad. Sirve para decidir estrategia: un tema donde
 * la mitad anda pide trabajo entre pares; uno donde no hay nadie arriba pide
 * re-enseñanza frontal, porque no hay de quién copiar bien.
 */
export interface Dispersion {
  students: number
  mean: number
  stdDev: number
  min: number
  median: number
  max: number
  /** Alumnos que podrían oficiar de referencia para sus compañeros. */
  atOrAbove60: number
  below35: number
}

export function summarizeDispersion(scores: number[]): Dispersion | null {
  if (scores.length === 0) return null

  const sorted = [...scores].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n

  // Desvío muestral (n-1). Con un solo alumno no hay dispersión que medir, y
  // dividir por cero daría NaN en el JSON.
  const stdDev =
    n > 1
      ? Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1))
      : 0

  const middle = Math.floor(n / 2)
  const median = n % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]

  return {
    students: n,
    mean,
    stdDev,
    min: sorted[0],
    median,
    max: sorted[n - 1],
    atOrAbove60: sorted.filter((value) => value >= 0.6).length,
    below35: sorted.filter((value) => value < 0.35).length,
  }
}

/**
 * Estrategia sugerida a partir del reparto. Deliberadamente conservadora: sin
 * pares que sepan, el trabajo en grupos no tiene de dónde agarrarse.
 */
export type TeachingStrategy = 'pares' | 'frontal' | 'repaso_puntual' | 'sin_datos'

export function suggestStrategy(dispersion: Dispersion | null): TeachingStrategy {
  if (!dispersion || dispersion.students < 5) return 'sin_datos'
  if (dispersion.below35 === 0 && dispersion.mean >= 0.6) return 'repaso_puntual'
  if (dispersion.atOrAbove60 >= 3) return 'pares'
  return 'frontal'
}

export const STRATEGY_LABEL: Record<TeachingStrategy, string> = {
  pares: 'Trabajo entre pares — hay alumnos que pueden explicar',
  frontal: 'Re-enseñanza frontal — casi nadie llega al 60%',
  repaso_puntual: 'Repaso puntual — el curso lo tiene',
  sin_datos: 'Sin datos suficientes',
}
