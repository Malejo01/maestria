import { sql } from '@/lib/db'
import { normalizarNombre } from '@/lib/alumnos-docente'
import { faltaLa027 } from '@/lib/fichas-server'

/**
 * K5: el alumno que el docente agregó por nombre entra al grupo COMO esa
 * invitación, y en ese momento la invitación se usa: la ficha (y los
 * resultados impresos cargados antes) pasan a ser del alumno, el miembro toma
 * el nombre que le puso el docente, y la invitación se borra.
 *
 * Antes la invitación no se usaba nunca: se fundía con el miembro del mismo
 * nombre al LEER (lib/alumnos-docente.ts), y la ficha seguía colgada de la
 * invitación hasta que el docente la guardara. Si el alumno escribía su nombre
 * distinto, quedaban dos personas.
 *
 * Válvula de la 027: si falta `fichas_alumno`, no se toca nada (ni se borra la
 * invitación) y la fusión al leer sigue como hasta ahora.
 */

export interface InvitacionPendiente {
  id: number
  nombre: string
}

type Fila = Record<string, unknown>

/**
 * Las invitaciones del grupo que todavía no tienen alumno: las que no se
 * funden con un miembro activo del mismo nombre.
 */
export async function pendientesDelGrupo(classroomId: number): Promise<InvitacionPendiente[]> {
  const [invitaciones, miembros] = await Promise.all([
    sql`SELECT id, nombre FROM classroom_invitations WHERE classroom_id = ${classroomId} ORDER BY nombre ASC, id ASC` as Promise<Fila[]>,
    sql`
      SELECT display_name FROM classroom_members
      WHERE classroom_id = ${classroomId} AND status = 'active'
    ` as Promise<Fila[]>,
  ])
  const ocupados = new Set(miembros.map((m) => normalizarNombre(String(m.display_name ?? ''))))
  return invitaciones
    .map((i) => ({ id: Number(i.id), nombre: String(i.nombre) }))
    .filter((i) => !ocupados.has(normalizarNombre(i.nombre)))
}

/** La invitación pendiente que corresponde a un nombre escrito, si hay exactamente una. */
export function invitacionPorNombre(pendientes: InvitacionPendiente[], nombre: string): InvitacionPendiente | null {
  const clave = normalizarNombre(nombre)
  if (!clave) return null
  const iguales = pendientes.filter((i) => normalizarNombre(i.nombre) === clave)
  return iguales.length === 1 ? iguales[0] : null
}

/**
 * Usa la invitación para `userId`, que ya es miembro del grupo. Devuelve false
 * si no se hizo (la invitación no es de ese grupo, o falta la 027).
 */
export async function usarInvitacion({
  classroomId,
  invitacionId,
  userId,
}: {
  classroomId: number
  invitacionId: number
  userId: string
}): Promise<boolean> {
  const filas = (await sql`
    SELECT i.id, i.nombre, i.contexto, c.teacher_id
    FROM classroom_invitations i JOIN classrooms c ON c.id = i.classroom_id
    WHERE i.id = ${invitacionId} AND i.classroom_id = ${classroomId}
    LIMIT 1
  `) as Fila[]
  const invitacion = filas[0]
  if (!invitacion) return false
  const teacherId = String(invitacion.teacher_id)

  try {
    // La ficha armada antes de que entrara pasa a ser suya (si no tiene una propia).
    await sql`
      UPDATE fichas_alumno SET user_id = ${userId}, invitation_id = NULL, updated_at = NOW()
      WHERE teacher_id = ${teacherId} AND invitation_id = ${invitacionId}
        AND NOT EXISTS (SELECT 1 FROM fichas_alumno f WHERE f.teacher_id = ${teacherId} AND f.user_id = ${userId})
    `
    await sql`
      UPDATE diagnostico_resultados_impresos SET user_id = ${userId}, invitation_id = NULL
      WHERE invitation_id = ${invitacionId}
    `
  } catch (error) {
    if (faltaLa027(error)) return false
    throw error
  }

  // El nombre que le puso el docente, y el contexto de la invitación si el
  // miembro no tenía uno (lo de antes de la ficha, migración 025).
  await sql`
    UPDATE classroom_members
    SET display_name = ${String(invitacion.nombre)},
        contexto = COALESCE(contexto, ${invitacion.contexto === null ? null : String(invitacion.contexto)}),
        updated_at = NOW()
    WHERE classroom_id = ${classroomId} AND user_id = ${userId}
  `
  await sql`DELETE FROM classroom_invitations WHERE id = ${invitacionId} AND classroom_id = ${classroomId}`
  return true
}
