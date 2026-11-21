import { sql } from '@/lib/db'

/**
 * M1 · Reintentar el guardado de un resultado no crea dos intentos.
 *
 * El navegador genera `clientAttemptId` antes del primer envío y lo repite en
 * cada reintento (lib/guardado-pendiente.ts). Si el primer POST se guardó pero
 * la respuesta no volvió —lo normal con la conexión de una clase virtual—, el
 * reintento llega con el mismo id y save-result devuelve el intento que ya
 * estaba, sin insertar otro.
 *
 * La columna es de la migración 029. Sin ella (la válvula), el id se ignora y
 * se guarda como siempre.
 */

/** Un UUID, o algo parecido: letras, números y guiones, de 8 a 64. */
export function limpiarClientAttemptId(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpio = valor.trim()
  return /^[A-Za-z0-9-]{8,64}$/.test(limpio) ? limpio : null
}

export interface IntentoPrevio {
  quizAttemptId: number
  classroomId: number | null
  assignmentId: number | null
  attemptNumber: number | null
}

export type BusquedaDePrevio =
  | { tipo: 'existe'; intento: IntentoPrevio }
  | { tipo: 'nuevo' }
  /** La 029 no corrió en esta base: no hay dónde buscar ni dónde guardar el id. */
  | { tipo: 'sin-columna' }

/** Postgres: columna inexistente. */
export function faltaLaColumna(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === '42703' || code === '42P01'
}

/** Postgres: violación de un índice único (dos envíos simultáneos del mismo id). */
export function esDuplicado(error: unknown): boolean {
  return (error as { code?: string })?.code === '23505'
}

/** Forma del SELECT de abajo — DDL en scripts/001-create-tables.sql, 015 y 029. */
interface FilaPrevia {
  id: number
  classroom_id: number | null
  assignment_id: number | null
  attempt_number: number | null
}

export async function buscarIntentoPrevio(userId: string, clientAttemptId: string): Promise<BusquedaDePrevio> {
  let filas: FilaPrevia[]
  try {
    filas = (await sql`
      SELECT id, classroom_id, assignment_id, attempt_number
      FROM quiz_attempts
      WHERE client_attempt_id = ${clientAttemptId} AND user_id = ${userId}
      LIMIT 1
    `) as FilaPrevia[]
  } catch (error) {
    if (faltaLaColumna(error)) return { tipo: 'sin-columna' }
    throw error
  }
  const fila = filas[0]
  if (!fila) return { tipo: 'nuevo' }
  return {
    tipo: 'existe',
    intento: {
      quizAttemptId: Number(fila.id),
      classroomId: fila.classroom_id === null ? null : Number(fila.classroom_id),
      assignmentId: fila.assignment_id === null ? null : Number(fila.assignment_id),
      attemptNumber: fila.attempt_number === null ? null : Number(fila.attempt_number),
    },
  }
}
