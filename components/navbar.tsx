'use client'

import { useEffect, useState, useRef } from 'react'
import { GraduationCap, LogIn, ClipboardList, LogOut, ChevronDown, Menu, Home, Sparkles, Users, GraduationCap as TeacherIcon } from 'lucide-react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { StreakBadge } from './streak-badge'
import { useAppStore } from '@/lib/store'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { isSessionProfileStale } from '@/lib/session-profile-sync'
import type { UserRole } from '@/lib/types'

const NAV_LINKS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/tips', label: 'Cofre de Tips', icon: Sparkles },
  { href: '/history', label: 'Historial', icon: ClipboardList },
] as const

export function Navbar() {
  const { userProgress, userProfile, setUserProfile, setUserRole } = useAppStore()
  const { data: session, status, update: updateSession } = useSession()
  const isSignedIn = status === 'authenticated'
  const isTeacher = userProfile?.role === 'DOCENTE'
  const pathname = usePathname()
  const [isUpdatingRole, setIsUpdatingRole] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  /** Candado del refresco de sesión por perfil desactualizado. Ver el efecto que lo usa. */
  const hasSyncedSessionProfile = useRef(false)

  const navLinks = isTeacher
    ? [...NAV_LINKS, { href: '/teacher', label: 'Panel Docente', icon: TeacherIcon }]
    : [...NAV_LINKS, { href: '/aulas', label: 'Mis aulas', icon: Users }]

  // A guest student has no NextAuth session, so `isSignedIn` is false for them.
  // Their only destination is Mis aulas; everything else needs an account.
  const [guestName, setGuestName] = useState<string | null>(null)
  const isGuest = Boolean(guestName)

  const visibleLinks = isSignedIn
    ? navLinks
    : isGuest
      ? [{ href: '/aulas', label: 'Mis aulas', icon: Users }]
      : []

  useEffect(() => {
    if (status !== 'unauthenticated') {
      setGuestName(null)
      return
    }

    let isMounted = true

    fetch('/api/student/classrooms')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data?.viewer?.isGuest) setGuestName(data.viewer.displayName || 'Invitado')
      })
      .catch(() => {
        // Anonymous visitor: nothing to show.
      })

    return () => {
      isMounted = false
    }
  }, [status])

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        // ignore profile bootstrap errors in navbar
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
   * mostrando los viejos, y hasta ahora la única salida era pedirle al alumno
   * que cerrara sesión y volviera a entrar. Eso es exactamente lo que no se le
   * puede pedir a 31 personas por WhatsApp.
   *
   * auth.ts ya re-lee la base cuando el trigger es 'update', así que alcanza con
   * detectar el desfasaje y disparar `update()`. El alumno no hace nada: abre la
   * app y el token se pone al día solo.
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
    // `updateSession` se omite: next-auth la recrea por render y volvería a
    // disparar el efecto sola.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, userProfile, dbNivel, dbGrado, sessionNivel, sessionGrado])

  const handleRoleChange = async (nextRole: UserRole) => {
    setIsUpdatingRole(true)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cambiar el rol')
      }

      setUserProfile(data.profile)
      setUserRole(data.profile.role)
      // Refresh the JWT so the new role is reflected in the session
      await updateSession()
    } catch {
      // keep current role state on failure
    } finally {
      setIsUpdatingRole(false)
    }
  }

  // Navbar sits at z-30: above page content, below the quiz overlay (z-40) and
  // below every portaled Radix layer (z-50). See the note in quiz-overlay.tsx.
  return (
    <header className="sticky top-0 z-30 w-full bg-card/80 backdrop-blur-xl border-b border-border/50 shadow-sm transition-all duration-300">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-foreground tracking-[0.04em] leading-none [font-family:var(--font-brand)]">MaestrIA</h1>
            <p className="text-[9px] text-muted-foreground/70 font-semibold uppercase tracking-[0.18em] mt-0.5">Mastery Learning</p>
          </div>
        </div>

        {/* Center navigation (desktop) */}
        {visibleLinks.length > 0 && (
          <nav className="hidden lg:flex items-center gap-1">
            {visibleLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <link.icon className="w-4 h-4" />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Right side actions */}
        <div className="flex items-center gap-4">
          <div className="hidden xs:block">
            <StreakBadge streak={userProgress.streak} size="sm" />
          </div>

          <div className="h-8 w-[1px] bg-border/50 mx-1 hidden xs:block" />

          {/* Signed-out state */}
          {!isSignedIn && isGuest && (
            <span className="hidden sm:inline text-xs text-muted-foreground mr-1">
              Invitado: <span className="font-semibold text-foreground">{guestName}</span>
            </span>
          )}

          {!isSignedIn && (
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg hover:bg-primary/90 transition-all active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}

          {/* Signed-in state */}
          {isSignedIn && (
            <div className="flex items-center gap-3">
              <Select
                value={userProfile?.role ?? ''}
                onValueChange={(value) => handleRoleChange(value as UserRole)}
                disabled={isUpdatingRole}
              >
                <SelectTrigger className="hidden sm:flex h-9 w-[130px] rounded-xl bg-secondary border-border/60">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALUMNO">Alumno</SelectItem>
                  <SelectItem value="DOCENTE">Docente</SelectItem>
                </SelectContent>
              </Select>

              {/* Mobile nav trigger */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-border/50 bg-secondary hover:bg-secondary/80 transition-all"
                    aria-label="Abrir menú de navegación"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <SheetHeader>
                    <SheetTitle className="[font-family:var(--font-brand)]">MaestrIA</SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col gap-1 px-4">
                    {visibleLinks.map((link) => {
                      const isActive = pathname === link.href
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
                            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                          )}
                        >
                          <link.icon className="w-4 h-4" />
                          {link.label}
                        </Link>
                      )
                    })}
                  </nav>
                  <div className="px-4 pt-2 border-t border-border/50 mt-2 space-y-3">
                    <div className="sm:hidden">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Rol</p>
                      <Select
                        value={userProfile?.role ?? ''}
                        onValueChange={(value) => handleRoleChange(value as UserRole)}
                        disabled={isUpdatingRole}
                      >
                        <SelectTrigger className="w-full h-9 rounded-xl bg-secondary border-border/60">
                          <SelectValue placeholder="Rol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALUMNO">Alumno</SelectItem>
                          <SelectItem value="DOCENTE">Docente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </SheetContent>
              </Sheet>

              {/* User avatar + dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary px-2 py-1.5 hover:bg-secondary/80 transition-all"
                  aria-label="Menú de usuario"
                >
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name ?? 'Usuario'}
                      className="w-7 h-7 rounded-full border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                      {session?.user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-card border border-border/50 rounded-xl shadow-lg py-1 z-50">
                    <div className="px-3 py-2 border-b border-border/40">
                      <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

