'use client'

import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { motion, useReducedMotion } from 'framer-motion'
import { EnlacesLegales } from '@/components/legal-notice'
import { PageContainer } from '@/components/layout/page-container'
import { MenuUsuario } from '@/components/caparazon/menu-usuario'
import { SesionAlDia } from '@/components/caparazon/sesion-al-dia'
import { Boton } from '@/components/sistema/boton'
import { BotonModo } from '@/components/sistema/boton-modo'
import { ICONO_NAV, TRAZO_ICONO } from '@/components/sistema/iconos'
import { Logo } from '@/components/sistema/logo'
import { entradaActiva, resolverCaparazon, type EntradaNav } from '@/lib/navegacion'
import { guardarRolElegido } from '@/lib/rol-elegido'
import { CUENTA, INVITADO, MIS_ALUMNOS, NAVEGACION } from '@/lib/textos'
import type { UserRole } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface QuienEntro {
  nombre: string
  email: string | null
  rol: UserRole | null
  esInvitado: boolean
}

/**
 * El caparazón de la app: la barra, los avisos y el marco de cada pantalla.
 *
 * Hay cuatro contextos (visitante, invitado, alumno, docente) y cada uno tiene
 * su navegación; cuál toca lo decide lib/navegacion.ts, no este archivo.
 *
 * En escritorio las entradas son pestañas en la barra, como en la referencia.
 * En celular van en una barra inferior con las tres siempre a la vista: con
 * sólo tres entradas, esconderlas detrás de un menú le saca a la persona justo
 * lo que necesita para saber dónde está parada.
 */
export function Caparazon({ quien, children }: { quien: QuienEntro | null; children: ReactNode }) {
  return (
    // useSearchParams (la sección activa del panel docente) pide un límite de
    // Suspense. El fallback dibuja el mismo marco sin marcar ninguna entrada.
    <Suspense fallback={<Marco quien={quien} seccion={null}>{children}</Marco>}>
      <MarcoConUrl quien={quien}>{children}</MarcoConUrl>
    </Suspense>
  )
}

function MarcoConUrl({ quien, children }: { quien: QuienEntro | null; children: ReactNode }) {
  const seccion = useSearchParams().get('seccion')
  return (
    <Marco quien={quien} seccion={seccion}>
      {children}
    </Marco>
  )
}

function Marco({
  quien,
  seccion,
  children,
}: {
  quien: QuienEntro | null
  seccion: string | null
  children: ReactNode
}) {
  const pathname = usePathname()
  const { contexto, entradas, vistaPrevia } = resolverCaparazon(
    quien ? { rol: quien.rol, esInvitado: quien.esInvitado } : null,
    pathname,
  )
  const activa = entradaActiva(contexto, pathname, seccion)
  const tieneBarraInferior = entradas.length > 0
  const enProgreso = contexto === 'alumno' && activa === 'progreso'

  return (
    <div className="flex min-h-dvh flex-col bg-superficie-base">
      {quien && !quien.esInvitado && <SesionAlDia />}

      {/* z-30: sobre el contenido, debajo del cuestionario a pantalla completa
          (z-40) y de toda capa de Radix (z-50). Ver components/quiz-overlay.tsx. */}
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie-tarjeta">
        <div className="mx-auto flex min-h-[60px] w-full max-w-7xl items-center gap-6 px-4 sm:px-6 md:min-h-[68px] lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-sm" aria-label="MaestrIA, ir al inicio">
            <Logo variante="barra" />
          </Link>

          {entradas.length > 0 && (
            <nav aria-label={NAVEGACION.etiquetaNav} className="hidden self-stretch md:flex md:gap-6">
              {entradas.map((entrada) => (
                <Pestana key={entrada.id} entrada={entrada} activa={entrada.id === activa} />
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2">
            <BotonModo />
            {!quien && (
              <Boton variante="secundario" asChild>
                <Link href="/">{NAVEGACION.ingresar}</Link>
              </Boton>
            )}
            {/* La acción del panel docente, como en la referencia: siempre a mano. */}
            {contexto === 'docente' && (
              <Boton asChild>
                <Link href="/teacher?agregar=1">{MIS_ALUMNOS.agregarCorto}</Link>
              </Boton>
            )}
            {quien && !quien.esInvitado && quien.rol && (
              <MenuUsuario nombre={quien.nombre} email={quien.email} rol={quien.rol} vistaPrevia={vistaPrevia} />
            )}
          </div>
        </div>
      </header>

      {contexto === 'invitado' && <AvisoInvitado />}
      {vistaPrevia && <AvisoVistaPrevia />}

      <main className={cn('flex-1', tieneBarraInferior && 'pb-16 md:pb-0')}>
        <PageContainer>
          {enProgreso && <SubNavProgreso pathname={pathname} />}
          {children}
        </PageContainer>
      </main>

      <footer className={cn('border-t border-borde', tieneBarraInferior && 'mb-16 md:mb-0')}>
        <div className="mx-auto flex w-full max-w-7xl justify-center px-4 py-2 sm:px-6 lg:px-8">
          <EnlacesLegales />
        </div>
      </footer>

      {tieneBarraInferior && <BarraInferior entradas={entradas} activa={activa} />}
    </div>
  )
}

/** Pestaña de escritorio. La raya de la activa se desliza de una a otra. */
function Pestana({ entrada, activa }: { entrada: EntradaNav; activa: boolean }) {
  const sinMovimiento = useReducedMotion()
  return (
    <Link
      href={entrada.href}
      aria-current={activa ? 'page' : undefined}
      className={cn(
        'cuerpo-s relative inline-flex items-center rounded-sm font-semibold transition-colors',
        activa ? 'text-texto' : 'text-texto-suave hover:text-texto',
      )}
    >
      {entrada.etiqueta}
      {activa && (
        <motion.span
          layoutId="pestana-activa"
          className="absolute inset-x-0 bottom-0 h-0.5 bg-accion"
          transition={sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
    </Link>
  )
}

function BarraInferior({ entradas, activa }: { entradas: EntradaNav[]; activa: string | null }) {
  const sinMovimiento = useReducedMotion()
  return (
    <nav
      aria-label={NAVEGACION.etiquetaNav}
      data-barra-inferior
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-borde bg-superficie-tarjeta pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {entradas.map((entrada) => {
        const Icono = ICONO_NAV[entrada.icono]
        const esActiva = entrada.id === activa
        return (
          <Link
            key={entrada.id}
            href={entrada.href}
            aria-current={esActiva ? 'page' : undefined}
            className={cn(
              'relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-[14px]',
              esActiva ? 'text-texto' : 'text-texto-suave',
            )}
          >
            {esActiva && (
              <motion.span
                layoutId="entrada-activa"
                className="absolute inset-x-0 top-0 h-0.5 bg-accion"
                transition={sinMovimiento ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <Icono aria-hidden="true" className="size-[22px]" strokeWidth={TRAZO_ICONO} />
            {entrada.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Historial y tips todavía son dos pantallas; "Mi progreso" las agrupa con
 * estas dos sub-entradas hasta que el bloque 6 las funda en una sola.
 */
function SubNavProgreso({ pathname }: { pathname: string }) {
  const items = [
    { href: '/history', etiqueta: NAVEGACION.progreso.historial },
    { href: '/tips', etiqueta: NAVEGACION.progreso.tips },
  ]
  return (
    <nav aria-label={NAVEGACION.alumno.progreso} className="mb-6 flex gap-2">
      {items.map((item) => {
        const activa = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              'cuerpo-s inline-flex min-h-11 items-center rounded-md border px-4 font-semibold transition-colors',
              activa
                ? 'border-texto bg-superficie-tarjeta text-texto'
                : 'border-borde bg-superficie-tarjeta text-texto-suave hover:border-borde-fuerte hover:text-texto',
            )}
          >
            {item.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

/** Franja de aviso bajo la barra: persistente, discreta, nunca modal. */
function Franja({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-accion-tenue-borde bg-accion-tenue">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  )
}

function AvisoInvitado() {
  return (
    <Franja>
      <p className="cuerpo-s flex-1 text-texto">
        {INVITADO.aviso} <span className="text-texto-suave">{INVITADO.conCuenta}</span>
      </p>
      <Boton
        variante="secundario"
        className="shrink-0"
        onClick={() => {
          // Ya es alumno: la bienvenida no le pregunta el rol. Lo que hizo como
          // invitado se le suma a la cuenta al volver (/api/student/guest/claim).
          guardarRolElegido('alumno')
          void signIn('google', { callbackUrl: '/aulas' })
        }}
      >
        {INVITADO.crearCuenta}
      </Boton>
    </Franja>
  )
}

function AvisoVistaPrevia() {
  return (
    <Franja>
      <p className="cuerpo-s flex-1 text-texto">{CUENTA.vistaAlumno.aviso}</p>
      <Boton variante="secundario" className="shrink-0" asChild>
        <Link href="/teacher">{CUENTA.vistaAlumno.volver}</Link>
      </Boton>
    </Franja>
  )
}
