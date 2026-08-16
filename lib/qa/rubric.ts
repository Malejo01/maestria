/**
 * Rúbrica de los agentes de contenido (FASE 0.5).
 *
 * Este módulo es la definición del criterio: las dimensiones, qué significa
 * cada severidad, y el texto que se le inyecta al evaluador. Es puro y sin I/O
 * a propósito — la rúbrica se itera muchas veces y tiene que poder cambiarse y
 * testearse sin gastar un token.
 *
 * El evaluador es un modelo DISTINTO del generador (Gemini genera, Claude
 * evalúa). Ese es el punto de todo el módulo: un modelo juzgando su propio
 * trabajo comparte sus puntos ciegos. Ver docs/qa-agents.md.
 */
// `zod/v4`, no `zod` a secas: el helper de salida estructurada del SDK de
// Anthropic (0.117) tipa contra la API v4, que zod 3.25 ya expone en ese
// subpath. Es el mismo paquete que usa el resto del repo, no una dependencia
// nueva — y acá abajo sólo se usa para el contrato de salida del evaluador.
import { z } from 'zod/v4'

/**
 * Las cinco dimensiones que juzga el modelo, más una sexta que NO juzga.
 *
 * `higiene_formato` existe pero se resuelve en lib/qa/lint-questions.ts, con
 * chequeos deterministas. Un LLM no tiene renderer: lee `$\frac{7}{4}$` y dice
 * "renderiza bien" porque no puede hacer otra cosa. Los fallos reales de este
 * repo en esa dimensión fueron mecánicos (`\neg` corrompido a `eg`, `$` usado
 * como símbolo de moneda, `acceptedAnswers` en LaTeX crudo, `tolerance` nula) y
 * todos se detectan con una regex. Pedirle eso al modelo cuesta tokens y
 * devuelve una opinión que no es evidencia.
 */
export const DIMENSIONS = [
  'adecuacion_nivel',
  'correccion_disciplinar',
  'calidad_distractores',
  'adecuacion_programa',
  'situacion_profesional',
  'higiene_formato',
] as const

export type Dimension = (typeof DIMENSIONS)[number]

/** Las que evalúa el modelo. `higiene_formato` queda fuera: la resuelve el lint. */
export const LLM_DIMENSIONS = [
  'adecuacion_nivel',
  'correccion_disciplinar',
  'calidad_distractores',
  'adecuacion_programa',
  'situacion_profesional',
] as const

export type LlmDimension = (typeof LLM_DIMENSIONS)[number]

/** Dimensión que sólo aplica a nivel Superior. Ver `dimensionsFor`. */
export const SUPERIOR_ONLY_DIMENSION: Dimension = 'situacion_profesional'

export type Severity = 'critical' | 'major' | 'minor'

export const SEVERITIES: readonly Severity[] = ['critical', 'major', 'minor'] as const

/** Orden de gravedad, para ordenar findings y para comparar umbrales. */
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, major: 1, minor: 2 }

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b]
}

/**
 * Quién produjo el hallazgo.
 *
 * `lint` es un hecho reproducible: lo encontró una regex cubierta por tests y
 * vuelve a encontrarlo igual mañana. `model` es una opinión calibrada: vale lo
 * que valga la calibración de esa persona. Mezclarlos en el agregado del
 * backlog sin poder distinguirlos convierte evidencia dura en promedio.
 */
export type FindingSource = 'lint' | 'model'

export interface Finding {
  dimension: Dimension
  severity: Severity
  /** Índice 0-based dentro del array de preguntas evaluado. */
  questionIndex: number
  /** Una línea. El evaluador tiene prohibido justificar en párrafos. */
  justification: string
  source: FindingSource
}

/**
 * De dónde salieron las preguntas que se evaluaron.
 *
 * No es decorativo: un verde sobre evidencia fabricada no es la misma cosa que
 * un verde sobre un caso real del examen del 10/08, y a los dos meses nadie se
 * acuerda de cuál era cuál. Viaja hasta el `summary` del reporte, no sólo en
 * los metadatos, justamente para que no se pueda leer un resultado sin ver su
 * procedencia.
 */
export type EvidenceBasis = 'generated' | 'real' | 'synthetic' | 'mixed'

export function evidenceBasisFor(counts: { real: number; synthetic: number }): EvidenceBasis {
  if (counts.synthetic > 0 && counts.real > 0) return 'mixed'
  if (counts.synthetic > 0) return 'synthetic'
  return 'real'
}

/** Lo que devuelve el modelo. No incluye persona, costo ni timestamp: eso lo pone el runner. */
export const evaluationSchema = z.object({
  findings: z.array(
    z.object({
      dimension: z.enum(LLM_DIMENSIONS),
      severity: z.enum(['critical', 'major', 'minor']),
      questionIndex: z.number().int(),
      justification: z.string(),
    })
  ),
  summary: z.string(),
})

export type Evaluation = z.infer<typeof evaluationSchema>

/**
 * Descarta findings que apuntan a preguntas que no existen.
 *
 * Un índice fuera de rango es una alucinación del evaluador, y si se cuela
 * envenena el agregado del orquestador de backlog: un finding `critical` sobre
 * la pregunta 12 de un cuestionario de 10 no se puede ni leer ni arreglar.
 * Se descartan y se cuentan — el conteo es señal de que el evaluador se está
 * desalineando y va al reporte.
 */
export function validateFindings(
  findings: Finding[],
  questionCount: number
): { valid: Finding[]; dropped: Finding[] } {
  const valid: Finding[] = []
  const dropped: Finding[] = []

  for (const finding of findings) {
    if (
      Number.isInteger(finding.questionIndex) &&
      finding.questionIndex >= 0 &&
      finding.questionIndex < questionCount
    ) {
      valid.push(finding)
    } else {
      dropped.push(finding)
    }
  }

  return { valid, dropped }
}

/** Las dimensiones aplicables a un nivel. Superior suma la situación profesional. */
export function dimensionsFor(nivel: string): LlmDimension[] {
  return LLM_DIMENSIONS.filter(
    (dimension) => dimension !== SUPERIOR_ONLY_DIMENSION || nivel === 'Superior'
  )
}

/**
 * Anclas de severidad, compartidas por todas las dimensiones.
 *
 * Están cuantificadas a propósito. "Grave / moderado / leve" deja que el modelo
 * elija su propia escala y esa escala se corre entre corridas, con lo cual dos
 * reportes de la misma rúbrica dejan de ser comparables. El criterio operativo
 * acá es qué haría el docente con la pregunta, que sí es estable.
 */
export const SEVERITY_ANCHORS = `ESCALA DE SEVERIDAD (usá el criterio del docente que recibe la pregunta):
- critical: la pregunta NO se puede usar. El docente la borra. Incluye respuesta marcada
  incorrecta, tema fuera del programa del nivel/grado, enunciado ilegible para la edad, o
  más de una opción defendible como correcta.
- major: la pregunta se puede usar pero enseña mal. El docente la reescribe antes de darla.
  Incluye distractores de relleno, registro por encima del nivel pero decodificable, o
  contextualización ausente donde el programa la exige.
- minor: la pregunta sirve como está. El docente la daría igual. Detalles de redacción,
  puntuación o estilo que no cambian lo que el alumno aprende.`

/**
 * El texto de cada dimensión. Es el corazón de la rúbrica y lo que se itera.
 *
 * Regla que aplican todas: el finding tiene que poder señalar QUÉ está mal en
 * ESTA pregunta. "Podría ser mejor" no es un finding; si el evaluador no puede
 * nombrar el defecto en una línea, no hay defecto.
 */
export const DIMENSION_RUBRICS: Record<LlmDimension, string> = {
  adecuacion_nivel: `adecuacion_nivel — ¿un estudiante de este nivel y grado puede LEER y ENTENDER el enunciado?
Mirá el registro lingüístico, no la dificultad conceptual: una pregunta difícil bien escrita
no es un hallazgo acá. Revisá longitud de oración, vocabulario fuera del uso cotidiano de la
edad, subordinadas encadenadas, y si entender la consigna exige un término que el programa
todavía no introdujo. Si el enunciado se apoya en leer una sola palabra difícil, es critical:
el alumno falla por vocabulario y el sistema lo registra como error de la materia.`,

  correccion_disciplinar: `correccion_disciplinar — ¿la respuesta marcada como correcta es REALMENTE la correcta?
Resolvé el ejercicio vos mismo antes de opinar. Verificá el cálculo, la definición y el hecho.
Marcá critical si la respuesta marcada está mal, si hay más de una opción defendible, o si
ninguna opción es correcta. Esta es la única dimensión donde tu conocimiento disciplinar es
la fuente: no hay ground truth externo que te podamos dar.`,

  calidad_distractores: `calidad_distractores — ¿las opciones incorrectas son diagnósticas o son relleno?
Un distractor diagnóstico es el resultado de un error REAL y típico: invertir la operación,
confundir dos conceptos parecidos, aplicar una fórmula fuera de su hipótesis, leer mal el
enunciado. Un distractor de relleno es absurdo, obviamente descartable, o de una categoría
distinta a la respuesta correcta (largo desparejo, único con unidades, único negativo).
Para cada distractor que marques, nombrá el error que representa — o el que NO representa.
Sólo aplica a multiple_choice; en los otros tipos no hay opciones que juzgar.`,

  adecuacion_programa: `adecuacion_programa — ¿el tema está en el programa de ESTE nivel y grado?
Te damos abajo los temas textuales del currículum. Esa es la fuente, no tu conocimiento
general de qué se enseña habitualmente. Un tema que es matemática perfectamente estándar
puede estar completamente fuera del programa de esta cursada, y ese es exactamente el error
que esta dimensión existe para atrapar. Si el tema no aparece ni como caso particular de
ninguna unidad listada, es critical. Si aparece pero la pregunta exige un prerrequisito que
no está en ninguna unidad, es major.`,

  situacion_profesional: `situacion_profesional — SÓLO nivel Superior. ¿el ejercicio está situado en el dominio de la carrera o es genérico?
Te damos la aplicación profesional que el programa de cátedra declara para cada unidad. El
programa la exige de forma cuantificada: al menos la mitad de las preguntas tienen que estar
situadas en un problema real del dominio. Un ejercicio genérico ("resolvé la ecuación",
"hallá el dominio de f(x)") sobre un tema que admite situación es major. Vocabulario del
dominio pegado encima de un ejercicio genérico ("un programador resuelve la ecuación") también
es major: la situación tiene que cambiar el problema, no decorarlo. El rigor formal NO se
relaja al contextualizar; si se relajó, marcalo en correccion_disciplinar.`,
}

/** Guardia de consistencia: toda dimensión evaluable tiene su texto. */
export function assertRubricComplete(): void {
  for (const dimension of LLM_DIMENSIONS) {
    const text = DIMENSION_RUBRICS[dimension]
    if (!text || text.trim().length === 0) {
      throw new Error(`La dimensión "${dimension}" no tiene rúbrica definida en DIMENSION_RUBRICS.`)
    }
  }
}
