'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, CreditCard, Filter, Gauge, Inbox, LayoutDashboard, Users, type LucideIcon } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Logo } from '@/components/sistema/logo'
import { SECCIONES_ADMIN, seccionActiva, type SeccionAdmin } from '@/lib/admin/secciones'
import { ADMIN } from '@/lib/textos'
import { cn } from '@/lib/utils'

const ICONO: Record<SeccionAdmin, LucideIcon> = {
  inicio: LayoutDashboard,
  reportes: Inbox,
  embudo: Filter,
  usoDeIA: Gauge,
  planes: CreditCard,
  docentes: Users,
}

/**
 * P1 · La navegación del panel de admin: barra lateral en escritorio, pestañas
 * que se deslizan arriba en el celular. Las dos salen de SECCIONES_ADMIN.
 */
export function NavAdmin() {
  const activa = seccionActiva(usePathname())

  return (
    <>
      {/* Celular: logo + volver, y debajo las pestañas con desplazamiento horizontal. */}
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie-tarjeta md:hidden">
        <div className="flex min-h-[56px] items-center justify-between gap-3 px-4">
          <Link href="/admin" className="inline-flex min-h-11 items-center rounded-sm" aria-label={ADMIN.titulo}>
            <Logo variante="barra" />
          </Link>
          <Link href="/" className="nota inline-flex min-h-11 items-center gap-1 rounded-sm font-semibold text-texto-suave hover:text-texto">
            <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {ADMIN.volverALaApp}
          </Link>
        </div>
        <nav aria-label={ADMIN.navEtiqueta} className="-mb-px flex gap-1 overflow-x-auto px-2">
          {SECCIONES_ADMIN.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={s.id === activa ? 'page' : undefined}
              className={cn(
                'cuerpo-s inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 font-semibold',
                s.id === activa ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
              )}
            >
              {s.texto}
            </Link>
          ))}
        </nav>
      </header>

      {/* Escritorio: barra lateral fija. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-borde bg-superficie-tarjeta md:flex">
        <div className="px-5 pt-6 pb-4">
          <Link href="/admin" className="inline-flex min-h-11 items-center rounded-sm" aria-label={ADMIN.titulo}>
            <Logo variante="barra" />
          </Link>
          <p className="etiqueta mt-2 text-texto-suave">{ADMIN.titulo}</p>
        </div>
        <nav aria-label={ADMIN.navEtiqueta} className="flex flex-1 flex-col gap-1 px-3">
          {SECCIONES_ADMIN.map((s) => {
            const Icono = ICONO[s.id]
            const esActiva = s.id === activa
            return (
              <Link
                key={s.id}
                href={s.href}
                aria-current={esActiva ? 'page' : undefined}
                className={cn(
                  'cuerpo-s flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold',
                  esActiva ? 'bg-superficie-suave text-texto' : 'text-texto-suave hover:bg-superficie-suave hover:text-texto',
                )}
              >
                <Icono className="size-5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {s.texto}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-borde p-3">
          <Link
            href="/"
            className="cuerpo-s flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold text-texto-suave hover:bg-superficie-suave hover:text-texto"
          >
            <ArrowLeft className="size-5" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {ADMIN.volverALaApp}
          </Link>
        </div>
      </aside>
    </>
  )
}
