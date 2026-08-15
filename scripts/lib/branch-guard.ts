/**
 * El guardián que garantiza que una branch clonada de producción no sobreviva a
 * un fallo.
 *
 * Vive separado de scripts/create-staging-branch.ts, y como una fábrica en vez
 * de variables de módulo, por una sola razón: es la pieza de la que depende que
 * los datos de 31 alumnos identificables no queden dando vueltas en una branch
 * huérfana, y una pieza así tiene que poder probarse. Con estado global y un
 * `run()` de nivel superior no se puede.
 *
 * El invariante: la branch sobrevive si y sólo si alguien llamó a `keep()`.
 * Cualquier otro final —error, verificación fallida, Ctrl-C— la borra.
 */

/** Lo mínimo que el guardián necesita de la API. Un test pasa un doble. */
export interface BranchDeleter {
  findBranchByName(name: string): Promise<{ id: string } | undefined>
  deleteBranch(id: string): Promise<void>
}

export interface GuardLogger {
  error(...args: unknown[]): void
}

export type DestroyOutcome =
  /** No había nada que borrar (nunca se intentó crear, o ya se resolvió). */
  | { status: 'nada' }
  /** Se llamó a keep(): la branch quedó viva a propósito. */
  | { status: 'conservada' }
  /** Borrada. `foundByName` marca que hubo que buscarla porque no teníamos id. */
  | { status: 'borrada'; branchId: string; foundByName: boolean }
  /** Existía y NO se pudo borrar. El peor caso: quedan datos reales vivos. */
  | { status: 'huerfana'; branchId: string | null; error: unknown }

export interface BranchGuard {
  /** Desde acá la branch puede existir, aunque la creación todavía no responda. */
  markAttempted(): void
  /** Id real, apenas la API lo devuelve. */
  setBranchId(id: string): void
  /** Éxito verificado: la branch se conserva y el guardián se desarma. */
  keep(): void
  destroy(reason: string): Promise<DestroyOutcome>
}

/**
 * @param claimedName Nombre reservado para la branch. El llamador YA verificó
 *   que no existía ninguna con ese nombre, y eso es lo que hace seguro el
 *   barrido por nombre: cualquier branch que aparezca con ese nombre después es
 *   la nuestra.
 */
export function createBranchGuard(
  api: BranchDeleter,
  claimedName: string,
  logger: GuardLogger = console,
): BranchGuard {
  let branchId: string | null = null
  let mayExist = false
  let settled = false
  let inFlight: Promise<DestroyOutcome> | null = null

  return {
    markAttempted() {
      mayExist = true
    },

    setBranchId(id: string) {
      branchId = id
    },

    keep() {
      settled = true
    },

    async destroy(reason: string): Promise<DestroyOutcome> {
      // Una sola limpieza en vuelo. Sin esto, una señal que llega mientras el
      // `finally` ya está borrando dispararía un segundo DELETE y, peor, podría
      // dejar salir al proceso antes de que el primero termine.
      if (inFlight) return inFlight
      if (settled) return { status: 'conservada' }
      if (!mayExist) return { status: 'nada' }

      inFlight = (async (): Promise<DestroyOutcome> => {
        logger.error(`\n🧹 Borrando la branch "${claimedName}" — ${reason}`)

        let id = branchId
        let foundByName = false

        try {
          // Sin id la branch puede existir igual: la respuesta de creación pudo
          // perderse después de que Neon ya la hubiera creado.
          if (!id) {
            const found = await api.findBranchByName(claimedName)
            if (!found) {
              settled = true
              logger.error('   ✔ No existe ninguna branch con ese nombre: no quedó nada que borrar.')
              return { status: 'nada' }
            }
            id = found.id
            foundByName = true
            logger.error(`   · Encontrada por nombre: ${id}`)
          }

          await api.deleteBranch(id)
          settled = true
          logger.error('   ✔ Branch borrada. No quedó ninguna copia de producción.')
          return { status: 'borrada', branchId: id, foundByName }
        } catch (error) {
          // No se degrada a warning ni se traga: quedó una copia de producción
          // viva y la persona tiene que enterarse en la última línea que ve.
          logger.error('')
          logger.error('  ╔════════════════════════════════════════════════════════════╗')
          logger.error('  ║  ⛔  NO SE PUDO BORRAR LA BRANCH — HAY DATOS REALES VIVOS  ║')
          logger.error('  ╚════════════════════════════════════════════════════════════╝')
          logger.error('')
          logger.error(`   Branch : ${claimedName}${id ? ` (${id})` : ' (id desconocido)'}`)
          logger.error(`   Motivo : ${error instanceof Error ? error.message : String(error)}`)
          logger.error('')
          logger.error('   BORRALA A MANO AHORA, en la consola de Neon → Branches, o con:')
          if (id) {
            logger.error('     curl -X DELETE -H "Authorization: Bearer $NEON_API_KEY" \\')
            logger.error(`       https://console.neon.tech/api/v2/projects/$NEON_PROJECT_ID/branches/${id}`)
          }
          logger.error('')
          return { status: 'huerfana', branchId: id, error }
        }
      })()

      try {
        return await inFlight
      } finally {
        inFlight = null
      }
    },
  }
}
