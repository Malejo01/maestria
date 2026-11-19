import { normalizarNombre } from '@/lib/alumnos-docente'
import type { ProgramUnit } from '@/lib/types'

/**
 * El resultado del diagnóstico (J6), parte pura.
 *
 * NO usa los umbrales de dominio de la planilla (5 respuestas para "flojo", 8
 * para "dominado"): un diagnóstico pregunta 1 o 2 por tema y con esos
 * umbrales todo saldría "sin datos". Es una foto del punto de partida, tema
 * por tema: acertó, falló o no respondió.
 */

export type MarcaDePregunta = 'bien' | 'mal' | 'sin_responder'
export type EstadoDeTema = 'acerto' | 'fallo' | 'no_respondio'

export interface PreguntaDelCuestionario {
  /** Posición en `teacher_quizzes.questions` (0, 1, 2…): la clave de los impresos. */
  indice: number
  /** El id de la pregunta (`q1`…): la clave de `quiz_answers.question_id`. */
  id: string
  temaId: string
  temaNombre: string
}

/**
 * A qué tema del programa corresponde una pregunta generada. La IA escribe en
 * `topic` el nombre del tema (o, a veces, su id); se busca entre los temas del
 * cuestionario por id y por nombre normalizado. Si no aparece, el tema es el
 * nombre que escribió la IA.
 */
export function temaDePregunta(
  pregunta: { topic?: unknown; topicName?: unknown },
  temas: { id: string; name: string }[],
): { id: string; nombre: string } {
  const candidatos = [pregunta.topic, pregunta.topicName].filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  for (const candidato of candidatos) {
    const porId = temas.find((t) => t.id === candidato)
    if (porId) return { id: porId.id, nombre: porId.name }
    const porNombre = temas.find((t) => normalizarNombre(t.name) === normalizarNombre(candidato))
    if (porNombre) return { id: porNombre.id, nombre: porNombre.name }
  }
  const nombre = candidatos[0] ?? 'Sin tema'
  return { id: `sin-tema:${nombre}`, nombre }
}

export function preguntasDelCuestionario(
  preguntas: unknown[],
  temas: { id: string; name: string }[],
): PreguntaDelCuestionario[] {
  return preguntas.map((cruda, indice) => {
    const pregunta = (cruda ?? {}) as { id?: unknown; topic?: unknown; topicName?: unknown }
    const tema = temaDePregunta(pregunta, temas)
    return { indice, id: String(pregunta.id ?? `q-${indice}`), temaId: tema.id, temaNombre: tema.nombre }
  })
}

/** Las marcas por índice a partir de las respuestas de la app (`quiz_answers`). */
export function marcasDeLaApp(
  preguntas: PreguntaDelCuestionario[],
  respuestas: { questionId: string; questionIndex: number; isCorrect: boolean | null }[],
): MarcaDePregunta[] {
  return preguntas.map((p) => {
    const suya =
      respuestas.find((r) => r.questionId === p.id) ?? respuestas.find((r) => r.questionIndex === p.indice && !r.questionId)
    if (!suya || suya.isCorrect === null) return 'sin_responder'
    return suya.isCorrect ? 'bien' : 'mal'
  })
}

/** Las marcas por índice a partir de una carga del impreso (`{ "0": "bien", … }`). */
export function marcasDelImpreso(preguntas: PreguntaDelCuestionario[], respuestas: unknown): MarcaDePregunta[] {
  const mapa = (respuestas && typeof respuestas === 'object' ? respuestas : {}) as Record<string, unknown>
  return preguntas.map((p) => {
    const marca = mapa[String(p.indice)]
    return marca === 'bien' || marca === 'mal' ? marca : 'sin_responder'
  })
}

export interface ResultadoDeTema {
  temaId: string
  nombre: string
  unidadId: string | null
  bien: number
  total: number
  estado: EstadoDeTema
}

/**
 * Tema por tema. Con dos preguntas de un tema: acertó si respondió bien las
 * dos, falló si erró alguna, no respondió si no contestó ninguna. Una bien y
 * otra sin responder cuenta como acertó en lo que respondió: no hay error que
 * marcar.
 */
export function resultadoPorTema(
  preguntas: PreguntaDelCuestionario[],
  marcas: MarcaDePregunta[],
  unidadDeTema: (temaId: string) => string | null,
): ResultadoDeTema[] {
  const porTema = new Map<string, ResultadoDeTema & { mal: number; respondidas: number }>()
  preguntas.forEach((p, i) => {
    const actual =
      porTema.get(p.temaId) ??
      { temaId: p.temaId, nombre: p.temaNombre, unidadId: unidadDeTema(p.temaId), bien: 0, total: 0, estado: 'no_respondio' as EstadoDeTema, mal: 0, respondidas: 0 }
    actual.total++
    if (marcas[i] === 'bien') actual.bien++
    if (marcas[i] === 'mal') actual.mal++
    if (marcas[i] !== 'sin_responder') actual.respondidas++
    porTema.set(p.temaId, actual)
  })
  return [...porTema.values()].map(({ mal, respondidas, ...tema }) => ({
    ...tema,
    estado: respondidas === 0 ? 'no_respondio' : mal > 0 ? 'fallo' : 'acerto',
  }))
}

export interface ResultadoDeUnidad {
  unidadId: string | null
  nombre: string
  bien: number
  total: number
}

/** "Unidad II · Ecuaciones e inecuaciones — 4 de 9": preguntas bien sobre preguntas, por unidad. */
export function resumenPorUnidad(temas: ResultadoDeTema[], unidades: ProgramUnit[]): ResultadoDeUnidad[] {
  const orden = new Map(unidades.map((u, i) => [u.id, i]))
  const porUnidad = new Map<string, ResultadoDeUnidad>()
  for (const tema of temas) {
    const clave = tema.unidadId ?? '__sin_unidad'
    const actual = porUnidad.get(clave) ?? {
      unidadId: tema.unidadId,
      nombre: unidades.find((u) => u.id === tema.unidadId)?.name ?? 'Otros temas',
      bien: 0,
      total: 0,
    }
    actual.bien += tema.bien
    actual.total += tema.total
    porUnidad.set(clave, actual)
  }
  return [...porUnidad.values()].sort(
    (a, b) => (orden.get(a.unidadId ?? '') ?? 999) - (orden.get(b.unidadId ?? '') ?? 999),
  )
}

/** Para un cuestionario con respuestas de la app y del impreso: lo más reciente gana. */
export function elegirFuente<A extends { fecha: string }, B extends { fecha: string }>(
  app: A | null,
  impreso: B | null,
): { fuente: 'app'; dato: A } | { fuente: 'impreso'; dato: B } | null {
  if (app && impreso) return app.fecha >= impreso.fecha ? { fuente: 'app', dato: app } : { fuente: 'impreso', dato: impreso }
  if (app) return { fuente: 'app', dato: app }
  if (impreso) return { fuente: 'impreso', dato: impreso }
  return null
}

/** Los temas que falló, para "Marcar los N temas que falló como temas que le cuestan". */
export function temasFallados(temas: ResultadoDeTema[]): ResultadoDeTema[] {
  return temas.filter((t) => t.estado === 'fallo' && !t.temaId.startsWith('sin-tema:'))
}
