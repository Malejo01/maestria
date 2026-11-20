/**
 * L0: a quién va una asignación. Puro y con tests (lib/destinatario.test.ts).
 *
 * Con `soloUserId` y `soloInvitacionId` en null, la asignación es del grupo,
 * como fue siempre. Con uno cargado, es sólo para esa persona: un diagnóstico
 * armado desde la ficha de un alumno no lo ve el resto del grupo.
 *
 * Las consultas leen las dos columnas con `to_jsonb(a) ->> 'solo_user_id'` y
 * no con `a.solo_user_id`: sin la migración 028 la clave no existe, da NULL, y
 * todo queda del grupo, como hoy (la válvula). Por eso el filtro vive acá y no
 * en el SQL: una sola regla, con tests, para la lista del alumno, la entrada
 * al cuestionario y el guardado del intento.
 */

export interface DestinatarioDeAsignacion {
  soloUserId: string | null
  soloInvitacionId: number | null
}

/** ¿Es del grupo entero? */
export function esDelGrupo(asignacion: DestinatarioDeAsignacion): boolean {
  return asignacion.soloUserId === null && asignacion.soloInvitacionId === null
}

/**
 * ¿La ve este alumno? Las del grupo, sí; las individuales, sólo la suya. Una
 * asignación de una invitación que todavía no se reclamó no la ve nadie: el
 * "Soy yo" la pasa a `soloUserId` en el momento en que la invitación se usa.
 */
export function visibleParaAlumno(asignacion: DestinatarioDeAsignacion, userId: string): boolean {
  if (esDelGrupo(asignacion)) return true
  return asignacion.soloUserId !== null && asignacion.soloUserId === userId
}

/** Lee el destinatario de una fila que trae `solo_user_id` y `solo_invitacion_id` (pueden faltar: sin la 028). */
export function destinatarioDeFila(fila: Record<string, unknown>): DestinatarioDeAsignacion {
  const usuario = fila.solo_user_id
  const invitacion = fila.solo_invitacion_id
  return {
    soloUserId: typeof usuario === 'string' && usuario !== '' ? usuario : null,
    soloInvitacionId: invitacion === null || invitacion === undefined || invitacion === '' ? null : Number(invitacion),
  }
}

/**
 * ¿Este diagnóstico es de esta persona? Para la ficha: un alumno ve los suyos
 * y los de la invitación con la que entró. Uno del grupo (null) no es de nadie
 * en particular: se ve en el grupo, no en la ficha.
 */
export function diagnosticoEsDe(
  destinatario: { userId: string } | { invitacionId: number } | null,
  quien: { userId: string | null; invitacionId: number | null },
): boolean {
  if (destinatario === null) return false
  if ('userId' in destinatario) return quien.userId !== null && destinatario.userId === quien.userId
  return quien.invitacionId !== null && destinatario.invitacionId === quien.invitacionId
}
