import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { NavAdmin } from '@/components/admin/nav-admin'
import { getAdminViewer } from '@/lib/auth-session'

/**
 * P1 · El marco de todo /admin/*: barra lateral en escritorio, pestañas arriba
 * en el celular, y "Volver a la app".
 *
 * Fuera del grupo (app) a propósito, como siempre estuvieron estas páginas: no
 * arrastra la barra de la app ni sus guards. Quien no está en ADMIN_EMAILS
 * recibe un 404 acá (y en el proxy, y en cada página): si no es para vos, la
 * página no existe.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  return (
    <div className="flex min-h-dvh flex-col bg-superficie-base md:flex-row">
      <NavAdmin />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
