/**
 * Tanda AB · AB7 — «Revisá y aprobá»: nada le llega al alumno sin el OK del
 * docente, y eso tiene que verse. Cada pregunta se aprueba en un clic; arriba,
 * «7 de 10 revisadas»; y «Aprobar todas y mandar» para el que ya las leyó.
 *
 * La aprobación vive en la pantalla (no se guarda: es la revisión de ahora, no
 * un estado de la pregunta). Una pregunta que se regenera o se quita deja de
 * contar; editar una aprobada la mantiene aprobada (la editó al revisarla).
 */

/** La clave de una pregunta en la revisión: su id, o su lugar si no trae id. */
export function claveDePregunta(pregunta: { id?: string | number | null }, indice: number): string {
  return pregunta.id === undefined || pregunta.id === null || pregunta.id === '' ? `#${indice}` : String(pregunta.id)
}

/** Cuántas de las preguntas actuales están aprobadas (las aprobadas que ya no están no cuentan). */
export function contarRevisadas(preguntas: readonly { id?: string | number | null }[], aprobadas: ReadonlySet<string>): number {
  return preguntas.filter((p, i) => aprobadas.has(claveDePregunta(p, i))).length
}

/** «7 de 10 revisadas», «1 de 1 revisada». */
export function textoDelContador(revisadas: number, total: number): string {
  return `${revisadas} de ${total} ${total === 1 ? 'revisada' : 'revisadas'}`
}

/** Todas las preguntas actuales, aprobadas. */
export function aprobarTodas(preguntas: readonly { id?: string | number | null }[]): Set<string> {
  return new Set(preguntas.map((p, i) => claveDePregunta(p, i)))
}

/** Aprueba o desaprueba una. */
export function alternarAprobada(aprobadas: ReadonlySet<string>, clave: string): Set<string> {
  const nuevas = new Set(aprobadas)
  if (nuevas.has(clave)) nuevas.delete(clave)
  else nuevas.add(clave)
  return nuevas
}

// ─── AC2: ninguna tarea se manda sin aprobar ─────────────────────────────────

/**
 * Una tarea está aprobada cuando pasó por «Revisá y aprobá» o se guardó a
 * propósito (`status: 'saved'`). La que salió de «Compartir» sin revisar queda
 * `pending_share`: ésa no se manda hasta aprobarla.
 */
export function necesitaRevision(tarea: { status?: string | null } | null | undefined): boolean {
  return tarea?.status === 'pending_share'
}

/** Qué abre «Mandar»: la revisión (si falta aprobarla) o el diálogo de mandar. */
export function caminoAlMandar(tarea: { status?: string | null }): 'revision' | 'mandar' {
  return necesitaRevision(tarea) ? 'revision' : 'mandar'
}

/** Después de generar: «Compartir» pasa por la revisión; «Guardar» y «Realizar», como siempre. */
export function despuesDeGenerar(accion: 'realizar' | 'guardar' | 'compartir'): 'revision' | 'lista' | 'cuestionario' {
  return accion === 'compartir' ? 'revision' : accion === 'guardar' ? 'lista' : 'cuestionario'
}

/** La ruta que abre «Revisá y aprobá» de una tarea en *Mis tareas*. */
export const rutaDeRevisarYAprobar = (id: number) => `/teacher?seccion=tareas&revisar=${id}`
