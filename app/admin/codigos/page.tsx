import { listarCodigos } from '@/lib/codigos-descuento-server'
import { CrearCodigo, DesactivarCodigo } from '@/components/admin/codigos'
import { CODIGOS_ADMIN as T } from '@/lib/textos'

export const dynamic = 'force-dynamic'

/**
 * Ronda T · C1 — /admin/codigos: crear códigos de descuento, ver sus usos y
 * desactivarlos. El layout de /admin ya frena a quien no es admin (404).
 */
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : null

export default async function CodigosAdminPage() {
  let codigos: Awaited<ReturnType<typeof listarCodigos>> | null = null
  let error: string | null = null
  try {
    codigos = await listarCodigos()
  } catch {
    error = T.noSePudo
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="titulo-l text-texto">{T.titulo}</h1>
        <p className="cuerpo-s text-texto-suave">{T.detalle}</p>
      </header>

      {codigos === 'sin_migracion' && <p className="cuerpo-s text-flojo">{T.faltaMigracion}</p>}
      {error && <p className="cuerpo-s text-flojo">{error}</p>}

      {Array.isArray(codigos) && (
        <>
          <section className="space-y-3 rounded-lg border border-borde bg-superficie-tarjeta p-4" aria-labelledby="crear-codigo">
            <h2 id="crear-codigo" className="titulo-m text-texto">
              {T.crear}
            </h2>
            <CrearCodigo />
          </section>

          {codigos.length === 0 ? (
            <p className="cuerpo-s text-texto-suave">{T.ninguno}</p>
          ) : (
            <ul className="space-y-3" aria-label={T.titulo}>
              {codigos.map((c) => (
                <li key={c.id} className="space-y-2 rounded-lg border border-borde bg-superficie-tarjeta p-4" data-codigo={c.codigo}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="cuerpo font-bold text-texto">
                      {c.codigo} <span className="cuerpo-s font-semibold text-accion">· {c.porcentaje} %</span>
                      {c.fundadora && <span className="nota ml-2 text-accion">★ {T.marcaFundadora}</span>}
                    </p>
                    <span className={`nota font-semibold ${c.activo ? 'text-logrado' : 'text-texto-suave'}`}>
                      {c.activo ? T.activo : T.inactivo}
                    </span>
                  </div>
                  <p className="nota text-texto-suave">
                    {[
                      T.aplica[c.aplica],
                      T.forma[c.forma],
                      c.meses ? T.meses(c.meses) : T.sinLimiteDeMeses,
                      T.usos(c.usosHechos, c.usosMaximos),
                      c.venceEl ? T.vence(fecha(c.venceEl)!) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {c.nota && <p className="cuerpo-s text-texto">{c.nota}</p>}
                  {c.usos.length > 0 && (
                    <p className="nota text-texto-suave">
                      {T.usadoPor} {c.usos.map((u) => `${u.nombre} (${fecha(u.primerUsoEl)})`).join(', ')}
                    </p>
                  )}
                  <DesactivarCodigo id={c.id} activo={c.activo} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
