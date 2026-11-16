/**
 * Política de rate limiting para las llamadas a Gemini.
 *
 * Este módulo es deliberadamente puro: no toca la base ni lee la request. Toma
 * "quién sos" y "cuánto llevás usado" y devuelve una decisión. Toda la parte
 * sucia (contar filas, insertar el log, cortar la respuesta HTTP) vive en
 * `lib/ai-usage.ts` y `lib/ai-guard.ts`. La separación existe para que los
 * números y los mensajes se puedan testear sin levantar una base.
 *
 * Los límites no están pensados para racionar a un alumno real, sino para que
 * un bucle descontrolado o un código de aula filtrado no vacíen la cuenta de
 * Gemini. Un alumno intenso hace ~3 cuestionarios por día; el tope está diez
 * veces más arriba. El sublímite por hora es el que realmente frena un bucle:
 * sin él, un cliente roto quema el presupuesto del día en dos minutos.
 */
import type { Nivel } from '@/lib/types'

/**
 * Los endpoints se agrupan por perfil de costo, no uno por uno: lo que importa
 * para el límite es cuántos tokens quema la llamada, no de qué handler salió.
 * Es también el valor que se guarda en `ai_usage_log.endpoint`, así que el
 * dashboard agrupa por la misma dimensión con la que se limita.
 */
export const AI_BUCKETS = [
  'quiz_generation',
  'feedback',
  'grading',
  'program_extraction',
  'program_upload',
] as const
export type AiBucket = (typeof AI_BUCKETS)[number]

/** Rol efectivo a los fines del límite. `admin` no es un rol del producto. */
export type AiActor = 'guest' | 'alumno' | 'docente' | 'admin'

export interface BucketLimits {
  /** Llamadas permitidas en una ventana deslizante de 24 h. 0 = bloqueado. */
  perDay: number
  /** Sublímite en una ventana deslizante de 1 h. 0 = bloqueado. */
  perHour: number
}

export const DAY_WINDOW_SECONDS = 24 * 60 * 60
export const HOUR_WINDOW_SECONDS = 60 * 60

/**
 * `guest.quiz_generation` conserva el 3/día que ya regía antes de esta tabla
 * (era GUEST_DAILY_GENERATION_LIMIT), para no cambiarle las reglas a los
 * invitados de paso. El resto son topes nuevos.
 *
 * `program_extraction` está en 0 para alumnos e invitados porque los handlers
 * ya exigen DOCENTE: el 0 es defensa en profundidad, no la única barrera.
 *
 * `program_upload` existe aparte justamente porque NO es exclusivo de docentes:
 * un alumno de Nivel Superior sube el programa de su carrera desde el selector
 * de currículum. Los topes son bajos igual — subir un programa es algo que se
 * hace una vez por materia, no algo que se repita durante una sesión.
 */
export const AI_LIMITS: Record<AiBucket, Record<Exclude<AiActor, 'admin'>, BucketLimits>> = {
  quiz_generation: {
    guest: { perDay: 3, perHour: 3 },
    alumno: { perDay: 30, perHour: 10 },
    docente: { perDay: 60, perHour: 20 },
  },
  feedback: {
    guest: { perDay: 15, perHour: 8 },
    alumno: { perDay: 60, perHour: 25 },
    docente: { perDay: 60, perHour: 25 },
  },
  grading: {
    guest: { perDay: 40, perHour: 20 },
    alumno: { perDay: 150, perHour: 60 },
    docente: { perDay: 150, perHour: 60 },
  },
  program_extraction: {
    guest: { perDay: 0, perHour: 0 },
    alumno: { perDay: 0, perHour: 0 },
    docente: { perDay: 20, perHour: 8 },
  },
  program_upload: {
    // Los invitados nunca llegan: el handler exige sesión NextAuth.
    guest: { perDay: 0, perHour: 0 },
    alumno: { perDay: 8, perHour: 4 },
    docente: { perDay: 20, perHour: 8 },
  },
}

export type RateLimitReason = 'admin_bypass' | 'within_limits' | 'blocked_for_role' | 'hour_limit' | 'day_limit'

export type RateLimitDecision =
  | { allowed: true; reason: Extract<RateLimitReason, 'admin_bypass' | 'within_limits'> }
  | {
      allowed: false
      reason: Extract<RateLimitReason, 'blocked_for_role' | 'hour_limit' | 'day_limit'>
      limit: number
      /** Para el header Retry-After. Siempre ≥ 1 salvo que el bucket esté vedado. */
      retryAfterSeconds: number
    }

export interface RateLimitInput {
  bucket: AiBucket
  actor: AiActor
  /** Llamadas en las últimas 24 h, incluyendo las fallidas. */
  usedInDay: number
  /** Llamadas en la última hora. */
  usedInHour: number
  /**
   * Momento de la llamada más vieja de cada ventana. Sirve para decir "volvé en
   * 12 minutos" en vez de "volvé en una hora". Si no se conoce, el retry-after
   * cae al ancho completo de la ventana, que es conservador pero nunca miente
   * por defecto (nunca invita a reintentar antes de tiempo).
   */
  oldestInDay?: Date | null
  oldestInHour?: Date | null
  now?: Date
}

function secondsUntilWindowFrees(oldest: Date | null | undefined, windowSeconds: number, now: Date): number {
  if (!oldest) return windowSeconds
  const freesAt = oldest.getTime() + windowSeconds * 1000
  const remaining = Math.ceil((freesAt - now.getTime()) / 1000)
  // Si la fila más vieja ya salió de la ventana, el contador que la incluía
  // estaba desactualizado; pedir 1 segundo es mejor que devolver 0 o negativo.
  return Math.min(windowSeconds, Math.max(1, remaining))
}

/**
 * Decide si la llamada procede. El chequeo por hora va antes que el diario a
 * propósito: cuando se cruzan los dos, el mensaje útil es el más corto ("volvé
 * en un rato"), no el que manda al usuario a esperar hasta mañana.
 */
export function evaluateAiRateLimit(input: RateLimitInput): RateLimitDecision {
  const { bucket, actor, usedInDay, usedInHour, now = new Date() } = input

  if (actor === 'admin') return { allowed: true, reason: 'admin_bypass' }

  const limits = AI_LIMITS[bucket][actor]

  if (limits.perDay === 0 || limits.perHour === 0) {
    return { allowed: false, reason: 'blocked_for_role', limit: 0, retryAfterSeconds: 0 }
  }

  if (usedInHour >= limits.perHour) {
    return {
      allowed: false,
      reason: 'hour_limit',
      limit: limits.perHour,
      retryAfterSeconds: secondsUntilWindowFrees(input.oldestInHour, HOUR_WINDOW_SECONDS, now),
    }
  }

  if (usedInDay >= limits.perDay) {
    return {
      allowed: false,
      reason: 'day_limit',
      limit: limits.perDay,
      retryAfterSeconds: secondsUntilWindowFrees(input.oldestInDay, DAY_WINDOW_SECONDS, now),
    }
  }

  return { allowed: true, reason: 'within_limits' }
}

/** "en 12 minutos", "en 2 horas" — para meter dentro de una frase. */
export function humanizeRetryAfter(seconds: number): string {
  if (seconds <= 90) return 'en un ratito'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `en ${minutes} minutos`
  const hours = Math.round(minutes / 60)
  if (hours === 1) return 'en una hora'
  if (hours < 24) return `en ${hours} horas`
  return 'mañana'
}

/**
 * El mismo corte se explica distinto según quién lo lea. Un chico de primaria
 * necesita saber que no hizo nada mal y cuándo puede volver; un docente
 * necesita el número concreto para decidir si pedir más cupo.
 */
export function rateLimitMessage(
  decision: Extract<RateLimitDecision, { allowed: false }>,
  options: { actor: AiActor; nivel?: Nivel | string | null } = { actor: 'alumno' }
): string {
  const { actor, nivel } = options

  if (decision.reason === 'blocked_for_role') {
    return 'Esta función es exclusiva del panel docente.'
  }

  const when = humanizeRetryAfter(decision.retryAfterSeconds)

  if (actor === 'guest') {
    return `Como invitado podés usar la IA ${decision.limit} veces por día. Iniciá sesión con Google para tener mucho más margen — y además se te guarda el progreso. Si preferís seguir como invitado, probá de nuevo ${when}.`
  }

  // Cálido, pero es un aviso de la interfaz: sin emoji ni signos de
  // admiración (voz-y-textos.md, "Emojis"). Los emojis de Primario van sólo
  // dentro del contenido que genera la IA.
  if (nivel === 'Primario') {
    return `Uf, cuánta práctica. Por hoy llegaste al máximo de ${decision.limit}. Descansá un poquito y volvé ${when}, que te sigo esperando.`
  }

  if (actor === 'docente') {
    return `Alcanzaste el límite de ${decision.limit} usos de IA en esta ventana. Podés retomar ${when}.`
  }

  return `Llegaste al límite de ${decision.limit} usos de IA por ahora. Volvé a intentar ${when} y seguimos.`
}

/**
 * Allowlist por email para poder probar los tres roles sin chocar contra los
 * topes. Sólo saltea el límite POR USUARIO: el kill switch de presupuesto
 * global sigue aplicando, porque ahí el objetivo es la factura, no el abuso.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return false

  const normalized = email.trim().toLowerCase()
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized)
}
