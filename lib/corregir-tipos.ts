import { z } from 'zod'
import { corregirTipoDePregunta, problemaDeTipo, type ProblemaDeTipo } from '@/lib/validar-tipo-de-pregunta'
import type { MultipleChoiceQuestion, Question, TrueFalseQuestion } from '@/lib/types'

/**
 * N2 · Corregir en lote las preguntas cuyo tipo no encaja con la consigna.
 *
 * Puro: qué preguntas están marcadas (`problemaDeTipo`, M2), qué se le pide al
 * modelo para cada una, y si lo que devuelve sirve. La llamada al modelo y el
 * guardado viven en lib/corregir-tipos-server.ts.
 *
 * Primero va la regla determinista (`corregirTipoDePregunta`): lo que ésa
 * reescribe no gasta IA. Lo que devuelve `regenerar` se reescribe con el modelo,
 * pero SIN aceptar a ciegas: la salida tiene que pasar `problemaDeTipo` sin
 * marcas, conservar el tema, y un verdadero o falso tiene que conservar su
 * valor de verdad (el modelo lo declara y el servidor lo compara). Si no pasa,
 * la pregunta queda como estaba y se informa por qué.
 */

/** Una pregunta marcada: su posición y qué tiene. */
export interface PreguntaMarcada {
  indice: number
  problema: ProblemaDeTipo
}

/** Las preguntas cuyo tipo no encaja (lo mismo que cuenta el aviso de *Revisar y editar*). */
export function preguntasMarcadas(preguntas: readonly unknown[] | null | undefined): PreguntaMarcada[] {
  if (!Array.isArray(preguntas)) return []
  const marcadas: PreguntaMarcada[] = []
  preguntas.forEach((p, indice) => {
    const problema = p && typeof p === 'object' ? problemaDeTipo(p as Record<string, unknown>) : null
    if (problema) marcadas.push({ indice, problema })
  })
  return marcadas
}

export const contarMarcadas = (preguntas: readonly unknown[] | null | undefined) => preguntasMarcadas(preguntas).length

/** A qué se convierte cada problema cuando hace falta el modelo. */
export type Objetivo = 'afirmacion' | 'opcion_multiple'

export function objetivoDe(problema: ProblemaDeTipo): Objetivo | null {
  if (problema === 'vf-pregunta-si-no') return 'afirmacion'
  if (problema === 'vf-pregunta-abierta' || problema === 'numerica-conceptual') return 'opcion_multiple'
  // 'inecuacion-como-valor' lo arregla la regla sin IA; 'inecuacion-formas' no es un problema.
  return null
}

/** Lo que el modelo tiene que devolver para convertir un sí/no en afirmación. */
export const afirmacionSchema = z.object({
  afirmacion: z.string().describe('La afirmación, en una oración que se pueda juzgar verdadera o falsa. Sin signos de pregunta.'),
  valorDeVerdad: z.boolean().describe('true si la afirmación es verdadera, false si es falsa.'),
  topic: z.string().describe('El identificador de tema, exactamente el que se te pasó.'),
})

/** Lo que el modelo tiene que devolver para pasar a opción múltiple. */
export const opcionMultipleSchema = z.object({
  question: z.string().describe('La consigna, como pregunta de opción múltiple.'),
  options: z.array(z.string()).describe('Exactamente 4 opciones, distintas entre sí.'),
  correctAnswer: z.number().int().describe('El índice (0 a 3) de la opción correcta.'),
  explanation: z.string().describe('Por qué la correcta es la correcta.'),
  topic: z.string().describe('El identificador de tema, exactamente el que se te pasó.'),
})

export type SalidaAfirmacion = z.infer<typeof afirmacionSchema>
export type SalidaOpcionMultiple = z.infer<typeof opcionMultipleSchema>

/** El pedido al modelo para UNA pregunta. Es la misma consigna, no otra pregunta. */
export function promptDeReescritura(pregunta: Question, objetivo: Objetivo): string {
  const comun = [
    'Sos un docente que corrige una pregunta de un cuestionario ya armado. No inventes otra pregunta: arreglá ESTA.',
    `Consigna original: «${pregunta.question}»`,
    pregunta.explanation ? `Explicación que ya tiene: «${pregunta.explanation}»` : '',
    `Identificador de tema (devolvelo igual, sin cambiarlo): ${pregunta.topic}`,
    'Escribí en castellano rioplatense, con voseo, sin signos de exclamación de apertura. Conservá el LaTeX entre $…$ si lo hay.',
  ]
  if (objetivo === 'afirmacion') {
    const valor = pregunta.type === 'true_false' ? (pregunta.correctAnswer ? 'VERDADERA' : 'FALSA') : 'la que corresponda'
    return [
      ...comun,
      'Es una pregunta de Verdadero o Falso escrita como pregunta de sí o no. Reescribila como UNA afirmación que se pueda juzgar verdadera o falsa, con el mismo contenido y los mismos números.',
      `La afirmación tiene que ser ${valor}, igual que la respuesta de la pregunta original. Declaralo en valorDeVerdad.`,
      'No le agregues la justificación ("porque…"): eso va en la explicación, que ya existe.',
      'Ejemplo: «¿Es el número 1.242 divisible por 9?» (respuesta: Verdadero) → «El número 1.242 es divisible por 9.» (valorDeVerdad: true).',
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    ...comun,
    pregunta.type === 'true_false'
      ? 'Es una pregunta de Verdadero o Falso, pero pregunta algo que no se contesta con Verdadero o Falso. Pasala a opción múltiple.'
      : 'Es una pregunta numérica, pero la respuesta es un concepto o un nombre, no un número. Pasala a opción múltiple.',
    'Mismo enunciado (ajustá sólo la redacción si hace falta), 4 opciones distintas y una sola correcta, coherente con la explicación que ya tiene.',
  ]
    .filter(Boolean)
    .join('\n')
}

export type Verificacion = { ok: true; pregunta: Question } | { ok: false; motivo: string }

const mismoTema = (antes: Question, topic: string) => topic.trim() === String(antes.topic ?? '').trim()

/** Arma la pregunta corregida a partir de la salida del modelo, y la verifica. */
export function verificarReescritura(antes: Question, objetivo: Objetivo, salida: unknown): Verificacion {
  if (objetivo === 'afirmacion') {
    const leida = afirmacionSchema.safeParse(salida)
    if (!leida.success) return { ok: false, motivo: 'La IA devolvió algo que no se pudo leer.' }
    const { afirmacion, valorDeVerdad, topic } = leida.data
    if (antes.type !== 'true_false') return { ok: false, motivo: 'La pregunta original no es de verdadero o falso.' }
    if (!mismoTema(antes, topic)) return { ok: false, motivo: 'La IA cambió el tema de la pregunta.' }
    if (valorDeVerdad !== antes.correctAnswer) {
      return { ok: false, motivo: 'La IA cambió el valor de verdad: la respuesta correcta ya no sería la misma.' }
    }
    const pregunta: TrueFalseQuestion = { ...antes, question: afirmacion.trim(), origin: 'ai_regenerada' }
    if (!pregunta.question || problemaDeTipo(pregunta)) {
      return { ok: false, motivo: 'La reescritura sigue sin encajar con verdadero o falso.' }
    }
    return { ok: true, pregunta }
  }

  const leida = opcionMultipleSchema.safeParse(salida)
  if (!leida.success) return { ok: false, motivo: 'La IA devolvió algo que no se pudo leer.' }
  const { question, options, correctAnswer, explanation, topic } = leida.data
  if (!mismoTema(antes, topic)) return { ok: false, motivo: 'La IA cambió el tema de la pregunta.' }
  const limpias = options.map((o) => o.trim())
  if (limpias.length !== 4 || limpias.some((o) => !o) || new Set(limpias.map((o) => o.toLowerCase())).size !== 4) {
    return { ok: false, motivo: 'La IA no devolvió 4 opciones distintas.' }
  }
  if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) {
    return { ok: false, motivo: 'La IA no marcó una opción correcta válida.' }
  }
  const pregunta: MultipleChoiceQuestion = {
    id: antes.id,
    type: 'multiple_choice',
    topic: antes.topic,
    topicName: antes.topicName,
    question: question.trim(),
    options: limpias,
    correctAnswer,
    explanation: explanation.trim() || antes.explanation,
    origin: 'ai_regenerada',
  }
  if (!pregunta.question || problemaDeTipo(pregunta)) return { ok: false, motivo: 'La reescritura sigue sin encajar con su tipo.' }
  return { ok: true, pregunta }
}

/** Lo que la regla arregla sola, ya como pregunta. `null` si hace falta el modelo. */
export function correccionPorRegla(antes: Question): Question | null {
  const correccion = corregirTipoDePregunta(antes)
  if (correccion.accion !== 'reescrita') return null
  const { question, acceptedAnswers } = correccion.cambios
  if (antes.type === 'short_answer' && acceptedAnswers) {
    return { ...antes, question, acceptedAnswers, origin: 'editada' }
  }
  return { ...antes, question, origin: 'editada' } as Question
}

/** Una propuesta para el diálogo de antes → después. */
export interface PropuestaDeCorreccion {
  indice: number
  problema: ProblemaDeTipo
  antes: Question
  /** `null`: no se pudo corregir; la pregunta queda como está. */
  despues: Question | null
  via: 'regla' | 'ia' | null
  /** Por qué no se corrigió (cuando `despues` es null). */
  motivo?: string
}

/**
 * Aplica las propuestas ELEGIDAS a las preguntas. Las no elegidas y las que
 * no se pudieron corregir quedan como estaban. No muta la entrada.
 */
export function aplicarPropuestas(preguntas: readonly Question[], propuestas: readonly PropuestaDeCorreccion[], elegidas: ReadonlySet<number>): Question[] {
  const porIndice = new Map(propuestas.filter((p) => p.despues && elegidas.has(p.indice)).map((p) => [p.indice, p.despues!]))
  return preguntas.map((q, i) => porIndice.get(i) ?? q)
}

/** Las que se pueden aplicar (tienen un "después"). */
export const aplicables = (propuestas: readonly PropuestaDeCorreccion[]) => propuestas.filter((p) => p.despues !== null)
