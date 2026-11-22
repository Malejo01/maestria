import { notFound } from 'next/navigation'
import { AcreditarPlan } from '@/components/admin/acreditar-plan'
import { getAdminViewer } from '@/lib/auth-session'
import { listarDocentesConPlan, type DocenteEnPlanes } from '@/lib/planes-server'
import type { EstadoPlan } from '@/lib/planes'

/**
 * G4: /admin/planes. La lista de docentes con sus alumnos, nivel, estado,
 * vencimiento y notas, y un formulario por fila para acreditar a mano lo que
 * pagaron por un link de MercadoPago.
 *
 * Como /admin/ai-usage: fuera del grupo (app), sólo para ADMIN_EMAILS (al
 * resto, 404), y con un link pelado para volver.
 */
export const dynamic = 'force-dynamic'

const ESTADO: Record<EstadoPlan, { texto: string; clase: string }> = {
  exento: { texto: 'Exento', clase: 'text-texto-suave' },
  prueba: { texto: 'Prueba', clase: 'text-accion' },
  activo: { texto: 'Activo', clase: 'text-logrado' },
  gratis: { texto: 'Gratis', clase: 'text-texto' },
  vencido: { texto: 'Vencido', clase: 'text-flojo' },
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—')

export default async function PlanesAdminPage() {
  const admin = await getAdminViewer()
  if (!admin) notFound()

  let docentes: DocenteEnPlanes[] | null = null
  let error: string | null = null
  try {
    docentes = await listarDocentesConPlan()
  } catch (causa) {
    error =
      (causa as { code?: string })?.code === '42703'
        ? 'La migración 026 no corrió en esta base: todos los docentes están exentos y todavía no hay nada que acreditar.'
        : causa instanceof Error
          ? causa.message
          : String(causa)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">Planes</h1>
        <p className="cuerpo-s text-texto-suave">
          Acreditá a mano lo que pagó cada docente. Cada acreditación agrega una línea a sus notas con quién y cuándo.
        </p>
      </header>

      {error && (
        <p role="alert" className="cuerpo-s rounded-lg border border-flojo bg-flojo-fondo p-4 text-texto">
          {error}
        </p>
      )}

      {docentes && docentes.length === 0 && <p className="cuerpo-s text-texto-suave">Todavía no hay docentes.</p>}

      {docentes && docentes.length > 0 && (
        <ul className="space-y-3">
          {docentes.map((docente) => {
            const estado = ESTADO[docente.resumen.estado]
            return (
              <li key={docente.id} className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="cuerpo font-bold text-texto">{docente.nombre || 'Sin nombre'}</p>
                    <p className="nota break-all text-texto-suave">{docente.email ?? 'sin email'}</p>
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 cuerpo-s">
                    <div>
                      <dt className="nota inline text-texto-suave">Alumnos </dt>
                      <dd className="inline font-semibold text-texto">
                        {docente.alumnos}
                        {docente.resumen.cupo !== null ? ` de ${docente.resumen.cupo}` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="nota inline text-texto-suave">Nivel </dt>
                      <dd className="inline font-semibold text-texto">{docente.resumen.nivel ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="nota inline text-texto-suave">Estado </dt>
                      <dd className={`inline font-semibold ${estado.clase}`}>
                        {estado.texto}
                        {docente.resumen.avisoDePruebaPendiente ? ' (sin arrancar)' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="nota inline text-texto-suave">Vence </dt>
                      <dd className="inline font-semibold text-texto">{fecha(docente.resumen.venceEl)}</dd>
                    </div>
                  </dl>
                </div>
                {docente.notas && (
                  <pre className="nota whitespace-pre-wrap rounded-md bg-superficie-suave p-3 font-sans text-texto-suave">
                    {docente.notas}
                  </pre>
                )}
                {docente.resumen.estado !== 'exento' && (
                  <AcreditarPlan docenteId={docente.id} nivelActual={docente.resumen.nivel} />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
