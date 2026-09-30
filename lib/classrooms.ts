import type { AssignmentState, ClassroomAssignmentWindow } from '@/lib/types'

/**
 * No I, O, 0 or 1: the code gets read off a whiteboard and typed by a
 * ten-year-old, so ambiguous glyphs are more expensive than the extra entropy
 * they'd buy. 32^6 ≈ 1.07e9 combinations is plenty for classroom scale.
 */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const JOIN_CODE_LENGTH = 6

export function generateJoinCode(length: number = JOIN_CODE_LENGTH): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)

  let code = ''
  for (const byte of bytes) code += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length]
  return code
}

/**
 * What the student typed → what we look up. Tolerates lowercase, spaces and
 * the dashes people add when reading a code aloud; anything outside the
 * alphabet is dropped rather than silently mismatched.
 */
export function normalizeJoinCode(raw: string): string {
  return String(raw ?? '')
    .toUpperCase()
    .split('')
    .filter((char) => JOIN_CODE_ALPHABET.includes(char))
    .join('')
}

export function isValidJoinCode(raw: string): boolean {
  return normalizeJoinCode(raw).length === JOIN_CODE_LENGTH
}

/**
 * Where an assignment stands for one student, right now. Pure so the rules
 * are testable and so the student page and the save-result guard can't drift
 * apart — both call this.
 *
 * Precedence matters: a closed aula beats everything, then the opening date,
 * then the deadline, and only then the attempt count. A student who used all
 * their attempts on a still-open assignment should read "sin intentos", not
 * "disponible".
 */
export function assignmentState(
  assignment: ClassroomAssignmentWindow,
  attemptsUsed: number,
  now: Date,
  classroomStatus: 'open' | 'closed' = 'open'
): AssignmentState {
  if (classroomStatus === 'closed') return 'cerrada'

  const opensAt = assignment.opensAt ? new Date(assignment.opensAt) : null
  const dueAt = assignment.dueAt ? new Date(assignment.dueAt) : null

  if (opensAt && now < opensAt) return 'programada'
  if (dueAt && now > dueAt) return 'vencida'
  if (assignment.maxAttempts !== null && attemptsUsed >= assignment.maxAttempts) return 'sin_intentos'

  return 'disponible'
}

export function canStartAssignment(state: AssignmentState): boolean {
  return state === 'disponible'
}

export const ASSIGNMENT_STATE_LABEL: Record<AssignmentState, string> = {
  disponible: 'Disponible',
  programada: 'Todavía no abre',
  vencida: 'Vencida',
  sin_intentos: 'Sin intentos disponibles',
  cerrada: 'Aula cerrada',
}

/**
 * Cupo diario de generación para invitados.
 *
 * @deprecated La política de límites vive en `lib/ai-rate-limit.ts`
 * (`AI_LIMITS.quiz_generation.guest`), que cubre todos los endpoints de IA y no
 * sólo la generación. Esta constante queda como referencia del valor histórico;
 * no la uses para decidir cortes nuevos.
 */
export const GUEST_DAILY_GENERATION_LIMIT = 3

export type GuestCapStatus = 'ok' | 'near' | 'reached'

/**
 * Cómo está un aula respecto del tope de invitados nuevos (el tope y el conteo
 * viven en lib/classroom-guest-cap.ts, que es sólo de servidor). `near` existe
 * para el docente: enterarse al 75% le da tiempo de pedir que el resto entre
 * con Google antes de que alguien quede afuera. `reached` usa el mismo `>=`
 * que el corte del join, así el aviso aparece exactamente cuando empiezan los
 * rechazos.
 */
export function guestCapStatus(newGuests: number, limit: number): GuestCapStatus {
  if (newGuests >= limit) return 'reached'
  if (newGuests >= Math.ceil(limit * 0.75)) return 'near'
  return 'ok'
}
