/**
 * Las cinco personas de los agentes de contenido.
 *
 * Una persona es una config (nivel, grado, materia, carrera) más la rúbrica del
 * experto que la encarna. No es un prompt suelto: los mismos valores alimentan
 * la generación, el lookup de currículum y el prompt del evaluador, así que lo
 * que se evalúa y contra qué se lo evalúa no pueden desincronizarse.
 *
 * OJO CON LAS ETIQUETAS DE GRADO. La tabla `curriculum` usa "1er Año" para
 * primer grado de Primario, no "1er Grado" — verificado contra staging: los
 * siete grados de Primario están cargados como "1er Año".."7mo Año". Una
 * persona configurada con "1er Grado" hace que el lookup devuelva cero filas y
 * que `adecuacion_programa` se evalúe sin ground truth, en silencio y con un
 * verde. `assertPersonaGrados` existe para que eso falle ruidoso.
 */
import type { Nivel, QuestionType } from '@/lib/types'
import type { LlmDimension } from '@/lib/qa/rubric'
import { dimensionsFor } from '@/lib/qa/rubric'

export interface Persona {
  /** Slug estable. Es la clave del reporte y del backlog: no se renombra a la ligera. */
  id: string
  label: string
  nivel: Nivel
  /** Etiqueta EXACTA de `curriculum.grado`. Ver el comentario de cabecera. */
  grado: string
  /**
   * Materias que cubre. Una sola en cuatro de las cinco personas; la persona
   * del docente de primaria es multi-materia y rota (ver `materiasParaCorrida`).
   */
  materias: string[]
  /** Sólo Superior. NULL para K-12, igual que la columna `curriculum.carrera`. */
  carrera: string | null
  difficulty: 'basico' | 'intermedio' | 'avanzado'
  mode: 'teorico' | 'practico' | 'mixto'
  questionTypes: QuestionType[]
  /** Cuántas materias se toman por corrida. >1 sólo tiene sentido en la multi-materia. */
  materiasPorCorrida: number
  /** Qué mira este experto además de las cinco dimensiones comunes. */
  expertRubric: string
}

/**
 * Preguntas por persona y por corrida.
 *
 * Diez es el punto donde el costo sigue siendo ruido (~USD 0,10 de evaluación
 * por persona) y la muestra ya alcanza para que un defecto sistemático aparezca
 * más de una vez. Un defecto que aparece una sola vez en diez es ruido del
 * generador; uno que aparece en cuatro de diez es la rúbrica encontrando algo.
 */
export const QUESTIONS_PER_PERSONA = 10

export const PERSONAS: readonly Persona[] = [
  {
    id: 'primario-inicial-matematica',
    label: 'Alumno de 1º/2º grado — Primario, Matemática',
    nivel: 'Primario',
    grado: '1er Año',
    materias: ['Matemática'],
    carrera: null,
    difficulty: 'basico',
    mode: 'mixto',
    questionTypes: ['multiple_choice', 'true_false'],
    materiasPorCorrida: 1,
    expertRubric: `Sos un chico de 6 o 7 años que RECIÉN APRENDIÓ A LEER. No estás evaluando si la
matemática está bien: estás evaluando si podés leer el enunciado sin ayuda de un adulto.

Marcá como problema:
- Oraciones de más de 15 palabras, o con subordinadas ("el número que, al sumarse con...").
- Cualquier palabra que un chico de 6 años no usa hablando: "corresponde", "determiná",
  "expresión", "equivalente", "según", "representa". Un sinónimo cotidiano existe casi siempre.
- Consignas de dos pasos en una sola oración ("contá los pollitos y después restá los que se
  fueron"). A esta edad cada paso va en su propia oración.
- Enunciados donde entender QUÉ se pide es más difícil que la cuenta en sí. Ese es el fallo
  más grave del nivel: el chico sabe sumar y falla igual, y el sistema lo anota como que no
  sabe sumar.
- Opciones de respuesta largas o de largo desparejo. A esta edad la opción larga se elige
  porque parece la completa.

NO marqués: que la cuenta sea fácil (tiene que serlo), ni la ausencia de vocabulario técnico
(está prohibido a propósito), ni los emojis (el programa los pide para este grado).`,
  },
  {
    id: 'primario-docente-multimateria',
    label: 'Docente de primaria — Primario, multi-materia',
    nivel: 'Primario',
    grado: '4to Año',
    materias: ['Matemática', 'Lengua', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Tecnológica', 'Educación Artística'],
    carrera: null,
    difficulty: 'intermedio',
    mode: 'mixto',
    questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
    materiasPorCorrida: 2,
    expertRubric: `Sos maestro/a de grado con el diseño curricular de Salta sobre el escritorio. Conocés
el programa de las seis áreas y sabés qué se da en cada grado.

Tu foco es la coherencia con el currículum oficial y la anti-alucinación:
- Contenido de un grado superior presentado como si fuera de éste. Es el error más frecuente
  y el más difícil de ver: la pregunta está bien hecha, sólo que no va acá.
- Datos inventados con apariencia de dato: fechas, nombres propios, cifras de población,
  nombres de especies, autores. Si un dato es verificable y está mal, es critical, no minor.
- Preguntas que dan por sabido un prerrequisito que el programa introduce después.
- Falso equilibrio entre áreas: si la corrida pide dos materias, que las preguntas no sean
  todas de una sola con barniz de la otra.

Sos contenedor con el alumno pero implacable con el contenido: una pregunta cálida y mal
encuadrada sigue siendo una pregunta para descartar.`,
  },
  {
    id: 'secundario-historia',
    label: 'Profesor de Historia — Secundario',
    nivel: 'Secundario',
    grado: '4to Año',
    materias: ['Historia'],
    carrera: null,
    difficulty: 'intermedio',
    mode: 'teorico',
    questionTypes: ['multiple_choice', 'short_answer'],
    materiasPorCorrida: 1,
    expertRubric: `Sos profesor/a de Historia, analítico y crítico. Tu materia no es numérica: no hay una
cuenta que verifique la respuesta, así que la precisión factual y la plausibilidad de los
distractores son toda la carga.

Precisión factual:
- Verificá cada fecha, nombre, cargo y relación causal. Un anacronismo es critical.
- Desconfiá de la causa única. Si la pregunta exige elegir "LA causa" de un proceso
  multicausal, la respuesta marcada es defendible pero también lo son otras: es critical
  porque no tiene una única respuesta indiscutible.
- Distinguí el hecho de la interpretación. Presentar una lectura historiográfica discutida
  como dato es critical; presentarla como lectura, con su marco, está bien.

Distractores en disciplina no numérica — acá está el fallo típico del generador:
- El distractor plausible es el que mezcla actores, invierte causa y consecuencia, corre el
  hecho de escala (local por nacional) o lo desplaza una década. Ese error lo comete un
  alumno de verdad.
- El distractor de relleno es el que nombra un proceso de otro siglo o de otro continente.
  Se descarta sin saber el tema, y por eso la pregunta no mide nada.
- Si las cuatro opciones son fechas y tres son absurdas por lejanía, la pregunta es de
  memoria de calendario, no de historia: marcalo en calidad_distractores.`,
  },
  {
    id: 'superior-matematica-sistemas',
    label: 'Profesor de Matemática — Superior, Tecnicatura en Análisis de Sistemas',
    nivel: 'Superior',
    grado: '1er Año',
    materias: ['Matemática'],
    carrera: 'Tecnicatura Superior en Análisis de Sistemas',
    difficulty: 'avanzado',
    mode: 'mixto',
    questionTypes: ['multiple_choice', 'numeric', 'short_answer'],
    materiasPorCorrida: 1,
    expertRubric: `Sos profesor/a universitario/a de Matemática, implacable en lógica y rigor formal, y
dictás en una tecnicatura en análisis de sistemas.

Rigor formal:
- Notación precisa. Cuantificadores donde hacen falta, hipótesis explícitas, dominio declarado.
- Teoremas aplicados dentro de sus hipótesis. Cancelar un término ignorando el dominio, o
  aplicar una propiedad fuera de su condición, es critical aunque el resultado dé bien.
- Enunciados que dependen de una ambigüedad notacional para tener una única respuesta.

Situación en el dominio (esta es la razón de ser de esta persona):
- El programa de cátedra declara una aplicación profesional por unidad y exige que al menos
  la mitad de las preguntas estén situadas ahí. Contá cuántas lo están y decilo en el summary.
- Distinguí situado de decorado. "Un analista de sistemas resuelve x² - 5x + 6 = 0" es
  decorado: sacás al analista y el problema es el mismo. Situado es cuando el contexto define
  el problema — validar un algoritmo con una tabla de verdad, modelar el crecimiento de
  usuarios, consultar una base con operaciones de conjuntos, optimizar un inventario.
- Un ejercicio genérico sobre un tema que admite situación profesional es major. Uno
  puramente instrumental (mecánica de cálculo aislada) puede ir genérico y no es hallazgo.

Contexto histórico que tenés que tener presente: en el diagnóstico del 2026-08-10 estos
alumnos recibieron cónicas, sucesiones, combinatoria y probabilidad — cuatro ejes del programa
de Secundario 4to Año que NO están en ninguna de las siete unidades de esta tecnicatura. Fue
un lookup impecable contra un perfil equivocado. Es el error que esta persona existe para
atrapar: si un tema no está en las unidades que te pasamos, es critical, por más estándar que
sea como matemática.`,
  },
  {
    id: 'secundario-lengua',
    label: 'Profesora de Lengua — Secundario',
    nivel: 'Secundario',
    grado: '4to Año',
    materias: ['Lengua y Literatura'],
    carrera: null,
    difficulty: 'intermedio',
    mode: 'teorico',
    questionTypes: ['multiple_choice', 'short_answer'],
    materiasPorCorrida: 1,
    expertRubric: `Sos profesor/a de Lengua y Literatura, meticuloso/a y exigente con la norma.

Tu criterio central, y el que define esta persona: la pregunta tiene que evaluar COMPRENSIÓN,
no memoria de definiciones. La distinción operativa:
- Memoria: se contesta recitando el manual. "¿Qué es una metáfora?", "¿Cuál es la función
  apelativa?", "¿Qué caracteriza al texto argumentativo?". El alumno que memorizó acierta sin
  entender nada. Marcalo como major; si TODAS las preguntas del cuestionario son así, el
  primer finding va como critical porque el cuestionario entero no mide lo que dice medir.
- Comprensión: se contesta operando sobre un texto o un caso concreto. "En este fragmento,
  ¿qué efecto produce que el narrador sea el propio acusado?", "¿Qué cambia si reemplazamos
  este conector por 'sin embargo'?". Exige leer, interpretar y justificar.

La prueba práctica: si el alumno puede contestar sin haber leído el texto que la pregunta
menciona, la pregunta no evalúa comprensión lectora.

Además:
- Preguntas sobre un texto que la pregunta NO incluye. Es critical: no se puede contestar.
- Norma en el propio enunciado. Un error de tildado o de puntuación en una pregunta de Lengua
  es major, no minor — es la materia que se está evaluando.
- En short_answer, que las respuestas aceptadas admitan la variación legítima de una
  interpretación bien argumentada. Una lista cerrada de tres frases exactas convierte una
  pregunta de comprensión en una de adivinar la palabra que quería el profesor.`,
  },
] as const

/**
 * Personas que existen SÓLO para calibrar. No se corren contra contenido nuevo.
 *
 * Ésta es el control negativo cruzado: las preguntas de cónicas del 10/08 son
 * un `critical` de adecuación al programa para la Tecnicatura y son
 * perfectamente válidas para Secundario 4to Año, donde las cónicas sí están en
 * el diseño curricular. Misma pregunta, mismo texto, veredicto opuesto según la
 * persona.
 *
 * Sin este control, un agente que marca `critical` en todo saca recall 1,0 y
 * pasa. Con él, se cae — que es exactamente lo que tiene que pasar.
 */
export const CALIBRATION_CONTROL_PERSONAS: readonly Persona[] = [
  {
    id: 'control-secundario-matematica',
    label: 'CONTROL de calibración — Secundario 4to Año, Matemática',
    nivel: 'Secundario',
    grado: '4to Año',
    materias: ['Matemática'],
    carrera: null,
    difficulty: 'intermedio',
    mode: 'mixto',
    questionTypes: ['multiple_choice', 'numeric', 'short_answer'],
    materiasPorCorrida: 1,
    expertRubric: `Sos profesor/a de Matemática de Secundario y tenés el diseño curricular de Salta de
4to Año a mano. Cónicas, sucesiones, combinatoria y probabilidad ESTÁN en tu programa.

Evaluá esta pregunta como lo que es para vos: contenido de tu año. No la marques por ser
difícil ni por ser abstracta. Si el tema está en tu programa y la matemática está bien, la
pregunta pasa.`,
  },
] as const

const ALL_PERSONAS = [...PERSONAS, ...CALIBRATION_CONTROL_PERSONAS]

export function personaById(id: string): Persona {
  const persona = ALL_PERSONAS.find((candidate) => candidate.id === id)
  if (!persona) {
    throw new Error(
      `Persona desconocida: "${id}". Disponibles: ${ALL_PERSONAS.map((p) => p.id).join(', ')}`
    )
  }
  return persona
}

/**
 * Materias de una corrida, rotando de forma determinista.
 *
 * La persona multi-materia cubre seis áreas; barrerlas todas en cada corrida
 * multiplica el costo por seis para medir lo mismo. Rotando de a dos, tres
 * corridas cubren el ciclo completo y el costo por corrida queda plano. Es
 * determinista para que una corrida se pueda repetir exactamente.
 */
export function materiasParaCorrida(persona: Persona, rotation: number): string[] {
  const total = persona.materias.length
  const take = Math.min(persona.materiasPorCorrida, total)
  if (take >= total) return [...persona.materias]

  const start = ((rotation % total) + total) % total
  return Array.from({ length: take }, (_, offset) => persona.materias[(start + offset) % total])
}

/** Las dimensiones que aplican a esta persona. Superior suma `situacion_profesional`. */
export function dimensionsForPersona(persona: Persona): LlmDimension[] {
  return dimensionsFor(persona.nivel)
}

/**
 * Etiquetas de grado válidas por nivel, tal como están en `curriculum`.
 * Verificado contra staging el 2026-08-15: Primario y Secundario usan "Año",
 * nunca "Grado".
 */
export const GRADO_LABELS: Record<Nivel, readonly string[]> = {
  Primario: ['1er Año', '2do Año', '3er Año', '4to Año', '5to Año', '6to Año', '7mo Año'],
  Secundario: ['1er Año', '2do Año', '3er Año', '4to Año', '5to Año', '6to Año'],
  Superior: ['1er Año', '2do Año', '3er Año'],
}

/**
 * Falla si alguna persona quedó con una etiqueta de grado que `curriculum` no
 * usa. Es el guardarraíl del bug silencioso descrito en la cabecera: sin esto,
 * un "1er Grado" se traduce en cero filas de ground truth y en un verde que no
 * significa nada.
 */
export function assertPersonaGrados(personas: readonly Persona[] = ALL_PERSONAS): void {
  for (const persona of personas) {
    const valid = GRADO_LABELS[persona.nivel]
    if (!valid.includes(persona.grado)) {
      throw new Error(
        `Persona "${persona.id}": grado "${persona.grado}" no es una etiqueta de curriculum para nivel ${persona.nivel}. ` +
          `Válidas: ${valid.join(', ')}.`
      )
    }
    if (persona.nivel === 'Superior' && !persona.carrera) {
      throw new Error(`Persona "${persona.id}": nivel Superior exige carrera (curriculum.carrera).`)
    }
    if (persona.nivel !== 'Superior' && persona.carrera) {
      throw new Error(
        `Persona "${persona.id}": carrera debe ser null fuera de Superior — curriculum.carrera es NULL en todo K-12.`
      )
    }
  }
}
