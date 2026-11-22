import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { getAdminViewer } from '@/lib/auth-session'
import { leerPortada } from '@/lib/admin/portada-server'
import { SECCIONES_ADMIN, type SeccionAdmin } from '@/lib/admin/secciones'
import { ADMIN } from '@/lib/textos'

/**
 * P1 · /admin: la portada del panel. Arriba, cuatro números del día; abajo,
 * una tarjeta por sección con su dato vivo. Cada número es una consulta
 * liviana y se resuelve por su lado (lib/admin/portada-server.ts).
 */
export const dynamic = 'force-dynamic'

const usd = (v: number) => v.toLocaleString('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
const num = (v: number | null) => (v === null ? ADMIN.sinDato : v.toLocaleString('es-AR'))

function Numero({ etiqueta, valor, ayuda }: { etiqueta: string; valor: number | null; ayuda?: string }) {
  return (
    <div className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <p className="nota text-texto-suave">{etiqueta}</p>
      <p className="titulo-l mt-1 tabular-nums text-texto">{num(valor)}</p>
      {ayuda && <p className="nota mt-1 text-texto-suave">{ayuda}</p>}
    </div>
  )
}

export default async function AdminPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  const { hoy, tarjetas } = await leerPortada()

  const dato: Record<Exclude<SeccionAdmin, 'inicio'>, string> = {
    reportes: tarjetas.reportesNuevos === null ? ADMIN.sinDato : ADMIN.tarjetas.reportes(tarjetas.reportesNuevos),
    embudo: tarjetas.trabados === null ? ADMIN.sinDato : ADMIN.tarjetas.embudo(tarjetas.trabados),
    usoDeIA: tarjetas.ia === null ? ADMIN.sinDato : ADMIN.tarjetas.usoDeIA(usd(tarjetas.ia.gastoDelMesUsd), tarjetas.ia.llamadasDeHoy),
    planes:
      tarjetas.planes === null
        ? ADMIN.sinDato
        : ADMIN.tarjetas.planes(tarjetas.planes.prueba, tarjetas.planes.vencenEstaSemana, tarjetas.planes.vencidos),
    docentes: tarjetas.docentes === null ? ADMIN.sinDato : ADMIN.tarjetas.docentes(tarjetas.docentes),
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-10">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{ADMIN.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{ADMIN.detalle}</p>
      </header>

      <section aria-labelledby="admin-hoy" className="space-y-3">
        <h2 id="admin-hoy" className="titulo-m text-texto">
          {ADMIN.hoy.titulo}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Numero etiqueta={ADMIN.hoy.docentesActivos} valor={hoy.docentesActivos} ayuda={ADMIN.hoy.docentesActivosAyuda} />
          <Numero etiqueta={ADMIN.hoy.alumnos} valor={hoy.alumnosQueRespondieron} />
          <Numero etiqueta={ADMIN.hoy.intentos} valor={hoy.intentos} />
          <Numero etiqueta={ADMIN.hoy.reportesNuevos} valor={hoy.reportesNuevos} />
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {SECCIONES_ADMIN.filter((s) => s.id !== 'inicio').map((s) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className="flex min-h-24 items-center justify-between gap-4 rounded-lg border border-borde bg-superficie-tarjeta p-4 hover:border-borde-fuerte"
            >
              <span className="min-w-0">
                <span className="titulo-m block text-texto">{s.texto}</span>
                <span className="cuerpo-s mt-1 block text-texto-suave">{dato[s.id as Exclude<SeccionAdmin, 'inicio'>]}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
