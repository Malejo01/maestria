import { notFound } from 'next/navigation'
import { BuzonDeReportes } from '@/components/admin/buzon-de-reportes'
import { getAdminViewer } from '@/lib/auth-session'
import { BUZON } from '@/lib/textos'

/**
 * M6: /admin/reportes. El buzón (`feedback_reports`) no tenía dónde leerse:
 * los 9 reportes de producción seguían en 'nuevo', incluidos los de
 * septiembre. Como /admin/planes: sólo ADMIN_EMAILS (al resto, 404).
 */
export const dynamic = 'force-dynamic'

export default async function ReportesAdminPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{BUZON.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{BUZON.detalle}</p>
      </header>
      <BuzonDeReportes />
    </main>
  )
}
