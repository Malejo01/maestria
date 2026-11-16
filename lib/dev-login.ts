/**
 * Ingreso de desarrollo: entrar como un usuario de la base de STAGING sin
 * pasar por Google, para poder mirar las pantallas que están detrás del login.
 *
 * Existe porque un agente (o cualquiera sin la cuenta de Google de un docente)
 * no tiene otra forma de verificar el panel, y verificar con datos reales en
 * producción no es una opción.
 *
 * Tres candados, y tienen que abrir los tres:
 *
 *  1. `NODE_ENV === 'development'`. En un build de producción la condición es
 *     falsa en tiempo de compilación y el proveedor ni siquiera se registra.
 *  2. `DEV_LOGIN=1`, que sólo está en `.env.staging.local`. Quien corre
 *     `npm run dev` contra `.env.local` (producción) no lo tiene.
 *  3. La base dice ser staging. La fila `deployment_env` es la única fuente de
 *     verdad de qué es una base (ver CLAUDE.md, "Environments"): un marcador
 *     faltante o desconocido se trata como producción y el ingreso se niega.
 *     Este es el que importa si alguien copia DEV_LOGIN al archivo equivocado.
 *
 * Staging no tiene datos personales reales (`anonymize-staging.ts`), así que
 * entrar como cualquiera de sus usuarios no expone a nadie.
 */
import { sql } from '@/lib/db'

export { DEV_LOGIN_PROVIDER_ID } from '@/lib/dev-login-id'

/** Candados 1 y 2: los que se pueden evaluar sin tocar la base. */
export function devLoginConfigurado(
  env: { NODE_ENV?: string; DEV_LOGIN?: string } = process.env,
): boolean {
  return env.NODE_ENV === 'development' && env.DEV_LOGIN === '1'
}

/** Candado 3. Cualquier cosa que no sea exactamente 'staging' —incluido un error— es "no". */
export async function laBaseEsStaging(): Promise<boolean> {
  try {
    const rows = (await sql`SELECT environment FROM deployment_env LIMIT 1`) as { environment: string }[]
    return rows[0]?.environment === 'staging'
  } catch {
    return false
  }
}

export async function devLoginHabilitado(): Promise<boolean> {
  return devLoginConfigurado() && (await laBaseEsStaging())
}

export interface UsuarioDeDesarrollo {
  id: string
  name: string | null
  email: string | null
  role: string | null
}

/** El usuario pedido, sólo si los tres candados abren y existe en staging con cuenta (no invitado). */
export async function usuarioDeDesarrollo(userId: unknown): Promise<UsuarioDeDesarrollo | null> {
  if (typeof userId !== 'string' || !userId) return null
  if (!(await devLoginHabilitado())) return null

  const rows = (await sql`
    SELECT id, name, email, role
    FROM users
    WHERE id = ${userId} AND is_guest = false AND email IS NOT NULL
    LIMIT 1
  `) as UsuarioDeDesarrollo[]

  return rows[0] ?? null
}
