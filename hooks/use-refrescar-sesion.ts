'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Pide que el JWT se vuelva a armar leyendo la base.
 *
 * El rol, `isOnboarded`, el nivel y el año viajan cacheados en el token
 * (callback `jwt` de auth.ts), y auth.ts los re-lee de la base sólo cuando el
 * disparador es `'update'`.
 *
 * ─── Por qué existe este hook y no se llama a `update()` directo ─────────────
 * En Auth.js v5, `useSession().update()` SIN argumento no dispara nada: hace
 * un GET común de la sesión y devuelve el token tal como estaba
 * (node_modules/next-auth/react.js: `typeof data === "undefined" ? undefined :
 * { body: … }`). Sólo con un argumento hace el POST que el servidor marca como
 * `trigger: 'update'`.
 *
 * El repo llamaba a `update()` pelado en tres lugares —al terminar la
 * bienvenida, al cambiar de rol y al detectar un perfil desactualizado— y en
 * los tres el token quedaba viejo sin avisar. No se notaba porque la barra
 * vieja leía el rol de otra fuente y el gate de onboarding tenía un
 * `forceOnboarded` que tapaba el síntoma. Se notó el 15/11/2026, cuando la
 * raíz del sitio pasó a decidir por el rol del token: la persona elegía
 * "Soy alumno" y quedaba en "Preparando tu cuenta…" para siempre.
 *
 * Es la misma familia de falla que docs/deuda-tecnica.md §6: algo que no
 * funciona y se ve igual que si funcionara.
 *
 * El objeto vacío no lleva datos a propósito. auth.ts no confía en lo que
 * manda el cliente: ignora el cuerpo y lee todo de la base.
 */
export function useRefrescarSesion(): () => Promise<void> {
  const { update } = useSession()

  // Siempre la `update` del último render. next-auth la recrea cada vez que
  // cambia su estado interno, y la del primer render nace con `loading: true`
  // adentro: llamada más tarde, sale por su `if (loading) return` sin hacer
  // nada. Guardarla una sola vez (un useCallback con dependencias vacías) fue
  // el segundo intento de este arreglo, y fallaba en silencio igual que el
  // `update()` sin argumento. Lo mostró la pestaña de red: después de guardar
  // el rol no salía ningún POST a /api/auth/session.
  const ultima = useRef(update)
  useEffect(() => {
    ultima.current = update
  }, [update])

  // La función que se devuelve sí es estable, para poder usarla en efectos.
  return useCallback(async () => {
    await ultima.current({})
  }, [])
}
