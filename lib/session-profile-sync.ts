/**
 * Cuándo hay que refrescar el JWT porque el perfil de la sesión quedó viejo.
 *
 * `nivel` y `grado` viajan cacheados en el token (ver el callback `jwt` de
 * auth.ts, que sólo re-lee la base en el sign-in o cuando el trigger es
 * 'update'). Cuando alguien los corrige en la base —una migración de perfiles,
 * el docente arreglando un curso mal cargado— la sesión abierta sigue mostrando
 * los viejos, y la única salida era pedirle a la persona que cerrara sesión.
 *
 * La regla vive acá y no dentro del componente para poder probarla: el caso que
 * importa no es el obvio ("son distintos, refrescá") sino los que NO tienen que
 * disparar, porque un falso positivo se convierte en un pedido a /api/auth en
 * cada carga de página para todos los usuarios logueados.
 */

export interface ProfileSnapshot {
  nivel?: string | null
  grado?: string | null
}

/**
 * Compara el perfil de la base contra el que trae la sesión.
 *
 * `null` y `undefined` se tratan igual a propósito: la base devuelve `null` en
 * una columna vacía y el endpoint de perfil lo mapea a `undefined`, así que
 * compararlos crudo daría "distinto" para todo usuario sin nivel cargado — que
 * son casi todos los de K-12 que nunca completaron el onboarding.
 */
export function isSessionProfileStale(
  fromDb: ProfileSnapshot | null | undefined,
  fromSession: ProfileSnapshot | null | undefined
): boolean {
  // Sin uno de los dos lados no hay comparación posible: el perfil todavía no
  // cargó, o no hay sesión. Refrescar a ciegas acá sería disparar en cada
  // arranque, antes de saber si hace falta.
  if (!fromDb || !fromSession) return false

  const norm = (value: string | null | undefined) => value ?? null

  return (
    norm(fromDb.nivel) !== norm(fromSession.nivel) ||
    norm(fromDb.grado) !== norm(fromSession.grado)
  )
}
