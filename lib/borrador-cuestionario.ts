import type { Answer, Question, QuizConfig } from './types'

/**
 * M1 · El borrador de un cuestionario a medio hacer, en el navegador.
 *
 * Hasta la tanda M el progreso vivía sólo en el estado de React: a un alumno
 * que se le cortaba internet en clase virtual y recargaba la página le tocaba
 * empezar de cero. El corte pasa en el mismo dispositivo, así que alcanza con
 * `localStorage`: nada de esto pasa por el servidor.
 *
 * Este archivo es puro (sin `window`): arma, valida y reconcilia. Quien lo usa
 * le pasa el `Storage` (components/quiz-borrador.tsx), y los tests uno de
 * mentira.
 */

/** Pasada esta antigüedad, el borrador se descarta. */
export const DIAS_DE_VIGENCIA = 7
const MS_POR_DIA = 24 * 60 * 60 * 1000

const PREFIJO = 'maestria:borrador:'

export interface Borrador {
  version: 1
  /** `tarea-12`, `cuestionario-34` o `practica`. Ver `idDeBorrador`. */
  id: string
  /** El orden en que le tocaron las preguntas (los ids). */
  ordenDePreguntas: string[]
  /**
   * La huella de cada pregunta, en el mismo orden: si el docente la editó, la
   * huella cambia aunque el id sea el mismo, y las respuestas ya corregidas
   * contra la versión vieja no valen.
   */
  huellas: string[]
  /**
   * Las preguntas enteras, sólo en la práctica libre: ahí las generó la IA
   * para este alumno y no hay copia en el servidor de donde volver a pedirlas.
   */
  preguntas?: Question[]
  /** La configuración con que arrancó (para volver a arrancar igual). */
  config: QuizConfig
  /** Las respuestas dadas, incluidas las de respuesta corta ya corregidas. */
  answers: Answer[]
  currentIndex: number
  startedAt: string | null
  /** Cuándo vence la tarea, si vence. Un borrador de una tarea vencida no sirve. */
  venceEl: string | null
  actualizadoEl: string
}

export type MotivoDeDescarte = 'vieja' | 'preguntas' | 'vencida' | 'vacia'

export type Evaluacion = { valido: true } | { valido: false; motivo: MotivoDeDescarte }

/**
 * Qué cuestionario es, para la clave. La vista previa del docente no tiene
 * borrador (no es un intento de nadie); la práctica libre tiene uno solo por
 * persona: la siguiente lo pisa.
 */
export function idDeBorrador(config: QuizConfig | null | undefined): string | null {
  if (!config || config.previewOnly) return null
  if (config.assignmentId) return `tarea-${config.assignmentId}`
  if (config.teacherQuizId) return `cuestionario-${config.teacherQuizId}`
  return 'practica'
}

/** ¿Las preguntas viven en el servidor (tarea, cuestionario) o sólo en el borrador? */
export function esPractica(id: string): boolean {
  return id === 'practica'
}

export function claveDeBorrador(viewerId: string, id: string): string {
  return `${PREFIJO}${viewerId}:${id}`
}

/**
 * Huella corta y estable de una pregunta (djb2 sobre su JSON). No es
 * criptográfica: sólo tiene que cambiar cuando el docente cambia algo.
 */
export function huellaDePregunta(pregunta: Question): string {
  const texto = JSON.stringify(pregunta)
  let hash = 5381
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) + hash + texto.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

export interface EstadoDelCuestionario {
  config: QuizConfig
  questions: Question[]
  answers: Answer[]
  currentIndex: number
  startedAt: string | null
}

/** Arma el borrador a partir del estado del motor. `null` si no corresponde. */
export function armarBorrador(
  estado: EstadoDelCuestionario,
  { ahora }: { ahora: Date },
): Borrador | null {
  const id = idDeBorrador(estado.config)
  if (!id || estado.answers.length === 0) return null
  return {
    version: 1,
    id,
    ordenDePreguntas: estado.questions.map((q) => q.id),
    huellas: estado.questions.map(huellaDePregunta),
    ...(esPractica(id) ? { preguntas: estado.questions } : {}),
    config: estado.config,
    answers: estado.answers,
    currentIndex: estado.currentIndex,
    startedAt: estado.startedAt,
    venceEl: estado.config.dueAt ?? null,
    actualizadoEl: ahora.toISOString(),
  }
}

export function serializarBorrador(borrador: Borrador): string {
  return JSON.stringify(borrador)
}

/** Lee lo guardado. Cualquier cosa que no tenga la forma esperada es `null`. */
export function leerBorrador(crudo: string | null | undefined): Borrador | null {
  if (!crudo) return null
  let dato: unknown
  try {
    dato = JSON.parse(crudo)
  } catch {
    return null
  }
  if (!dato || typeof dato !== 'object') return null
  const b = dato as Partial<Borrador>
  if (b.version !== 1 || typeof b.id !== 'string') return null
  if (!Array.isArray(b.ordenDePreguntas) || !Array.isArray(b.huellas) || !Array.isArray(b.answers)) return null
  if (b.ordenDePreguntas.length !== b.huellas.length) return null
  if (typeof b.currentIndex !== 'number' || typeof b.actualizadoEl !== 'string') return null
  if (!b.config || typeof b.config !== 'object') return null
  if (b.preguntas !== undefined && !Array.isArray(b.preguntas)) return null
  return b as Borrador
}

/**
 * ¿Sirve todavía? Se descarta si tiene más de 7 días, si las preguntas
 * cambiaron (otro conjunto de ids o alguna editada), si la tarea venció, o si
 * no tiene ninguna respuesta.
 *
 * `preguntasActuales` son las que acaba de mandar el servidor; en la práctica
 * libre no hay, y se compara contra las que guarda el propio borrador.
 */
export function evaluarBorrador(
  borrador: Borrador,
  { ahora, preguntasActuales }: { ahora: Date; preguntasActuales?: Question[] },
): Evaluacion {
  if (borrador.venceEl) {
    const vence = Date.parse(borrador.venceEl)
    if (Number.isFinite(vence) && vence <= ahora.getTime()) return { valido: false, motivo: 'vencida' }
  }
  const actualizado = Date.parse(borrador.actualizadoEl)
  if (!Number.isFinite(actualizado) || ahora.getTime() - actualizado > DIAS_DE_VIGENCIA * MS_POR_DIA) {
    return { valido: false, motivo: 'vieja' }
  }
  if (borrador.answers.length === 0) return { valido: false, motivo: 'vacia' }

  const preguntas = preguntasActuales ?? borrador.preguntas
  if (!preguntas || !mismasPreguntas(borrador, preguntas)) return { valido: false, motivo: 'preguntas' }
  return { valido: true }
}

/** Mismo conjunto de ids y ninguna editada (el orden puede ser otro). */
function mismasPreguntas(borrador: Borrador, preguntas: Question[]): boolean {
  if (preguntas.length !== borrador.ordenDePreguntas.length) return false
  const huellaPorId = new Map(borrador.ordenDePreguntas.map((id, i) => [id, borrador.huellas[i]]))
  if (huellaPorId.size !== preguntas.length) return false
  return preguntas.every((q) => huellaPorId.get(q.id) === huellaDePregunta(q))
}

/**
 * Vuelve a armar el cuestionario donde quedó: las preguntas en el orden que le
 * tocaron, sólo las respuestas de preguntas que siguen existiendo, y la
 * pregunta actual en la primera sin responder (la navegación del alumno va
 * sólo hacia adelante, así que las respondidas son las de antes). `completo`
 * si ya había respondido todas: el resultado se muestra sin volver a mostrar
 * ninguna pregunta.
 */
export function reconciliarBorrador(
  borrador: Borrador,
  preguntasActuales?: Question[],
): { questions: Question[]; answers: Answer[]; currentIndex: number; completo: boolean } {
  const fuente = preguntasActuales ?? borrador.preguntas ?? []
  const porId = new Map(fuente.map((q) => [q.id, q]))
  const questions = borrador.ordenDePreguntas
    .map((id) => porId.get(id))
    .filter((q): q is Question => Boolean(q))
  const ids = new Set(questions.map((q) => q.id))
  const answers = borrador.answers.filter((a) => ids.has(a.questionId))
  const respondidas = new Set(answers.map((a) => a.questionId))
  const primeraSinResponder = questions.findIndex((q) => !respondidas.has(q.id))
  const completo = primeraSinResponder === -1
  return {
    questions,
    answers,
    currentIndex: completo ? Math.max(0, questions.length - 1) : primeraSinResponder,
    completo,
  }
}

/** "12 de 20 respondidas". */
export function resumenDeBorrador(borrador: Borrador): { respondidas: number; total: number } {
  const ids = new Set(borrador.ordenDePreguntas)
  const respondidas = new Set(borrador.answers.filter((a) => ids.has(a.questionId)).map((a) => a.questionId)).size
  return { respondidas, total: borrador.ordenDePreguntas.length }
}

/** Lo mínimo de `Storage` que hace falta (para poder probarlo sin navegador). */
export type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Todo envuelto: un `localStorage` bloqueado o lleno nunca rompe el cuestionario. */
export function guardarBorrador(almacen: Almacen | null, viewerId: string, borrador: Borrador): boolean {
  if (!almacen) return false
  try {
    almacen.setItem(claveDeBorrador(viewerId, borrador.id), serializarBorrador(borrador))
    return true
  } catch {
    return false
  }
}

export function cargarBorrador(almacen: Almacen | null, viewerId: string, id: string): Borrador | null {
  if (!almacen) return null
  try {
    const borrador = leerBorrador(almacen.getItem(claveDeBorrador(viewerId, id)))
    return borrador && borrador.id === id ? borrador : null
  } catch {
    return null
  }
}

export function descartarBorrador(almacen: Almacen | null, viewerId: string, id: string): void {
  if (!almacen) return
  try {
    almacen.removeItem(claveDeBorrador(viewerId, id))
  } catch {
    // Nada que hacer: el peor caso es que el aviso vuelva a aparecer.
  }
}

/** El `localStorage` del navegador, o `null` si no hay o está bloqueado. */
export function almacenDelNavegador(): Almacen | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}
