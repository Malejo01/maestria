'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRefrescarSesion } from '@/hooks/use-refrescar-sesion'
import { useAppStore } from '@/lib/store'
import { isSessionProfileStale } from '@/lib/session-profile-sync'

/**
 * Mantiene al día el perfil en el store y el JWT. No dibuja nada.
 *
 * Son los dos efectos que antes vivían en la barra de navegación vieja. Se
 * mudaron sin cambios de lógica: varias pantallas leen `userProfile` del store,
 * y el segundo efecto es lo que evita pedirle a 31 alumnos por WhatsApp que
 * cierren sesión y vuelvan a entrar.
 */
export function SesionAlDia() {
  const { userProfile, setUserProfile } = useAppStore()
  const { data: session, status } = useSession()
  const updateSession = useRefrescarSesion()
  const isSignedIn = status === 'authenticated'
  /** Candado del refresco de sesión por perfil desactualizado. Ver el efecto que lo usa. */
  const hasSyncedSessionProfile = useRef(false)

  useEffect(() => {
    if (!isSignedIn) return

    let isMounted = true

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/user/profile')
        const data = await response.json()
        if (!response.ok || !isMounted) return
        setUserProfile(data.profile)
      } catch {
        // El perfil es un complemento: sin él las pantallas usan la sesión.
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [isSignedIn, setUserProfile])

  /**
   * Pone al día el JWT cuando el perfil de la sesión quedó viejo.
   *
   * nivel y grado viajan cacheados en el token (ver el callback `jwt` de
   * auth.ts). Cuando alguien los corrige en la base —una migración de perfiles,
   * el docente arreglando un curso mal cargado— la sesión abierta sigue
   * mostrando los viejos. auth.ts ya re-lee la base cuando el trigger es
   * 'update', así que alcanza con detectar el desfasaje y disparar `update()`.
   *
   * Va en un efecto aparte y depende SÓLO de primitivos a propósito. Metiendo
   * `session.user` en las dependencias, cualquier render que devuelva un objeto
   * nuevo vuelve a disparar el efecto; comparando strings, el efecto se queda
   * quieto salvo que los valores cambien de verdad.
   *
   * La regla de comparación vive en lib/session-profile-sync.ts, con tests.
   */
  const sessionNivel = session?.user?.nivel ?? null
  const sessionGrado = session?.user?.grado ?? null
  const dbNivel = userProfile?.nivel ?? null
  const dbGrado = userProfile?.grado ?? null

  useEffect(() => {
    if (!isSignedIn || !userProfile) return

    const stale = isSessionProfileStale(
      { nivel: dbNivel, grado: dbGrado },
      { nivel: sessionNivel, grado: sessionGrado },
    )
    if (!stale) return

    // Una sola vez por montaje. `update()` reescribe la sesión y vuelve a
    // correr este efecto; sin el candado, un desfasaje que la base no puede
    // resolver —el update falla, o el perfil quedó a medio escribir— daría un
    // loop de requests contra /api/auth en vez de degradar en silencio.
    if (hasSyncedSessionProfile.current) return
    hasSyncedSessionProfile.current = true

    updateSession().catch(() => {
      // Si no se puede refrescar, el alumno sigue viendo el perfil viejo: es el
      // comportamiento que ya tenía, no una regresión.
    })
    // `updateSession` es estable (hooks/use-refrescar-sesion.ts) y se omite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userProfile, dbNivel, dbGrado, sessionNivel, sessionGrado])

  return null
}
