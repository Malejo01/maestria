import type { MarcaDePregunta } from '@/lib/diagnostico-resultados'
import { comaDecimal, respuestaCorrectaNumerica } from '@/lib/numeros'
import { fraccionValida } from '@/lib/fraccion'

/**
 * J7: la versión para imprimir y la carga a mano. Parte pura.
 *
 * Lo cargado a mano NO entra a `topic_mastery` ni a los errores: no hay una
 * respuesta real para diagnosticar el error, sólo bien o mal. Queda sólo en el
 * resultado del diagnóstico (J6).
 */

export interface PreguntaImpresa {
  indice: number
  enunciado: string
  tipo: 'multiple_choice' | 'true_false' | 'numeric' | 'short_answer'
  opciones: string[]
  /** La respuesta correcta, escrita: va SÓLO en la hoja del docente. */
  correcta: string
  explicacion: string
}

const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']
export const letra = (i: number) => LETRAS[i] ?? String(i + 1)

/** Una pregunta de `teacher_quizzes.questions` lista para el papel. */
export function preguntaImpresa(cruda: unknown, indice: number): PreguntaImpresa {
  const q = (cruda ?? {}) as Record<string, unknown>
  const tipo = (['multiple_choice', 'true_false', 'numeric', 'short_answer'].includes(String(q.type)) ? q.type : 'multiple_choice') as PreguntaImpresa['tipo']
  const opciones = Array.isArray(q.options) ? q.options.map(String) : []
  let correcta = ''
  if (tipo === 'multiple_choice') {
    const i = Number(q.correctAnswer)
    correcta = Number.isInteger(i) && opciones[i] !== undefined ? `${letra(i)}. ${opciones[i]}` : ''
  } else if (tipo === 'true_false') {
    correcta = q.correctAnswer === true ? 'Verdadero' : 'Falso'
  } else if (tipo === 'numeric') {
    // K2: si la respuesta es una fracción, va como fracción.
    // L3: una factorización, como producto de potencias.
    correcta = respuestaCorrectaNumerica({
      correctAnswer: Number(q.correctAnswer),
      tolerance: Number(q.tolerance),
      fraccion: fraccionValida(q.fraccion) ? q.fraccion : null,
      forma: q.forma,
      question: q.question,
    })
    if (fraccionValida(q.fraccion) && q.exigeIrreducible === true) correcta += ' (irreducible)'
  } else {
    correcta = Array.isArray(q.acceptedAnswers) ? comaDecimal(q.acceptedAnswers.map(String).join(' / ')) : ''
  }
  return {
    indice,
    enunciado: String(q.question ?? ''),
    tipo,
    opciones: tipo === 'multiple_choice' ? opciones : [],
    correcta,
    explicacion: String(q.explanation ?? ''),
  }
}

const MARCAS: MarcaDePregunta[] = ['bien', 'mal', 'sin_responder']

/**
 * Valida lo que carga el docente: una marca por pregunta, con índices que
 * existen. Devuelve el objeto que se guarda (`{ "0": "bien", … }`) o null.
 * Lo que no se marcó queda `sin_responder`: el docente no tiene que tocar las
 * que el alumno dejó en blanco.
 */
export function validarCarga(respuestas: unknown, cantidadDePreguntas: number): Record<string, MarcaDePregunta> | null {
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) return null
  const entrada = respuestas as Record<string, unknown>
  for (const clave of Object.keys(entrada)) {
    const i = Number(clave)
    if (!Number.isInteger(i) || i < 0 || i >= cantidadDePreguntas) return null
    if (!MARCAS.includes(entrada[clave] as MarcaDePregunta)) return null
  }
  const salida: Record<string, MarcaDePregunta> = {}
  for (let i = 0; i < cantidadDePreguntas; i++) {
    salida[String(i)] = (entrada[String(i)] as MarcaDePregunta | undefined) ?? 'sin_responder'
  }
  return salida
}
