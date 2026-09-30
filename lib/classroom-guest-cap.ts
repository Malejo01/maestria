/**
 * Tope de invitados NUEVOS por aula en una ventana de 24 h.
 *
 * Ataca el agujero de fondo del modelo de invitados: crear uno cuesta sólo un
 * código de aula y un nombre, y cada invitado nuevo trae su cupo de IA limpio.
 * El sub-tope de gasto (AI_GUEST_DAILY_BUDGET_USD) acota la factura; esto
 * acota cuánto se puede abusar de UN código filtrado, y lo ata a la señal más
 * honesta que existe: cada aula tiene un docente responsable que puede rotar
 * el código.
 *
 * Sólo cuenta a los invitados recién creados. El que vuelve con su cookie, el
 * alumno con Google y el invitado que re-entra a un aula donde ya estaba no
 * pasan por acá — nunca se les corta la entrada.
 *
 * Se cuenta con las tablas que ya existen, sin migración: un invitado nuevo es
 * una fila de `users` con `is_guest` y `created_at` dentro de la ventana, con
 * membresía en el aula. Una membresía dada de baja sigue contando: el
 * invitado igual se creó, y si no, sacar gente de la lista liberaría cupo para
 * fabricar más. El caso borde —un invitado creado hoy en otra aula que además
 * entra a esta— cuenta en las dos; sobrecontar sólo hace el tope más estricto,
 * y con este número no llega a molestar.
 *
 * No es atómico: N pedidos simultáneos pueden leer el mismo conteo y pasar
 * todos. El desborde queda acotado por la concurrencia de una sola ráfaga, y
 * lo que esa ráfaga puede gastar lo acota el sub-tope de invitados.
 */
import { sql } from '@/lib/db'

/**
 * 60: la clase legítima más grande que esperamos son 30–40 alumnos entrando
 * juntos al empezar, todos sin cuenta. El margen de 1,5× cubre a los que
 * vuelven a entrar desde otro dispositivo o en modo incógnito — sin la cookie
 * cada re-entrada es un invitado nuevo. Dos comisiones de 35 compartiendo la
 * misma aula el mismo día sí lo superan; la recomendación es un aula por
 * comisión, y si hace falta, se sube por env.
 *
 * Lo que un código filtrado puede gastar con 60: 60 × 3 generaciones ×
 * ~$0,011 ≈ $2 por día, y el sub-tope de invitados corta antes de que eso se
 * multiplique por varias aulas.
 */
export const DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT = 60

export function classroomDailyNewGuestLimit(): number {
  const raw = Number(process.env.CLASSROOM_DAILY_NEW_GUEST_LIMIT)
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT
}

/** Invitados creados en las últimas 24 h con membresía en el aula. */
export async function countNewGuestsInClassroom(classroomId: number): Promise<number> {
  // El `::int` no es decorativo: sin él Neon devuelve el COUNT como string.
  const rows = (await sql`
    SELECT COUNT(*)::int AS new_guests
    FROM classroom_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.classroom_id = ${classroomId}
      AND u.is_guest = true
      AND u.created_at > NOW() - INTERVAL '24 hours'
  `) as { new_guests: number }[]

  return Number(rows[0]?.new_guests ?? 0)
}

export const GUEST_CAP_REACHED_MESSAGE =
  'Esta aula ya recibió muchos ingresos sin cuenta hoy, así que por ahora no podemos sumar más invitados. Ingresá con tu cuenta de Google para entrar igual, o avisale a tu docente.'
